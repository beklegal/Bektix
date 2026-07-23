import crypto from "node:crypto";
import express from "express";
import { z } from "zod";
import { requireUser } from "../auth/requireUser.js";
import { requireFeature } from "../auth/requireFeature.js";
import { pool } from "../db/pool.js";
import { serializeEmployee, serializePayrollRun } from "../domain/serializers.js";
import { sendApiError } from "../http/errors.js";

export const payrollRouter = express.Router();
payrollRouter.use(requireUser);
payrollRouter.use(requireFeature("payroll"));
payrollRouter.use((req, res, next) => {
  if (req.auth?.role !== "admin") {
    return sendApiError(res, 403, "forbidden", "Admin access required.");
  }
  next();
});

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const paymentMethodSchema = z.enum(["cash", "cheque"]);

const employeeSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  payType: z.enum(["salary", "hourly"]),
  basePay: z.number().min(0),
});

const employeePatchSchema = employeeSchema
  .partial()
  .extend({ status: z.enum(["active", "inactive"]).optional() })
  .refine((val) => Object.keys(val).length > 0, { message: "Empty patch." });

const payrollRunSchema = z.object({
  employeeId: z.string().uuid(),
  periodStart: dateSchema,
  periodEnd: dateSchema,
  payDate: dateSchema,
  grossPay: z.number().min(0),
  allowances: z.number().min(0),
  deductions: z.number().min(0),
  paymentMethod: paymentMethodSchema,
});

const payrollRunPatchSchema = payrollRunSchema
  .omit({ employeeId: true })
  .partial()
  .extend({ status: z.enum(["draft", "paid", "closed"]).optional() })
  .refine((val) => Object.keys(val).length > 0, { message: "Empty patch." });

async function fetchPayrollPayload(shopId: string) {
  const employeesResult = await pool.query(
    `
      SELECT id, shop_id, name, title, pay_type, base_pay, status, created_at, updated_at
      FROM employees
      WHERE shop_id = $1
      ORDER BY name ASC
    `,
    [shopId],
  );

  const runsResult = await pool.query(
    `
      SELECT pr.id, pr.shop_id, pr.employee_id, e.name AS employee_name,
             pr.period_start, pr.period_end, pr.pay_date, pr.gross_pay,
             pr.allowances, pr.deductions, pr.net_pay, pr.payment_method,
             pr.status, pr.created_at, pr.updated_at
      FROM payroll_runs pr
      JOIN employees e ON e.id = pr.employee_id
      WHERE pr.shop_id = $1
      ORDER BY pr.pay_date DESC, pr.created_at DESC
      LIMIT 250
    `,
    [shopId],
  );

  return {
    employees: employeesResult.rows.map(serializeEmployee),
    runs: runsResult.rows.map(serializePayrollRun),
  };
}

payrollRouter.get("/", async (req, res) => {
  res.json(await fetchPayrollPayload(req.auth!.shopId));
});

payrollRouter.post("/employees", async (req, res) => {
  const parsed = employeeSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid employee.");

  const input = parsed.data;
  const result = await pool.query(
    `
      INSERT INTO employees (id, shop_id, name, title, pay_type, base_pay)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id, shop_id, name, title, pay_type, base_pay, status, created_at, updated_at
    `,
    [
      crypto.randomUUID(),
      req.auth!.shopId,
      input.name.trim(),
      input.title.trim(),
      input.payType,
      input.basePay,
    ],
  );

  res.status(201).json(serializeEmployee(result.rows[0]));
});

payrollRouter.patch("/employees/:employeeId", async (req, res) => {
  const parsed = employeePatchSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid employee update.");

  const sets: string[] = [];
  const values: unknown[] = [];
  const push = (sql: string, value: unknown) => {
    values.push(value);
    sets.push(`${sql} = $${values.length + 2}`);
  };

  const patch = parsed.data;
  if (patch.name !== undefined) push("name", patch.name.trim());
  if (patch.title !== undefined) push("title", patch.title.trim());
  if (patch.payType !== undefined) push("pay_type", patch.payType);
  if (patch.basePay !== undefined) push("base_pay", patch.basePay);
  if (patch.status !== undefined) push("status", patch.status);
  sets.push("updated_at = now()");

  const result = await pool.query(
    `
      UPDATE employees
      SET ${sets.join(", ")}
      WHERE id = $1 AND shop_id = $2
      RETURNING id, shop_id, name, title, pay_type, base_pay, status, created_at, updated_at
    `,
    [req.params.employeeId, req.auth!.shopId, ...values],
  );

  if (!result.rowCount) return sendApiError(res, 404, "not_found", "Employee not found.");
  res.json(serializeEmployee(result.rows[0]));
});

