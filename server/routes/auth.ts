import express from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { verifyPassword } from "../auth/password.js";
import {
  clearUserSessionCookie,
  getUserSession,
  setUserSessionCookie,
  signUserSession,
} from "../auth/session.js";
import { requireUser } from "../auth/requireUser.js";
import { serializeShop, serializeUser } from "../domain/serializers.js";
import { sendApiError } from "../http/errors.js";
import { loginRateLimit } from "../http/security.js";

export const authRouter = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", loginRateLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendApiError(res, 400, "bad_request", "Invalid login details.");
  }

  const emailLower = parsed.data.email.trim().toLowerCase();
  const userResult = await pool.query<{
    id: string;
    shop_id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    session_version: number;
    password_hash: string;
    created_at: unknown;
  }>(
    `
      SELECT id, shop_id, name, email, role, status, session_version, password_hash, created_at
      FROM users
      WHERE email_lower = $1
      LIMIT 1
    `,
    [emailLower],
  );

  const userRow = userResult.rows[0];
  if (!userRow) return sendApiError(res, 401, "unauthorized", "Account not found.");
  if (userRow.status !== "active") {
    return sendApiError(res, 403, "forbidden", "This user is inactive.");
  }

  const ok = await verifyPassword(parsed.data.password, userRow.password_hash);
  if (!ok) return sendApiError(res, 401, "unauthorized", "Incorrect password.");

  const shopResult = await pool.query(
    "SELECT id, name, business_type, status, created_at, features, preferences, session_version FROM shops WHERE id = $1 LIMIT 1",
    [userRow.shop_id],
  );
  const shopRow = shopResult.rows[0];
  if (!shopRow) return sendApiError(res, 401, "unauthorized", "Shop not found for this account.");
  if (shopRow.status !== "active") {
    return sendApiError(res, 403, "forbidden", "This shop is inactive.");
  }

  const user = serializeUser(userRow);
  const shop = serializeShop(shopRow);

  const token = signUserSession({
    userId: user.id,
    shopId: shop.id,
    userSessionVersion: Number(userRow.session_version ?? 0),
    shopSessionVersion: Number(shopRow.session_version ?? 0),
  });
  setUserSessionCookie(res, token);

  res.json({ session: { userId: user.id, shopId: shop.id }, user, shop });
});

authRouter.post("/logout", async (_req, res) => {
  clearUserSessionCookie(res);
  res.status(204).end();
});

authRouter.get("/me", (req, res, next) => {
  if (!getUserSession(req)) {
    clearUserSessionCookie(res);
    return res.json(null);
  }
  return next();
}, requireUser, async (req, res) => {
  const auth = req.auth!;
  res.json({
    session: { userId: auth.userId, shopId: auth.shopId },
    user: auth.user,
    shop: auth.shop,
  });
});
