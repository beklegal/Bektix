import express from "express";
import { z } from "zod";
import type { BusinessType, ShopPreferences } from "@shared/bektix";
import { requireUser } from "../auth/requireUser.js";
import { pool } from "../db/pool.js";
import { normalizeShopPreferences } from "../domain/preferences.js";
import { serializeShop } from "../domain/serializers.js";
import { sendApiError } from "../http/errors.js";

export const shopRouter = express.Router();
shopRouter.use(requireUser);

function requireAdmin(req: express.Request, res: express.Response) {
  if (req.auth?.role !== "admin") {
    sendApiError(res, 403, "forbidden", "Admins only.");
    return false;
  }
  return true;
}

shopRouter.get("/", async (req, res) => {
  const { shopId } = req.auth!;

  const result = await pool.query(
    "SELECT id, name, business_type, status, created_at, preferences FROM shops WHERE id = $1 LIMIT 1",
    [shopId],
  );
  const row = result.rows[0];
  if (!row) return sendApiError(res, 404, "not_found", "Shop not found.");
  res.json(serializeShop(row));
});

const updateShopSchema = z
  .object({
    name: z.string().min(1).optional(),
    businessType: z.enum(["pharmacy", "grocery", "clothing", "electronics", "other"]).optional(),
  })
  .refine((val) => Object.keys(val).length > 0, { message: "Empty patch." });

shopRouter.patch("/", async (req, res) => {
  const { shopId } = req.auth!;
  if (!requireAdmin(req, res)) return;

  const parsed = updateShopSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid update.");

  const sets: string[] = [];
  const values: unknown[] = [];
  const push = (sql: string, value: unknown) => {
    values.push(value);
    sets.push(`${sql} = $${values.length}`);
  };

  if (parsed.data.name !== undefined) push("name", parsed.data.name.trim());
  if (parsed.data.businessType !== undefined) push("business_type", parsed.data.businessType satisfies BusinessType);

  values.push(shopId);

  const result = await pool.query(
    `
      UPDATE shops
      SET ${sets.join(", ")}
      WHERE id = $${values.length}
      RETURNING id, name, business_type, status, created_at, preferences
    `,
    values,
  );

  res.json(serializeShop(result.rows[0]));
});

const updatePreferencesSchema = z
  .object({
    currency: z.string().min(1).optional(),
    enableExpiryTracking: z.boolean().optional(),
    enableProductVariants: z.boolean().optional(),
    enableLowStockAlerts: z.boolean().optional(),
    lowStockThreshold: z.number().int().min(1).optional(),
    taxRatePercent: z.number().min(0).optional(),
    autoPrintReceipt: z.boolean().optional(),
    receiptFooterMessage: z.string().optional(),
  })
  .refine((val) => Object.keys(val).length > 0, { message: "Empty patch." });

shopRouter.patch("/preferences", async (req, res) => {
  const { shopId } = req.auth!;
  if (!requireAdmin(req, res)) return;

  const parsed = updatePreferencesSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid preferences.");

  const current = await pool.query<{ preferences: unknown }>(
    "SELECT preferences FROM shops WHERE id = $1 LIMIT 1",
    [shopId],
  );
  const currentPref = normalizeShopPreferences(current.rows[0]?.preferences);
  const next: ShopPreferences = { ...currentPref, ...parsed.data };

  const result = await pool.query(
    `
      UPDATE shops
      SET preferences = $1
      WHERE id = $2
      RETURNING id, name, business_type, status, created_at, preferences
    `,
    [next, shopId],
  );

  res.json(serializeShop(result.rows[0]));
});

shopRouter.post("/reset-data", async (req, res) => {
  const { shopId, userId } = req.auth!;
  if (!requireAdmin(req, res)) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
        DELETE FROM sale_line_items
        WHERE sale_id IN (
          SELECT id FROM sales WHERE shop_id = $1
        )
      `,
      [shopId],
    );
    await client.query("DELETE FROM sales WHERE shop_id = $1", [shopId]);
    await client.query("DELETE FROM products WHERE shop_id = $1", [shopId]);
    await client.query("DELETE FROM users WHERE shop_id = $1 AND id <> $2 AND role <> 'admin'", [shopId, userId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  res.status(204).end();
});