payrollRouter.post("/runs", async (req, res) => {
  const parsed = payrollRunSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid payroll run.");

  const input = parsed.data;
  const netPay = input.grossPay + input.allowances - input.deductions;
  if (netPay < 0) return sendApiError(res, 400, "bad_request", "Net pay cannot be below 0.");

  const employee = await pool.query(
    "SELECT id FROM employees WHERE id = $1 AND shop_id = $2 LIMIT 1",
    [input.employeeId, req.auth!.shopId],
  );
  if (!employee.rowCount) return sendApiError(res, 404, "not_found", "Employee not found.");

  const result = await pool.query(
    `
      INSERT INTO payroll_runs (
        id, shop_id, employee_id, period_start, period_end, pay_date,
        gross_pay, allowances, deductions, net_pay, payment_method
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id
    `,
    [
      crypto.randomUUID(),
      req.auth!.shopId,
      input.employeeId,
      input.periodStart,
      input.periodEnd,
      input.payDate,
      input.grossPay,
      input.allowances,
      input.deductions,
      netPay,
      input.paymentMethod,
    ],
  );

  const payload = await fetchPayrollPayload(req.auth!.shopId);
  res.status(201).json(payload.runs.find((run) => run.id === result.rows[0].id));
});

payrollRouter.patch("/runs/:runId", async (req, res) => {
  const parsed = payrollRunPatchSchema.safeParse(req.body);
  if (!parsed.success) return sendApiError(res, 400, "bad_request", "Invalid payroll update.");

  const currentResult = await pool.query(
    `
      SELECT gross_pay, allowances, deductions
      FROM payroll_runs
      WHERE id = $1 AND shop_id = $2
      LIMIT 1
    `,
    [req.params.runId, req.auth!.shopId],
  );
  if (!currentResult.rowCount) return sendApiError(res, 404, "not_found", "Payroll run not found.");

  const current = currentResult.rows[0];
  const patch = parsed.data;
  const grossPay = patch.grossPay ?? Number(current.gross_pay);
  const allowances = patch.allowances ?? Number(current.allowances);
  const deductions = patch.deductions ?? Number(current.deductions);
  const netPay = grossPay + allowances - deductions;
  if (netPay < 0) return sendApiError(res, 400, "bad_request", "Net pay cannot be below 0.");

  const sets: string[] = [];
  const values: unknown[] = [];
  const push = (sql: string, value: unknown) => {
    values.push(value);
    sets.push(`${sql} = $${values.length + 2}`);
  };

  if (patch.periodStart !== undefined) push("period_start", patch.periodStart);
  if (patch.periodEnd !== undefined) push("period_end", patch.periodEnd);
  if (patch.payDate !== undefined) push("pay_date", patch.payDate);
  if (patch.grossPay !== undefined) push("gross_pay", patch.grossPay);
  if (patch.allowances !== undefined) push("allowances", patch.allowances);
  if (patch.deductions !== undefined) push("deductions", patch.deductions);
  if (patch.paymentMethod !== undefined) push("payment_method", patch.paymentMethod);
  if (patch.status !== undefined) push("status", patch.status);
  push("net_pay", netPay);
  sets.push("updated_at = now()");

  await pool.query(
    `
      UPDATE payroll_runs
      SET ${sets.join(", ")}
      WHERE id = $1 AND shop_id = $2
    `,
    [req.params.runId, req.auth!.shopId, ...values],
  );

  const payload = await fetchPayrollPayload(req.auth!.shopId);
  res.json(payload.runs.find((run) => run.id === req.params.runId));
});
