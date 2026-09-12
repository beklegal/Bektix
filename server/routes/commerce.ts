import crypto from "node:crypto";
import express from "express";
import { z } from "zod";
import { requireUser } from "../auth/requireUser.js";
import { requireTenant } from "../auth/requireTenant.js";
import { pool } from "../db/pool.js";
import { sendApiError } from "../http/errors.js";
import { auditEvent } from "../domain/commerce.js";

export const commerceRouter = express.Router();
commerceRouter.use(requireUser, requireTenant);
const customerSchema = z.object({ name: z.string().min(1).max(160), phone: z.string().max(30).optional(), email: z.string().email().optional(), consentMarketing: z.boolean().optional() });
const storefrontSchema = z.object({ slug: z.string().min(3).max(60).regex(/^[a-z0-9-]+$/), enabled: z.boolean() });
const integrationSchema = z.object({ provider: z.enum(["whatsapp", "meta", "tiktok", "linkedin", "delivery"]), status: z.enum(["disconnected", "pending_setup"]), settings: z.record(z.string(), z.string().max(200)).default({}) });

commerceRouter.get("/customers", async (req, res) => {
  const rows = await pool.query("SELECT id,name,phone,email,consent_marketing,created_at,updated_at FROM customers WHERE shop_id=$1 ORDER BY name LIMIT 250", [req.auth!.shopId]);
  res.json(rows.rows.map((r) => ({ id:r.id, name:r.name, phone:r.phone ?? undefined, email:r.email ?? undefined, consentMarketing:r.consent_marketing, createdAt:r.created_at, updatedAt:r.updated_at })));
});
commerceRouter.post("/customers", async (req, res) => {
  const parsed = customerSchema.safeParse(req.body); if (!parsed.success) return sendApiError(res,400,"bad_request","Invalid customer.");
  const c = await pool.connect(); try { await c.query("BEGIN"); const id=crypto.randomUUID(); const row=await c.query("INSERT INTO customers (id,shop_id,name,phone,email,consent_marketing) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,name,phone,email,consent_marketing,created_at,updated_at",[id,req.auth!.shopId,parsed.data.name.trim(),parsed.data.phone?.trim()||null,parsed.data.email?.trim()||null,parsed.data.consentMarketing??false]); await auditEvent(c,{shopId:req.auth!.shopId,branchId:req.auth!.branchId,userId:req.auth!.userId,entityType:"customer",entityId:id,action:"created"}); await c.query("COMMIT"); res.status(201).json(row.rows[0]); } catch(err) { await c.query("ROLLBACK"); throw err; } finally { c.release(); }
});
commerceRouter.patch("/customers/:customerId", async (req, res) => {
  const parsed = customerSchema.partial().refine((value) => Object.keys(value).length > 0).safeParse(req.body); if (!parsed.success) return sendApiError(res,400,"bad_request","Invalid customer update.");
  const result = await pool.query("UPDATE customers SET name=COALESCE($3,name),phone=COALESCE($4,phone),email=COALESCE($5,email),consent_marketing=COALESCE($6,consent_marketing),updated_at=now() WHERE id=$1 AND shop_id=$2 RETURNING id,name,phone,email,consent_marketing,created_at,updated_at", [req.params.customerId, req.auth!.shopId, parsed.data.name?.trim() ?? null, parsed.data.phone?.trim() ?? null, parsed.data.email?.trim() ?? null, parsed.data.consentMarketing ?? null]);
  if (!result.rowCount) return sendApiError(res,404,"not_found","Customer not found."); res.json(result.rows[0]);
});
commerceRouter.get("/customers/:customerId/history", async (req, res) => {
  const customer = await pool.query("SELECT id FROM customers WHERE id=$1 AND shop_id=$2", [req.params.customerId, req.auth!.shopId]); if (!customer.rowCount) return sendApiError(res,404,"not_found","Customer not found.");
  const orders = await pool.query("SELECT id,sale_id,status,total,created_at FROM orders WHERE shop_id=$1 AND customer_id=$2 ORDER BY created_at DESC LIMIT 100", [req.auth!.shopId, req.params.customerId]); res.json(orders.rows);
});
commerceRouter.get("/storefront", async (req, res) => {
  if (req.auth!.role !== "admin") return sendApiError(res,403,"forbidden","Admins only."); const row = await pool.query("SELECT slug,enabled FROM storefronts WHERE shop_id=$1", [req.auth!.shopId]); res.json(row.rows[0] ?? { slug: "", enabled: false });
});
commerceRouter.put("/storefront", async (req, res) => {
  if (req.auth!.role !== "admin") return sendApiError(res,403,"forbidden","Admins only."); const parsed=storefrontSchema.safeParse(req.body); if(!parsed.success)return sendApiError(res,400,"bad_request","Use a lowercase store slug with letters, numbers, and hyphens.");
  const row=await pool.query("INSERT INTO storefronts (id,shop_id,slug,enabled) VALUES ($1,$2,$3,$4) ON CONFLICT (shop_id) DO UPDATE SET slug=EXCLUDED.slug,enabled=EXCLUDED.enabled,updated_at=now() RETURNING slug,enabled",[crypto.randomUUID(),req.auth!.shopId,parsed.data.slug,parsed.data.enabled]); res.json(row.rows[0]);
});
commerceRouter.get("/integrations", async (req,res) => { if(req.auth!.role!=="admin")return sendApiError(res,403,"forbidden","Admins only."); const rows=await pool.query("SELECT provider,category,status,settings,updated_at FROM integration_accounts WHERE shop_id=$1 ORDER BY provider",[req.auth!.shopId]); res.json(rows.rows); });
commerceRouter.put("/integrations", async (req,res) => { if(req.auth!.role!=="admin")return sendApiError(res,403,"forbidden","Admins only.");const parsed=integrationSchema.safeParse(req.body);if(!parsed.success)return sendApiError(res,400,"bad_request","Invalid integration setup.");const category=parsed.data.provider==="whatsapp"?"messaging":parsed.data.provider==="delivery"?"delivery":"social";const row=await pool.query("INSERT INTO integration_accounts (id,shop_id,provider,category,status,settings) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (shop_id,provider) DO UPDATE SET status=EXCLUDED.status,settings=EXCLUDED.settings,updated_at=now() RETURNING provider,category,status,settings,updated_at",[crypto.randomUUID(),req.auth!.shopId,parsed.data.provider,category,parsed.data.status,JSON.stringify(parsed.data.settings)]);res.json(row.rows[0]); });
commerceRouter.get("/orders", async (req,res) => {
  const rows=await pool.query("SELECT id,customer_id,sale_id,source,status,subtotal,tax,total,created_at,updated_at FROM orders WHERE shop_id=$1 AND branch_id IS NOT DISTINCT FROM $2::uuid ORDER BY created_at DESC LIMIT 250",[req.auth!.shopId,req.auth!.branchId]); res.json(rows.rows);
});
commerceRouter.get("/inventory-movements", async (req,res) => {
  const rows=await pool.query("SELECT id,product_id,movement_type,quantity_delta,unit_cost,reference_type,reference_id,created_at FROM inventory_movements WHERE shop_id=$1 AND branch_id IS NOT DISTINCT FROM $2::uuid ORDER BY created_at DESC LIMIT 500",[req.auth!.shopId,req.auth!.branchId]); res.json(rows.rows);
});
commerceRouter.get("/analytics/daily", async (req, res) => {
  const rows = await pool.query("SELECT metric_date,sales_count,revenue,gross_profit,items_sold FROM daily_metrics WHERE shop_id=$1 AND branch_id IS NOT DISTINCT FROM $2::uuid ORDER BY metric_date DESC LIMIT 90", [req.auth!.shopId, req.auth!.branchId]);
  res.json(rows.rows);
});
commerceRouter.get("/accounting/journal", async (req, res) => {
  if (req.auth!.role !== "admin") return sendApiError(res, 403, "forbidden", "Admins only.");
  const rows = await pool.query("SELECT id,source_type,source_id,description,entry_date,created_at FROM journal_entries WHERE shop_id=$1 AND branch_id IS NOT DISTINCT FROM $2::uuid ORDER BY created_at DESC LIMIT 250", [req.auth!.shopId, req.auth!.branchId]);
  res.json(rows.rows);
});
commerceRouter.get("/assistant/insights", async (req, res) => {
  if (req.auth!.role !== "admin") return sendApiError(res, 403, "forbidden", "Admins only.");
  const [metrics, lowStock] = await Promise.all([
    pool.query("SELECT COALESCE(sum(revenue),0) revenue,COALESCE(sum(gross_profit),0) gross_profit,COALESCE(sum(sales_count),0)::int sales_count FROM daily_metrics WHERE shop_id=$1 AND branch_id IS NOT DISTINCT FROM $2::uuid AND metric_date >= current_date - interval '30 days'", [req.auth!.shopId, req.auth!.branchId]),
    pool.query("SELECT name,quantity FROM products WHERE shop_id=$1 AND branch_id IS NOT DISTINCT FROM $2::uuid AND quantity <= 10 ORDER BY quantity ASC,name ASC LIMIT 5", [req.auth!.shopId, req.auth!.branchId]),
  ]);
  const data = metrics.rows[0];
  res.json({ period: "last_30_days", revenue: Number(data.revenue), grossProfit: Number(data.gross_profit), salesCount: Number(data.sales_count), lowStock: lowStock.rows.map((row) => ({ name: row.name, quantity: Number(row.quantity) })), insights: [`Recorded revenue is ${Number(data.revenue).toFixed(2)} across ${Number(data.sales_count)} completed sales.`, lowStock.rowCount ? `${lowStock.rowCount} products require stock attention.` : "No products are currently below the default low-stock threshold."] });
});
