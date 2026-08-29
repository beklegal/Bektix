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

commerceRouter.get("/customers", async (req, res) => {
  const rows = await pool.query("SELECT id,name,phone,email,consent_marketing,created_at,updated_at FROM customers WHERE shop_id=$1 ORDER BY name LIMIT 250", [req.auth!.shopId]);
  res.json(rows.rows.map((r) => ({ id:r.id, name:r.name, phone:r.phone ?? undefined, email:r.email ?? undefined, consentMarketing:r.consent_marketing, createdAt:r.created_at, updatedAt:r.updated_at })));
});
commerceRouter.post("/customers", async (req, res) => {
  const parsed = customerSchema.safeParse(req.body); if (!parsed.success) return sendApiError(res,400,"bad_request","Invalid customer.");
  const c = await pool.connect(); try { await c.query("BEGIN"); const id=crypto.randomUUID(); const row=await c.query("INSERT INTO customers (id,shop_id,name,phone,email,consent_marketing) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,name,phone,email,consent_marketing,created_at,updated_at",[id,req.auth!.shopId,parsed.data.name.trim(),parsed.data.phone?.trim()||null,parsed.data.email?.trim()||null,parsed.data.consentMarketing??false]); await auditEvent(c,{shopId:req.auth!.shopId,branchId:req.auth!.branchId,userId:req.auth!.userId,entityType:"customer",entityId:id,action:"created"}); await c.query("COMMIT"); res.status(201).json(row.rows[0]); } catch(err) { await c.query("ROLLBACK"); throw err; } finally { c.release(); }
});
commerceRouter.get("/orders", async (req,res) => {
  const rows=await pool.query("SELECT id,customer_id,sale_id,source,status,subtotal,tax,total,created_at,updated_at FROM orders WHERE shop_id=$1 AND branch_id IS NOT DISTINCT FROM $2::uuid ORDER BY created_at DESC LIMIT 250",[req.auth!.shopId,req.auth!.branchId]); res.json(rows.rows);
});
commerceRouter.get("/inventory-movements", async (req,res) => {
  const rows=await pool.query("SELECT id,product_id,movement_type,quantity_delta,unit_cost,reference_type,reference_id,created_at FROM inventory_movements WHERE shop_id=$1 AND branch_id IS NOT DISTINCT FROM $2::uuid ORDER BY created_at DESC LIMIT 500",[req.auth!.shopId,req.auth!.branchId]); res.json(rows.rows);
});
