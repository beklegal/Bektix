import crypto from "node:crypto";
import express from "express";
import { z } from "zod";
import type { PaymentMethod, ShopPreferences } from "@shared/bektix";
import { requireUser } from "../auth/requireUser";
import { pool } from "../db/pool";
import { serializeSale, serializeSaleLineItem } from "../domain/serializers";
import { sendApiError } from "../http/errors";

export const salesRouter = express.Router();
salesRouter.use(requireUser);

function generateReceiptNumber() {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `${year}-${rand}`;
}

type ProductRow = {
  id: string;
  name: string;
  quantity: number;
  cost_price: number;
  selling_price: number;
};

async function fetchSaleWithItems(shopId: string, saleId: string) {
  const saleResult = await pool.query(
    `
      SELECT id, shop_id, receipt_number, created_at, cashier_user_id, cashier_name,
             subtotal, tax, total, amount_paid, change, payment_method
      FROM sales
      WHERE id = $1 AND shop_id = $2
      LIMIT 1
    `,
    [saleId, shopId],
  );
  const saleRow = saleResult.rows[0];
  if (!saleRow) return null;

  const itemsResult = await pool.query(
    `
      SELECT product_id, name, quantity, unit_price, unit_cost
      FROM sale_line_items
      WHERE sale_id = $1
      ORDER BY id ASC
    `,
    [saleId],
  );

  const items = itemsResult.rows.map(serializeSaleLineItem);
  return serializeSale(saleRow, items);
}

salesRouter.get("/", async (req, res) => {
  const { shopId } = req.auth!;

  const salesResult = await pool.query(
    `
      SELECT id, shop_id, receipt_number, created_at, cashier_user_id, cashier_name,
             subtotal, tax, total, amount_paid, change, payment_method
      FROM sales
      WHERE shop_id = $1
      ORDER BY created_at DESC
      LIMIT 250
    `,
    [shopId],
  );

  const saleIds = salesResult.rows.map((r) => r.id as string);
  if (saleIds.length === 0) return res.json([]);

  const itemsResult = await pool.query(
    `
      SELECT sale_id, product_id, name, quantity, unit_price, unit_cost
      FROM sale_line_items
      WHERE sale_id = ANY($1::uuid[])
    `,
    [saleIds],
  );

  const bySale = new Map<string, ReturnType<typeof serializeSaleLineItem>[]>();
  for (const row of itemsResult.rows) {
    const saleId = row.sale_id as string;
    const list = bySale.get(saleId) ?? [];
    list.push(serializeSaleLineItem(row));
    bySale.set(saleId, list);
  }

  const payload = salesResult.rows.map((saleRow) => {
    const items = bySale.get(saleRow.id as string) ?? [];
    return serializeSale(saleRow, items);
  });

  res.json(payload);
});

const createSaleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1),
      }),
    )
    .min(1),
  paymentMethod: z.enum(["cash", "mobileMoney"]),
  amountPaid: z.number().min(0),
});

salesRouter.post("/", async (req, res) => {
  const { userId, shopId } = req.auth!;

  const parsed = createSaleSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid sale.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const shopResult = await client.query<{ preferences: unknown }>(
      "SELECT preferences FROM shops WHERE id = $1 LIMIT 1",
      [shopId],
    );
    const preferences = shopResult.rows[0]?.preferences as ShopPreferences | undefined;
    const taxRate = preferences?.taxRatePercent ?? 0;

    const productIds = Array.from(new Set(parsed.data.items.map((i) => i.productId)));

    const productResult = await client.query(
      `
        SELECT id, name, quantity, cost_price, selling_price
        FROM products
        WHERE shop_id = $1 AND id = ANY($2::uuid[])
        FOR UPDATE
      `,
      [shopId, productIds],
    );

    const productRows = productResult.rows as ProductRow[];
    const productById = new Map<string, ProductRow>(productRows.map((p) => [p.id, p]));
    for (const item of parsed.data.items) {
      const product = productById.get(item.productId);
      if (!product) {
        throw new Error("Some products are not available for this shop.");
      }
      if (item.quantity > product.quantity) {
        throw new Error(`Insufficient stock for ${product.name}.`);
      }
    }

    const lineItems = parsed.data.items.map((item) => {
      const product = productById.get(item.productId)!;
      return {
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        unitPrice: product.selling_price,
        unitCost: product.cost_price,
        lineTotal: product.selling_price * item.quantity,
      };
    });

    const subtotal = lineItems.reduce((sum, li) => sum + li.lineTotal, 0);
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    if (parsed.data.amountPaid < total) {
      throw new Error("Insufficient payment.");
    }

    const change = parsed.data.amountPaid - total;

    const userResult = await client.query<{
      id: string;
      name: string;
      email: string;
    }>(
      "SELECT id, name, email FROM users WHERE id = $1 AND shop_id = $2 LIMIT 1",
      [userId, shopId],
    );
    const cashier = userResult.rows[0];
    if (!cashier) throw new Error("Cashier not found.");

    // Insert sale with a retry in case of receipt number collision.
    const saleId = crypto.randomUUID();
    let receiptNumber = generateReceiptNumber();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await client.query(
          `
            INSERT INTO sales (
              id, shop_id, receipt_number, cashier_user_id, cashier_name,
              subtotal, tax, total, amount_paid, change, payment_method
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          `,
          [
            saleId,
            shopId,
            receiptNumber,
            cashier.id,
            cashier.name || cashier.email,
            subtotal,
            tax,
            total,
            parsed.data.amountPaid,
            change,
            parsed.data.paymentMethod satisfies PaymentMethod,
          ],
        );
        break;
      } catch (err: any) {
        if (attempt === 2) throw err;
        if (err?.code === "23505") {
          receiptNumber = generateReceiptNumber();
          continue;
        }
        throw err;
      }
    }

    for (const li of lineItems) {
      await client.query(
        `
          INSERT INTO sale_line_items (id, sale_id, product_id, name, quantity, unit_price, unit_cost)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
        `,
        [crypto.randomUUID(), saleId, li.productId, li.name, li.quantity, li.unitPrice, li.unitCost],
      );

      await client.query(
        `
          UPDATE products
          SET quantity = quantity - $1, updated_at = now()
          WHERE id = $2 AND shop_id = $3
        `,
        [li.quantity, li.productId, shopId],
      );
    }

    await client.query("COMMIT");

    const sale = await fetchSaleWithItems(shopId, saleId);
    res.status(201).json(sale);
  } catch (err: any) {
    await client.query("ROLLBACK");
    const message = err instanceof Error ? err.message : "Sale failed.";
    return sendApiError(res, 400, "bad_request", message);
  } finally {
    client.release();
  }
});

salesRouter.get("/:saleId", async (req, res) => {
  const { shopId } = req.auth!;

  const sale = await fetchSaleWithItems(shopId, req.params.saleId);
  if (!sale) return sendApiError(res, 404, "not_found", "Sale not found.");
  res.json(sale);
});
