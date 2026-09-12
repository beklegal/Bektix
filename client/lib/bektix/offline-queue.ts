export type QueuedSale = { idempotencyKey: string; items: Array<{ productId: string; quantity: number }>; paymentMethod: "cash" | "cheque"; payerType: "private" | "government" | "walkIn"; amountPaid: number; customerId?: string; queuedAt: string };
const key = "bektix-offline-sales-v1";
export function readQueuedSales(): QueuedSale[] { try { return JSON.parse(localStorage.getItem(key) || "[]") as QueuedSale[]; } catch { return []; } }
export function queueSale(sale: QueuedSale) { localStorage.setItem(key, JSON.stringify([...readQueuedSales(), sale])); }
export function removeQueuedSale(idempotencyKey: string) { localStorage.setItem(key, JSON.stringify(readQueuedSales().filter((sale) => sale.idempotencyKey !== idempotencyKey))); }
