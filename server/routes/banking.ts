import crypto from "node:crypto";
import express from "express";
import { z } from "zod";
import { requireUser } from "../auth/requireUser.js";
import { requireFeature } from "../auth/requireFeature.js";
import { pool } from "../db/pool.js";
import { serializeBankDeposit, serializeBankDepositLineItem } from "../domain/serializers.js";
import { sendApiError } from "../http/errors.js";

export const bankingRouter = express.Router();
bankingRouter.use(requireUser);
bankingRouter.use(requireFeature("banking"));
bankingRouter.use((req, res, next) => {
  if (req.auth?.role !== "admin") {
    return sendApiError(res, 403, "forbidden", "Admin access required.");
  }
  next();
});

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const depositSchema = z.object({
  depositDate: dateSchema,
  bankName: z.string().min(1),
  reference: z.string().optional(),
  status: z.enum(["draft", "sent", "confirmed"]).default("draft"),
  lines: z
    .array(
      z.object({
        sourceType: z.enum(["sale", "debtor_payment", "supplier_refund", "manual"]),
        sourceReference: z.string().optional(),
        description: z.string().min(1),
        paymentMethod: z.enum(["cash", "cheque"]),
        amount: z.number().min(0.01),
      }),
    )
    .min(1),
});

async function fetchBankDeposits(shopId: string) {
  const depositsResult = await pool.query(
    `
      SELECT id, shop_id, deposit_date, bank_name, reference, status, created_at, updated_at
      FROM bank_deposits
      WHERE shop_id = $1
      ORDER BY deposit_date DESC, created_at DESC
      LIMIT 250
    `,
    [shopId],
  );

  const depositIds = depositsResult.rows.map((row) => row.id as string);
  const linesByDeposit = new Map<string, ReturnType<typeof serializeBankDepositLineItem>[]>();
  if (depositIds.length > 0) {
    const linesResult = await pool.query(
      `
        SELECT bank_deposit_id, id, source_type, source_reference, description, payment_method, amount
        FROM bank_deposit_line_items
        WHERE bank_deposit_id = ANY($1::uuid[])
      `,
      [depositIds],
    );
    for (const row of linesResult.rows) {
      const list = linesByDeposit.get(row.bank_deposit_id) ?? [];
      list.push(serializeBankDepositLineItem(row));
      linesByDeposit.set(row.bank_deposit_id, list);
    }
  }

  return depositsResult.rows.map((row) => serializeBankDeposit(row, linesByDeposit.get(row.id) ?? []));
}

bankingRouter.get("/deposits", async (req, res) => {
  res.json(await fetchBankDeposits(req.auth!.shopId));
});

bankingRouter.post("/deposits", async (req, res) => {
  const parsed = depositSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid bank deposit.");

  const input = parsed.data;
  const shopId = req.auth!.shopId;
  const depositId = crypto.randomUUID();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `
        INSERT INTO bank_deposits (id, shop_id, deposit_date, bank_name, reference, status)
        VALUES ($1,$2,$3,$4,$5,$6)
      `,
      [
        depositId,
        shopId,
        input.depositDate,
        input.bankName.trim(),
        input.reference?.trim() || null,
        input.status,
      ],
    );

    for (const line of input.lines) {
      await client.query(
        `
          INSERT INTO bank_deposit_line_items (
            id, bank_deposit_id, source_type, source_reference,
            description, payment_method, amount
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7)
        `,
        [
          crypto.randomUUID(),
          depositId,
          line.sourceType,
          line.sourceReference?.trim() || null,
          line.description.trim(),
          line.paymentMethod,
          line.amount,
        ],
      );
    }

    await client.query("COMMIT");
    const deposits = await fetchBankDeposits(shopId);
    res.status(201).json(deposits.find((deposit) => deposit.id === depositId));
  } catch (err) {
    await client.query("ROLLBACK");
    const message = err instanceof Error ? err.message : "Bank deposit failed.";
    return sendApiError(res, 400, "bad_request", message);
  } finally {
    client.release();
  }
});

bankingRouter.patch("/deposits/:depositId/status", async (req, res) => {
  const parsed = z.object({ status: z.enum(["draft", "sent", "confirmed"]) }).safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid deposit status.");

  const result = await pool.query(
    `
      UPDATE bank_deposits
      SET status = $3, updated_at = now()
      WHERE id = $1 AND shop_id = $2
    `,
    [req.params.depositId, req.auth!.shopId, parsed.data.status],
  );
  if (!result.rowCount) return sendApiError(res, 404, "not_found", "Bank deposit not found.");

  const deposits = await fetchBankDeposits(req.auth!.shopId);
  res.json(deposits.find((deposit) => deposit.id === req.params.depositId));
});
