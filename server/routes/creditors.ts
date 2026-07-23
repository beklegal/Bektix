import crypto from "node:crypto";
import express from "express";
import { z } from "zod";
import { requireUser } from "../auth/requireUser.js";
import { requireFeature } from "../auth/requireFeature.js";
import { pool } from "../db/pool.js";
import {
  serializePurchaseInvoice,
  serializePurchaseLineItem,
  serializePurchaseOrder,
  serializeSupplier,
  serializeSupplierPayment,
} from "../domain/serializers.js";
import { sendApiError } from "../http/errors.js";

export const creditorsRouter = express.Router();
creditorsRouter.use(requireUser);
creditorsRouter.use(requireFeature("creditors"));
creditorsRouter.use((req, res, next) => {
  if (req.auth?.role !== "admin") {
    return sendApiError(res, 403, "forbidden", "Admin access required.");
  }
  next();
});

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const paymentMethodSchema = z.enum(["cash", "cheque"]);
const purchaseLineSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string().min(1),
  quantity: z.number().int().min(1),
  unitCost: z.number().min(0),
});

const supplierSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

const supplierPatchSchema = supplierSchema
  .partial()
  .extend({ status: z.enum(["active", "inactive"]).optional() })
  .refine((val) => Object.keys(val).length > 0, { message: "Empty patch." });

const purchaseOrderSchema = z.object({
  supplierId: z.string().uuid(),
  orderDate: dateSchema,
  expectedDate: dateSchema.optional().or(z.literal("")),
  items: z.array(purchaseLineSchema).min(1),
});

const purchaseInvoiceSchema = z.object({
  supplierId: z.string().uuid(),
  purchaseOrderId: z.string().uuid().optional(),
  invoiceNumber: z.string().min(1),
  invoiceDate: dateSchema,
  dueDate: dateSchema.optional().or(z.literal("")),
  items: z.array(purchaseLineSchema).min(1),
});

const supplierPaymentSchema = z.object({
  purchaseInvoiceId: z.string().uuid(),
  paymentDate: dateSchema,
  amount: z.number().min(0.01),
  paymentMethod: paymentMethodSchema,
  reference: z.string().optional(),
});

function generateOrderNumber() {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `PO-${year}-${rand}`;
}

