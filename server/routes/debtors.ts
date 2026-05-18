import crypto from "node:crypto";
import express from "express";
import { z } from "zod";
import { requireUser } from "../auth/requireUser.js";
import { pool } from "../db/pool.js";
import { serializeDebtor } from "../domain/serializers.js";
import { sendApiError } from "../http/errors.js";

export const debtorsRouter = express.Router();
debtorsRouter.use(requireUser);

const debtorBaseSchema = {
  name: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  invoiceNumber: z.string().min(1),
  amount: z.number().min(0),
};

const createDebtorSchema = z.object(debtorBaseSchema);

const patchDebtorSchema = z
  .object({
    name: debtorBaseSchema.name.optional(),
    date: debtorBaseSchema.date.optional(),
    invoiceNumber: debtorBaseSchema.invoiceNumber.optional(),
    amount: debtorBaseSchema.amount.optional(),
    status: z.enum(["unpaid", "paid"]).optional(),
  })
  .refine((val) => Object.keys(val).length > 0, { message: "Empty patch." });

debtorsRouter.get("/", async (req, res) => {
  const { shopId } = req.auth!;

  const result = await pool.query(
    `
      SELECT id, shop_id, name, date, invoice_number, amount, status, created_at, updated_at
      FROM debtors
      WHERE shop_id = $1
      ORDER BY date DESC, created_at DESC
    `,
    [shopId],
  );

  res.json(result.rows.map(serializeDebtor));
});

debtorsRouter.post("/", async (req, res) => {
  const { shopId } = req.auth!;

  const parsed = createDebtorSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid debtor.");

  const input = parsed.data;
  const result = await pool.query(
    `
      INSERT INTO debtors (id, shop_id, name, date, invoice_number, amount)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id, shop_id, name, date, invoice_number, amount, status, created_at, updated_at
    `,
    [
      crypto.randomUUID(),
      shopId,
      input.name.trim(),
      input.date,
      input.invoiceNumber.trim(),
      input.amount,
    ],
  );

  res.status(201).json(serializeDebtor(result.rows[0]));
});

debtorsRouter.patch("/:debtorId", async (req, res) => {
  const { shopId } = req.auth!;

  const parsed = patchDebtorSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid debtor update.");

  const sets: string[] = [];
  const values: unknown[] = [];
  const push = (sql: string, value: unknown) => {
    values.push(value);
    sets.push(`${sql} = $${values.length + 2}`);
  };

  const patch = parsed.data;
  if (patch.name !== undefined) push("name", patch.name.trim());
  if (patch.date !== undefined) push("date", patch.date);
  if (patch.invoiceNumber !== undefined) push("invoice_number", patch.invoiceNumber.trim());
  if (patch.amount !== undefined) push("amount", patch.amount);
  if (patch.status !== undefined) push("status", patch.status);
  sets.push("updated_at = now()");

  const result = await pool.query(
    `
      UPDATE debtors
      SET ${sets.join(", ")}
      WHERE id = $1 AND shop_id = $2
      RETURNING id, shop_id, name, date, invoice_number, amount, status, created_at, updated_at
    `,
    [req.params.debtorId, shopId, ...values],
  );

  if (!result.rowCount) return sendApiError(res, 404, "not_found", "Debtor not found.");
  res.json(serializeDebtor(result.rows[0]));
});

debtorsRouter.delete("/:debtorId", async (req, res) => {
  const { shopId } = req.auth!;

  const result = await pool.query("DELETE FROM debtors WHERE id = $1 AND shop_id = $2", [
    req.params.debtorId,
    shopId,
  ]);
  if (!result.rowCount) return sendApiError(res, 404, "not_found", "Debtor not found.");

  res.status(204).end();
});
