import express from "express";
import { pool } from "../db/pool.js";

/** Deliberately read-only: public checkout is introduced only after order fulfilment controls. */
export const publicStoreRouter = express.Router();
publicStoreRouter.get("/:slug", async (req, res) => {
  const storefront = await pool.query("SELECT s.name,s.business_type,s.preferences,st.shop_id FROM storefronts st JOIN shops s ON s.id=st.shop_id WHERE st.slug=$1 AND st.enabled=true AND s.status='active' LIMIT 1", [req.params.slug.toLowerCase()]);
  const row = storefront.rows[0];
  if (!row) return res.status(404).json({ error: "not_found", message: "Store not found." });
  const products = await pool.query("SELECT id,name,category,selling_price,quantity,size,color FROM products WHERE shop_id=$1 AND branch_id IS NULL AND quantity > 0 ORDER BY name LIMIT 250", [row.shop_id]);
  res.json({ shop: { name: row.name, businessType: row.business_type, currency: row.preferences?.currency ?? "GHS" }, products: products.rows.map((product) => ({ id: product.id, name: product.name, category: product.category, price: Number(product.selling_price), inStock: Number(product.quantity), size: product.size ?? undefined, color: product.color ?? undefined })) });
});