async function fetchCreditorsPayload(shopId: string) {
  const suppliersResult = await pool.query(
    `
      SELECT id, shop_id, name, contact_name, phone, email, status, created_at, updated_at
      FROM suppliers
      WHERE shop_id = $1
      ORDER BY name ASC
    `,
    [shopId],
  );

  const ordersResult = await pool.query(
    `
      SELECT po.id, po.shop_id, po.supplier_id, s.name AS supplier_name,
             po.order_number, po.order_date, po.expected_date, po.status,
             po.total, po.created_at, po.updated_at
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.shop_id = $1
      ORDER BY po.order_date DESC, po.created_at DESC
      LIMIT 250
    `,
    [shopId],
  );

  const orderIds = ordersResult.rows.map((row) => row.id as string);
  const orderItemsById = new Map<string, ReturnType<typeof serializePurchaseLineItem>[]>();
  if (orderIds.length > 0) {
    const orderItems = await pool.query(
      `
        SELECT purchase_order_id, product_id, product_name, quantity, unit_cost
        FROM purchase_order_line_items
        WHERE purchase_order_id = ANY($1::uuid[])
      `,
      [orderIds],
    );
    for (const row of orderItems.rows) {
      const list = orderItemsById.get(row.purchase_order_id) ?? [];
      list.push(serializePurchaseLineItem(row));
      orderItemsById.set(row.purchase_order_id, list);
    }
  }

  const invoicesResult = await pool.query(
    `
      SELECT pi.id, pi.shop_id, pi.supplier_id, s.name AS supplier_name,
             pi.purchase_order_id, pi.invoice_number, pi.invoice_date, pi.due_date,
             pi.subtotal, pi.amount_paid, pi.status, pi.created_at, pi.updated_at
      FROM purchase_invoices pi
      JOIN suppliers s ON s.id = pi.supplier_id
      WHERE pi.shop_id = $1
      ORDER BY pi.invoice_date DESC, pi.created_at DESC
      LIMIT 250
    `,
    [shopId],
  );

  const invoiceIds = invoicesResult.rows.map((row) => row.id as string);
  const invoiceItemsById = new Map<string, ReturnType<typeof serializePurchaseLineItem>[]>();
  if (invoiceIds.length > 0) {
    const invoiceItems = await pool.query(
      `
        SELECT purchase_invoice_id, product_id, product_name, quantity, unit_cost
        FROM purchase_invoice_line_items
        WHERE purchase_invoice_id = ANY($1::uuid[])
      `,
      [invoiceIds],
    );
    for (const row of invoiceItems.rows) {
      const list = invoiceItemsById.get(row.purchase_invoice_id) ?? [];
      list.push(serializePurchaseLineItem(row));
      invoiceItemsById.set(row.purchase_invoice_id, list);
    }
  }

  const paymentsResult = await pool.query(
    `
      SELECT sp.id, sp.shop_id, sp.supplier_id, s.name AS supplier_name,
             sp.purchase_invoice_id, pi.invoice_number, sp.payment_date,
             sp.amount, sp.payment_method, sp.reference, sp.created_at
      FROM supplier_payments sp
      JOIN suppliers s ON s.id = sp.supplier_id
      JOIN purchase_invoices pi ON pi.id = sp.purchase_invoice_id
      WHERE sp.shop_id = $1
      ORDER BY sp.payment_date DESC, sp.created_at DESC
      LIMIT 250
    `,
    [shopId],
  );

  return {
    suppliers: suppliersResult.rows.map(serializeSupplier),
    purchaseOrders: ordersResult.rows.map((row) =>
      serializePurchaseOrder(row, orderItemsById.get(row.id) ?? []),
    ),
    purchaseInvoices: invoicesResult.rows.map((row) =>
      serializePurchaseInvoice(row, invoiceItemsById.get(row.id) ?? []),
    ),
    supplierPayments: paymentsResult.rows.map(serializeSupplierPayment),
  };
}

async function assertSupplier(shopId: string, supplierId: string) {
  const result = await pool.query("SELECT id FROM suppliers WHERE id = $1 AND shop_id = $2 LIMIT 1", [
    supplierId,
    shopId,
  ]);
  return Boolean(result.rowCount);
}

creditorsRouter.get("/", async (req, res) => {
  res.json(await fetchCreditorsPayload(req.auth!.shopId));
});

creditorsRouter.post("/suppliers", async (req, res) => {
  const parsed = supplierSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid supplier.");

  const input = parsed.data;
  const result = await pool.query(
    `
      INSERT INTO suppliers (id, shop_id, name, contact_name, phone, email)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id, shop_id, name, contact_name, phone, email, status, created_at, updated_at
    `,
    [
      crypto.randomUUID(),
      req.auth!.shopId,
      input.name.trim(),
      input.contactName?.trim() || null,
      input.phone?.trim() || null,
      input.email?.trim() || null,
    ],
  );

  res.status(201).json(serializeSupplier(result.rows[0]));
});

creditorsRouter.patch("/suppliers/:supplierId", async (req, res) => {
  const parsed = supplierPatchSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid supplier update.");

  const sets: string[] = [];
  const values: unknown[] = [];
  const push = (sql: string, value: unknown) => {
    values.push(value);
    sets.push(`${sql} = $${values.length + 2}`);
  };

  const patch = parsed.data;
  if (patch.name !== undefined) push("name", patch.name.trim());
  if (patch.contactName !== undefined) push("contact_name", patch.contactName.trim() || null);
  if (patch.phone !== undefined) push("phone", patch.phone.trim() || null);
  if (patch.email !== undefined) push("email", patch.email.trim() || null);
  if (patch.status !== undefined) push("status", patch.status);
  sets.push("updated_at = now()");

  const result = await pool.query(
    `
      UPDATE suppliers
      SET ${sets.join(", ")}
      WHERE id = $1 AND shop_id = $2
      RETURNING id, shop_id, name, contact_name, phone, email, status, created_at, updated_at
    `,
    [req.params.supplierId, req.auth!.shopId, ...values],
  );

  if (!result.rowCount) return sendApiError(res, 404, "not_found", "Supplier not found.");
  res.json(serializeSupplier(result.rows[0]));
});

