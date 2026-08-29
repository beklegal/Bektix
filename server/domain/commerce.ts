import crypto from "node:crypto";
import type { PoolClient } from "pg";

export async function inventoryMovement(client: PoolClient, input: { shopId: string; branchId: string | null; productId: string; type: string; delta: number; unitCost?: number; referenceType: string; referenceId?: string; userId?: string }) {
  await client.query("INSERT INTO inventory_movements (id,shop_id,branch_id,product_id,movement_type,quantity_delta,unit_cost,reference_type,reference_id,created_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [crypto.randomUUID(), input.shopId, input.branchId, input.productId, input.type, input.delta, input.unitCost ?? null, input.referenceType, input.referenceId ?? null, input.userId ?? null]);
}
export async function auditEvent(client: PoolClient, input: { shopId: string; branchId?: string | null; userId?: string; entityType: string; entityId?: string; action: string; metadata?: unknown }) {
  await client.query("INSERT INTO audit_events (id,shop_id,branch_id,user_id,entity_type,entity_id,action,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [crypto.randomUUID(),input.shopId,input.branchId ?? null,input.userId ?? null,input.entityType,input.entityId ?? null,input.action,JSON.stringify(input.metadata ?? {})]);
}
export async function outboxEvent(client: PoolClient, shopId: string, topic: string, aggregateType: string, aggregateId: string, payload: unknown) {
  await client.query("INSERT INTO outbox_events (id,shop_id,topic,aggregate_type,aggregate_id,payload) VALUES ($1,$2,$3,$4,$5,$6)",[crypto.randomUUID(),shopId,topic,aggregateType,aggregateId,JSON.stringify(payload)]);
}
