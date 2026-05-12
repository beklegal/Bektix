import crypto from "node:crypto";
import express from "express";
import { z } from "zod";
import type { UserRole, UserStatus } from "@shared/bektix";
import { requireUser } from "../auth/requireUser.js";
import { hashPassword } from "../auth/password.js";
import { pool } from "../db/pool.js";
import { serializeUser } from "../domain/serializers.js";
import { sendApiError } from "../http/errors.js";

export const usersRouter = express.Router();
usersRouter.use(requireUser);

function requireAdmin(req: express.Request, res: express.Response) {
  if (req.auth?.role !== "admin") {
    sendApiError(res, 403, "forbidden", "Admins only.");
    return false;
  }
  return true;
}

usersRouter.get("/", async (req, res) => {
  const { shopId } = req.auth!;

  const result = await pool.query(
    `
      SELECT id, shop_id, name, email, role, status, created_at
      FROM users
      WHERE shop_id = $1
      ORDER BY created_at DESC
    `,
    [shopId],
  );

  res.json(result.rows.map(serializeUser));
});

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["cashier", "staff"]),
});

usersRouter.post("/", async (req, res) => {
  const { shopId } = req.auth!;
  if (!requireAdmin(req, res)) return;

  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid user.");

  const emailLower = parsed.data.email.trim().toLowerCase();
  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE email_lower = $1 LIMIT 1",
    [emailLower],
  );
  if (existing.rowCount) {
    return sendApiError(res, 409, "conflict", "A user with this email already exists.");
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(parsed.data.password);

  const result = await pool.query(
    `
      INSERT INTO users (id, shop_id, name, email, email_lower, role, status, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, shop_id, name, email, role, status, created_at
    `,
    [
      id,
      shopId,
      parsed.data.name.trim(),
      parsed.data.email.trim(),
      emailLower,
      parsed.data.role satisfies UserRole,
      "active" satisfies UserStatus,
      passwordHash,
    ],
  );

  res.status(201).json(serializeUser(result.rows[0]));
});

usersRouter.post("/:userId/toggle-status", async (req, res) => {
  const { shopId } = req.auth!;
  if (!requireAdmin(req, res)) return;

  const { userId } = req.params;

  const target = await pool.query<{
    id: string;
    role: string;
    status: string;
  }>(
    "SELECT id, role, status FROM users WHERE id = $1 AND shop_id = $2 LIMIT 1",
    [userId, shopId],
  );

  const row = target.rows[0];
  if (!row) return sendApiError(res, 404, "not_found", "User not found.");
  if (row.role === "admin") return sendApiError(res, 400, "bad_request", "Admin cannot be deactivated here.");

  const nextStatus: UserStatus = row.status === "active" ? "inactive" : "active";

  const updated = await pool.query(
    `
      UPDATE users
      SET status = $1, session_version = session_version + 1
      WHERE id = $2 AND shop_id = $3
      RETURNING id, shop_id, name, email, role, status, created_at
    `,
    [nextStatus, userId, shopId],
  );

  res.json(serializeUser(updated.rows[0]));
});

usersRouter.delete("/:userId", async (req, res) => {
  const { shopId, userId: adminUserId } = req.auth!;
  if (!requireAdmin(req, res)) return;

  const { userId } = req.params;
  const target = await pool.query<{ id: string; role: string }>(
    "SELECT id, role FROM users WHERE id = $1 AND shop_id = $2 LIMIT 1",
    [userId, shopId],
  );
  const row = target.rows[0];
  if (!row) return sendApiError(res, 404, "not_found", "User not found.");
  if (row.role === "admin") return sendApiError(res, 400, "bad_request", "Admin cannot be deleted.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE sales SET cashier_user_id = $1 WHERE cashier_user_id = $2 AND shop_id = $3",
      [adminUserId, userId, shopId],
    );
    await client.query("DELETE FROM users WHERE id = $1 AND shop_id = $2", [userId, shopId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  res.status(204).end();
});
