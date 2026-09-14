import crypto from "node:crypto";
import type { PoolClient } from "pg";

/** Minimal immutable double-entry postings. Accounts can later be mapped per tenant. */
export async function postCompletedSale(client: PoolClient, input: { shopId: string; branchId: string | null; saleId: string; paymentMethod: string; total: number; costOfGoods: number; itemCount: number }) {
  const entryId = crypto.randomUUID();
  const cashAccount = input.paymentMethod === "mobileMoney" ? "1102-mobile-money" : input.paymentMethod === "cheque" ? "1103-cheques" : "1101-cash";
  await client.query("INSERT INTO journal_entries (id,shop_id,branch_id,source_type,source_id,description) VALUES ($1,$2,$3,'sale',$4,$5) ON CONFLICT (shop_id,source_type,source_id) DO NOTHING", [entryId, input.shopId, input.branchId, input.saleId, "Completed sale"]);
  const existing = await client.query("SELECT id FROM journal_entries WHERE shop_id=$1 AND source_type='sale' AND source_id=$2", [input.shopId, input.saleId]);
  if (existing.rows[0]?.id !== entryId) return;
  const lines = [[cashAccount, input.total, 0], ["4000-sales-revenue", 0, input.total]];
  if (input.costOfGoods > 0) {
    lines.push(["5000-cost-of-goods-sold", input.costOfGoods, 0], ["1200-inventory", 0, input.costOfGoods]);
  }
  for (const [accountCode, debit, credit] of lines.filter(([, debit, credit]) => debit !== 0 || credit !== 0)) {
    await client.query("INSERT INTO journal_lines (id,journal_entry_id,account_code,debit,credit) VALUES ($1,$2,$3,$4,$5)", [crypto.randomUUID(), entryId, accountCode, debit, credit]);
  }
  await client.query("INSERT INTO daily_metrics (shop_id,branch_id,metric_date,sales_count,revenue,gross_profit,items_sold) VALUES ($1,$2,current_date,1,$3,$4,$5) ON CONFLICT (shop_id,branch_id,metric_date) DO UPDATE SET sales_count=daily_metrics.sales_count+1,revenue=daily_metrics.revenue+EXCLUDED.revenue,gross_profit=daily_metrics.gross_profit+EXCLUDED.gross_profit,items_sold=daily_metrics.items_sold+EXCLUDED.items_sold,updated_at=now()", [input.shopId, input.branchId, input.total, input.total - input.costOfGoods, input.itemCount]);
}