creditorsRouter.post("/purchase-orders", async (req, res) => {
  const parsed = purchaseOrderSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid purchase order.");

  const shopId = req.auth!.shopId;
  const input = parsed.data;
  if (!(await assertSupplier(shopId, input.supplierId))) {
    return sendApiError(res, 404, "not_found", "Supplier not found.");
  }

  const total = input.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const productIds = input.items.map((item) => item.productId);
    const products = await client.query(
      "SELECT id FROM products WHERE shop_id = $1 AND id = ANY($2::uuid[])",
      [shopId, productIds],
    );
    if (products.rowCount !== new Set(productIds).size) {
      throw new Error("One or more products are not available for this shop.");
    }

    const orderId = crypto.randomUUID();
    let orderNumber = generateOrderNumber();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await client.query(
          `
            INSERT INTO purchase_orders (
              id, shop_id, supplier_id, order_number, order_date, expected_date, total
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7)
          `,
          [
            orderId,
            shopId,
            input.supplierId,
            orderNumber,
            input.orderDate,
            input.expectedDate || null,
            total,
          ],
        );
        break;
      } catch (err: any) {
        if (attempt === 2 || err?.code !== "23505") throw err;
        orderNumber = generateOrderNumber();
      }
    }

    for (const item of input.items) {
      await client.query(
        `
          INSERT INTO purchase_order_line_items (
            id, purchase_order_id, product_id, product_name, quantity, unit_cost
          )
          VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [
          crypto.randomUUID(),
          orderId,
          item.productId,
          item.productName.trim(),
          item.quantity,
          item.unitCost,
        ],
      );
    }

    await client.query("COMMIT");
    const payload = await fetchCreditorsPayload(shopId);
    res.status(201).json(payload.purchaseOrders.find((order) => order.id === orderId));
  } catch (err) {
    await client.query("ROLLBACK");
    const message = err instanceof Error ? err.message : "Purchase order failed.";
    return sendApiError(res, 400, "bad_request", message);
  } finally {
    client.release();
  }
});

creditorsRouter.patch("/purchase-orders/:orderId/status", async (req, res) => {
  const parsed = z.object({ status: z.enum(["draft", "ordered", "received", "cancelled"]) }).safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid order status.");

  const result = await pool.query(
    `
      UPDATE purchase_orders
      SET status = $3, updated_at = now()
      WHERE id = $1 AND shop_id = $2
    `,
    [req.params.orderId, req.auth!.shopId, parsed.data.status],
  );
  if (!result.rowCount) return sendApiError(res, 404, "not_found", "Purchase order not found.");
  const payload = await fetchCreditorsPayload(req.auth!.shopId);
  res.json(payload.purchaseOrders.find((order) => order.id === req.params.orderId));
});

creditorsRouter.post("/purchase-invoices", async (req, res) => {
  const parsed = purchaseInvoiceSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid purchase invoice.");

  const shopId = req.auth!.shopId;
  const input = parsed.data;
  if (!(await assertSupplier(shopId, input.supplierId))) {
    return sendApiError(res, 404, "not_found", "Supplier not found.");
  }

  const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const productIds = input.items.map((item) => item.productId);
    const products = await client.query(
      "SELECT id FROM products WHERE shop_id = $1 AND id = ANY($2::uuid[]) FOR UPDATE",
      [shopId, productIds],
    );
    if (products.rowCount !== new Set(productIds).size) {
      throw new Error("One or more products are not available for this shop.");
    }

    if (input.purchaseOrderId) {
      const order = await client.query(
        "SELECT id FROM purchase_orders WHERE id = $1 AND shop_id = $2 AND supplier_id = $3 LIMIT 1",
        [input.purchaseOrderId, shopId, input.supplierId],
      );
      if (!order.rowCount) throw new Error("Purchase order not found for this supplier.");
    }

    const invoiceId = crypto.randomUUID();
    await client.query(
      `
        INSERT INTO purchase_invoices (
          id, shop_id, supplier_id, purchase_order_id, invoice_number,
          invoice_date, due_date, subtotal
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `,
      [
        invoiceId,
        shopId,
        input.supplierId,
        input.purchaseOrderId ?? null,
        input.invoiceNumber.trim(),
        input.invoiceDate,
        input.dueDate || null,
        subtotal,
      ],
    );

    for (const item of input.items) {
      await client.query(
        `
          INSERT INTO purchase_invoice_line_items (
            id, purchase_invoice_id, product_id, product_name, quantity, unit_cost
          )
          VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [
          crypto.randomUUID(),
          invoiceId,
          item.productId,
          item.productName.trim(),
          item.quantity,
          item.unitCost,
        ],
      );
      await client.query(
        `
          UPDATE products
          SET quantity = quantity + $1, cost_price = $2, updated_at = now()
          WHERE id = $3 AND shop_id = $4
        `,
        [item.quantity, item.unitCost, item.productId, shopId],
      );
    }

    if (input.purchaseOrderId) {
      await client.query(
        "UPDATE purchase_orders SET status = 'received', updated_at = now() WHERE id = $1 AND shop_id = $2",
        [input.purchaseOrderId, shopId],
      );
    }

    await client.query("COMMIT");
    const payload = await fetchCreditorsPayload(shopId);
    res.status(201).json(payload.purchaseInvoices.find((invoice) => invoice.id === invoiceId));
  } catch (err: any) {
    await client.query("ROLLBACK");
    const message =
      err?.code === "23505"
        ? "Invoice number already exists."
        : err instanceof Error
          ? err.message
          : "Purchase invoice failed.";
    return sendApiError(res, 400, "bad_request", message);
  } finally {
    client.release();
  }
});

