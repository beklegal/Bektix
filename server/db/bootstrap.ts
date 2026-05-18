import crypto from "node:crypto";
import { env } from "../env.js";
import { hashPassword } from "../auth/password.js";
import { defaultShopPreferences, normalizeShopPreferences } from "../domain/preferences.js";
import { pool } from "./pool.js";

const JILKEM_SHOP_ID = "00000000-0000-4000-8000-000000000001";
const JILKEM_SHOP_NAME = "Jilkem Company Limited";
const JILKEM_OWNER_NAME = "Samuel Kissi";

async function ensureJilkemShop() {
  const existing = await pool.query<{ id: string; preferences: unknown }>(
    "SELECT id, preferences FROM shops ORDER BY created_at ASC LIMIT 1",
  );

  const existingShop = existing.rows[0];
  if (existingShop) {
    const preferences = normalizeShopPreferences(existingShop.preferences);
    await pool.query(
      `
        UPDATE shops
        SET name = $1, business_type = 'other', status = 'active', preferences = $2
        WHERE id = $3
      `,
      [JILKEM_SHOP_NAME, { ...preferences, currency: preferences.currency || "GH₵" }, existingShop.id],
    );
    return existingShop.id;
  }

  await pool.query(
    `
      INSERT INTO shops (id, name, business_type, status, preferences)
      VALUES ($1, $2, 'other', 'active', $3)
    `,
    [JILKEM_SHOP_ID, JILKEM_SHOP_NAME, defaultShopPreferences("GH₵")],
  );
  return JILKEM_SHOP_ID;
}

export async function bootstrapSingleShop() {
  const shopId = await ensureJilkemShop();
  const email = env.OWNER_BOOTSTRAP_EMAIL?.trim();
  const password = env.OWNER_BOOTSTRAP_PASSWORD;
  if (!email || !password) return;

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
            role = 'admin',
            status = 'active',
            password_hash = $5
        WHERE id = $6
      `,
      [shopId, JILKEM_OWNER_NAME, email, emailLower, passwordHash, existing.rows[0].id],
    );
    return;
  }

  await pool.query(
    `
      INSERT INTO users (id, shop_id, name, email, email_lower, role, status, password_hash)
      VALUES ($1, $2, $3, $4, $5, 'admin', 'active', $6)
    `,
    [crypto.randomUUID(), shopId, JILKEM_OWNER_NAME, email, emailLower, passwordHash],
  );
}
