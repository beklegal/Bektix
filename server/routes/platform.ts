import crypto from "node:crypto";
import express from "express";
import { z } from "zod";
import type { FeatureAccess } from "@shared/bektix";
import { requireUser } from "../auth/requireUser.js";
import { hashPassword } from "../auth/password.js";
import { defaultShopPreferences } from "../domain/preferences.js";
import {
  defaultFeatureAccess,
  normalizeFeatureAccess,
  serializeShop,
  serializeUser,
} from "../domain/serializers.js";
import { pool } from "../db/pool.js";
import { sendApiError } from "../http/errors.js";

export const platformRouter = express.Router();
platformRouter.use(requireUser);
platformRouter.use((req, res, next) => {
  if (req.auth?.role !== "super_admin") {
    return sendApiError(res, 403, "forbidden", "Super admin access required.");
  }
  next();
});

const featuresSchema = z.object({
  payroll: z.boolean().optional(),
  creditors: z.boolean().optional(),
  banking: z.boolean().optional(),
  debtors: z.boolean().optional(),
  reports: z.boolean().optional(),
  users: z.boolean().optional(),
});

const createTenantSchema = z.object({
  shopName: z.string().min(1),
  businessType: z.enum(["pharmacy", "grocery", "clothing", "electronics", "other"]),
  adminName: z.string().min(1),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(6),
  features: featuresSchema.default({}),
});

platformRouter.get("/tenants", async (_req, res) => {
  const result = await pool.query(
    `
      SELECT
        s.id,
        s.name,
        s.business_type,
        s.status,
        s.created_at,
        s.features,
        s.preferences,
        COUNT(u.id)::int AS user_count,
        (
          SELECT json_build_object(
            'id', au.id,
            'shop_id', au.shop_id,
            'name', au.name,
            'email', au.email,
            'role', au.role,
            'status', au.status,
            'created_at', au.created_at
          )
          FROM users au
          WHERE au.shop_id = s.id AND au.role = 'admin'
          ORDER BY au.created_at ASC
          LIMIT 1
        ) AS admin
      FROM shops s
      LEFT JOIN users u ON u.shop_id = s.id
      WHERE s.id <> '00000000-0000-4000-8000-000000000000'
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `,
  );

  res.json(
    result.rows.map((row) => ({
      shop: serializeShop(row),
      admin: row.admin ? serializeUser(row.admin) : null,
      userCount: Number(row.user_count),
    })),
  );
});

platformRouter.post("/tenants", async (req, res) => {
  const parsed = createTenantSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid tenant.");

  const adminEmailLower = parsed.data.adminEmail.trim().toLowerCase();
  const existing = await pool.query("SELECT id FROM users WHERE email_lower = $1 LIMIT 1", [adminEmailLower]);
  if (existing.rowCount) {
    return sendApiError(res, 409, "conflict", "A user with this email already exists.");
  }

  const shopId = crypto.randomUUID();
  const adminId = crypto.randomUUID();
  const features: FeatureAccess = normalizeFeatureAccess({ ...defaultFeatureAccess, ...parsed.data.features });
  const passwordHash = await hashPassword(parsed.data.adminPassword);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const shopResult = await client.query(
      `
        INSERT INTO shops (id, name, business_type, status, features, preferences)
        VALUES ($1, $2, $3, 'active', $4, $5)
        RETURNING id, name, business_type, status, created_at, features, preferences
      `,
      [shopId, parsed.data.shopName.trim(), parsed.data.businessType, features, defaultShopPreferences("GHS")],
    );
    const userResult = await client.query(
      `
        INSERT INTO users (id, shop_id, name, email, email_lower, role, status, password_hash)
        VALUES ($1, $2, $3, $4, $5, 'admin', 'active', $6)
        RETURNING id, shop_id, name, email, role, status, created_at
      `,
      [
        adminId,
        shopId,
        parsed.data.adminName.trim(),
        parsed.data.adminEmail.trim(),
        adminEmailLower,
        passwordHash,
      ],
    );
    await client.query("COMMIT");
    res.status(201).json({ shop: serializeShop(shopResult.rows[0]), admin: serializeUser(userResult.rows[0]), userCount: 1 });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

platformRouter.patch("/tenants/:shopId/status", async (req, res) => {
  const parsed = z.object({ status: z.enum(["active", "inactive"]) }).safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid status.");

  const result = await pool.query(
    `
      UPDATE shops
      SET status = $1, session_version = session_version + 1
      WHERE id = $2 AND id <> '00000000-0000-4000-8000-000000000000'
      RETURNING id, name, business_type, status, created_at, features, preferences
    `,
    [parsed.data.status, req.params.shopId],
  );
  if (!result.rowCount) return sendApiError(res, 404, "not_found", "Tenant not found.");
  res.json(serializeShop(result.rows[0]));
});

platformRouter.patch("/tenants/:shopId/features", async (req, res) => {
  const parsed = featuresSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid features.");

  const current = await pool.query(
    "SELECT features FROM shops WHERE id = $1 AND id <> '00000000-0000-4000-8000-000000000000' LIMIT 1",
    [req.params.shopId],
  );
  if (!current.rowCount) return sendApiError(res, 404, "not_found", "Tenant not found.");

  const features = normalizeFeatureAccess({ ...normalizeFeatureAccess(current.rows[0].features), ...parsed.data });
  const result = await pool.query(
    `
      UPDATE shops
      SET features = $1, session_version = session_version + 1
      WHERE id = $2
      RETURNING id, name, business_type, status, created_at, features, preferences
    `,
    [features, req.params.shopId],
  );
  res.json(serializeShop(result.rows[0]));
});