creditorsRouter.post("/payments", async (req, res) => {
  const parsed = supplierPaymentSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid supplier payment.");

  const shopId = req.auth!.shopId;
  const input = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const invoiceResult = await client.query(
      `
        SELECT id, supplier_id, subtotal, amount_paid
        FROM purchase_invoices
        WHERE id = $1 AND shop_id = $2
        FOR UPDATE
      `,
      [input.purchaseInvoiceId, shopId],
    );
    const invoice = invoiceResult.rows[0];
    if (!invoice) throw new Error("Purchase invoice not found.");

    const subtotal = Number(invoice.subtotal);
    const amountPaid = Number(invoice.amount_paid);
    const balance = subtotal - amountPaid;
    if (input.amount > balance) throw new Error("Payment is greater than invoice balance.");

    await client.query(
      `
        INSERT INTO supplier_payments (
          id, shop_id, supplier_id, purchase_invoice_id, payment_date,
          amount, payment_method, reference
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `,
      [
        crypto.randomUUID(),
        shopId,
        invoice.supplier_id,
        input.purchaseInvoiceId,
        input.paymentDate,
        input.amount,
        input.paymentMethod,
        input.reference?.trim() || null,
      ],
    );

    const nextPaid = amountPaid + input.amount;
    const status = nextPaid >= subtotal ? "paid" : "part_paid";
    await client.query(
      `
        UPDATE purchase_invoices
        SET amount_paid = $3, status = $4, updated_at = now()
        WHERE id = $1 AND shop_id = $2
      `,
      [input.purchaseInvoiceId, shopId, nextPaid, status],
    );

    await client.query("COMMIT");
    res.status(201).json(await fetchCreditorsPayload(shopId));
  } catch (err) {
    await client.query("ROLLBACK");
    const message = err instanceof Error ? err.message : "Supplier payment failed.";
    return sendApiError(res, 400, "bad_request", message);
  } finally {
    client.release();
  }
});
