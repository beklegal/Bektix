import crypto from "node:crypto";
import { env } from "../env.js";
import { hashPassword } from "../auth/password.js";
import { defaultShopPreferences, normalizeShopPreferences } from "../domain/preferences.js";
import { pool } from "./pool.js";

const BEKTIX_PLATFORM_SHOP_ID = "00000000-0000-4000-8000-000000000000";
const BEKTIX_PLATFORM_SHOP_NAME = "BEKTIX Platform";
const BEKTIX_SUPER_ADMIN_NAME = "BEKTIX Super Admin";

async function ensurePlatformShop() {
  const existing = await pool.query<{ id: string; preferences: unknown }>(
    "SELECT id, preferences FROM shops WHERE id = $1 LIMIT 1",
    [BEKTIX_PLATFORM_SHOP_ID],
  );

  const existingShop = existing.rows[0];
  if (existingShop) {
    const preferences = normalizeShopPreferences(existingShop.preferences);
    await pool.query(
      `
        UPDATE shops
        SET name = $1, business_type = 'other', status = 'active', features = '{}'::jsonb, preferences = $2
        WHERE id = $3
      `,
      [BEKTIX_PLATFORM_SHOP_NAME, { ...preferences, currency: preferences.currency || "GHS" }, existingShop.id],
    );
    return existingShop.id;
  }

  await pool.query(
    `
      INSERT INTO shops (id, name, business_type, status, features, preferences)
      VALUES ($1, $2, 'other', 'active', '{}'::jsonb, $3)
    `,
    [BEKTIX_PLATFORM_SHOP_ID, BEKTIX_PLATFORM_SHOP_NAME, defaultShopPreferences("GHS")],
  );
  return BEKTIX_PLATFORM_SHOP_ID;
}

export async function bootstrapSuperAdmin() {
  const shopId = await ensurePlatformShop();
  const email = env.SUPER_ADMIN_BOOTSTRAP_EMAIL?.trim();
  const password = env.SUPER_ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "SUPER_ADMIN_BOOTSTRAP_EMAIL and SUPER_ADMIN_BOOTSTRAP_PASSWORD are required to create the super admin account.",
    );
  }

  const emailLower = email.toLowerCase();
  const passwordHash = await hashPassword(password);
  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE email_lower = $1 LIMIT 1",
    [emailLower],
  );

  if (existing.rowCount && existing.rows[0]?.id) {
    await pool.query(
      `
        UPDATE users
        SET shop_id = $1,
            name = $2,
            email = $3,
            email_lower = $4,
            role = 'super_admin',
            status = 'active',
            password_hash = $5
        WHERE id = $6
      `,
      [shopId, BEKTIX_SUPER_ADMIN_NAME, email, emailLower, passwordHash, existing.rows[0].id],
    );
    return;
  }

  await pool.query(
    `
      INSERT INTO users (id, shop_id, name, email, email_lower, role, status, password_hash)
      VALUES ($1, $2, $3, $4, $5, 'super_admin', 'active', $6)
    `,
    [crypto.randomUUID(), shopId, BEKTIX_SUPER_ADMIN_NAME, email, emailLower, passwordHash],
  );
}
