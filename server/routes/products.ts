import crypto from "node:crypto";
import express from "express";
import { z } from "zod";
import { requireUser } from "../auth/requireUser.js";
import { requireTenant } from "../auth/requireTenant.js";
import { pool } from "../db/pool.js";
import { serializeProduct } from "../domain/serializers.js";
import { sendApiError } from "../http/errors.js";

export const productsRouter = express.Router();
productsRouter.use(requireUser);
productsRouter.use(requireTenant);

const createProductSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  quantity: z.number().int().min(0),
  costPrice: z.number().min(0),
  sellingPrice: z.number().min(0),
  expiryDate: z.string().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  warranty: z.string().optional(),
});

productsRouter.get("/", async (req, res) => {
  const { shopId } = req.auth!;

  const result = await pool.query(
    `
      SELECT id, shop_id, name, category, quantity, cost_price, selling_price,
             expiry_date, size, color, warranty, created_at, updated_at
      FROM products
      WHERE shop_id = $1
      ORDER BY name ASC
    `,
    [shopId],
  );

  res.json(result.rows.map(serializeProduct));
});

productsRouter.post("/", async (req, res) => {
  const { shopId } = req.auth!;

  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid product.");

  const input = parsed.data;
  const id = crypto.randomUUID();

  const result = await pool.query(
    `
      INSERT INTO products (
        id, shop_id, name, category, quantity, cost_price, selling_price,
        expiry_date, size, color, warranty
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id, shop_id, name, category, quantity, cost_price, selling_price,
                expiry_date, size, color, warranty, created_at, updated_at
    `,
    [
      id,
      shopId,
      input.name.trim(),
      input.category.trim(),
      input.quantity,
      input.costPrice,
      input.sellingPrice,
      input.expiryDate ? input.expiryDate : null,
      input.size ? input.size : null,
      input.color ? input.color : null,
      input.warranty ? input.warranty : null,
    ],
  );

  res.status(201).json(serializeProduct(result.rows[0]));
});

const patchProductSchema = z
  .object({
    name: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    quantity: z.number().int().min(0).optional(),
    costPrice: z.number().min(0).optional(),
    sellingPrice: z.number().min(0).optional(),
    expiryDate: z.string().optional(),
    size: z.string().optional(),
    color: z.string().optional(),
    warranty: z.string().optional(),
  })
  .refine((val) => Object.keys(val).length > 0, { message: "Empty patch." });

productsRouter.patch("/:productId", async (req, res) => {
  const { shopId } = req.auth!;

  const parsed = patchProductSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid product update.");

  const { productId } = req.params;
  const patch = parsed.data;

  const sets: string[] = [];
  const values: unknown[] = [];
  const push = (sql: string, value: unknown) => {
    values.push(value);
    sets.push(`${sql} = $${values.length + 2}`);
  };

  if (patch.name !== undefined) push("name", patch.name.trim());
  if (patch.category !== undefined) push("category", patch.category.trim());
  if (patch.quantity !== undefined) push("quantity", patch.quantity);
  if (patch.costPrice !== undefined) push("cost_price", patch.costPrice);
  if (patch.sellingPrice !== undefined) push("selling_price", patch.sellingPrice);
  if (patch.expiryDate !== undefined) push("expiry_date", patch.expiryDate ? patch.expiryDate : null);
  if (patch.size !== undefined) push("size", patch.size ? patch.size : null);
  if (patch.color !== undefined) push("color", patch.color ? patch.color : null);
  if (patch.warranty !== undefined) push("warranty", patch.warranty ? patch.warranty : null);

  // Always touch updated_at
  sets.push("updated_at = now()");

  const result = await pool.query(
    `
      UPDATE products
      SET ${sets.join(", ")}
      WHERE id = $1 AND shop_id = $2
      RETURNING id, shop_id, name, category, quantity, cost_price, selling_price,
                expiry_date, size, color, warranty, created_at, updated_at
    `,
    [productId, shopId, ...values],
  );

  if (!result.rowCount) return sendApiError(res, 404, "not_found", "Product not found.");
  res.json(serializeProduct(result.rows[0]));
});

productsRouter.delete("/:productId", async (req, res) => {
  const { shopId } = req.auth!;

  const { productId } = req.params;
  const result = await pool.query(
    "DELETE FROM products WHERE id = $1 AND shop_id = $2",
    [productId, shopId],
  );
  if (!result.rowCount) return sendApiError(res, 404, "not_found", "Product not found.");

  res.status(204).end();
});
