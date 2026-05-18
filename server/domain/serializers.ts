import type { Debtor, Product, Sale, SaleLineItem, Shop, ShopPreferences, User } from "@shared/bektix";
import { normalizeShopPreferences } from "./preferences.js";

function iso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return new Date(value as string).toISOString();
}

export function serializeShop(row: {
  id: string;
  name: string;
  business_type: string;
  status: string;
  created_at: unknown;
  preferences: unknown;
}): Shop {
  return {
    id: row.id,
    name: row.name,
    businessType: row.business_type as Shop["businessType"],
    status: row.status as Shop["status"],
    createdAt: iso(row.created_at),
    preferences: normalizeShopPreferences(row.preferences),
  };
}

export function serializeUser(row: {
  id: string;
  shop_id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: unknown;
}): User {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    email: row.email,
    role: row.role as User["role"],
    status: row.status as User["status"],
    createdAt: iso(row.created_at),
  };
}

export function serializeProduct(row: {
  id: string;
  shop_id: string;
  name: string;
  category: string;
  quantity: number;
  cost_price: number;
  selling_price: number;
  expiry_date: string | null;
  size: string | null;
  color: string | null;
  warranty: string | null;
  created_at: unknown;
  updated_at: unknown;
}): Product {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    category: row.category,
    quantity: row.quantity,
    costPrice: row.cost_price,
    sellingPrice: row.selling_price,
    expiryDate: row.expiry_date ?? undefined,
    size: row.size ?? undefined,
    color: row.color ?? undefined,
    warranty: row.warranty ?? undefined,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function serializeSale(
  saleRow: {
    id: string;
    shop_id: string;
    receipt_number: string;
    created_at: unknown;
    cashier_user_id: string;
    cashier_name: string;
    subtotal: number;
    tax: number;
    total: number;
    amount_paid: number;
    change: number;
    payment_method: string;
    payer_type: string;
  },
  lineItems: SaleLineItem[],
): Sale {
  return {
    id: saleRow.id,
    shopId: saleRow.shop_id,
    receiptNumber: saleRow.receipt_number,
    createdAt: iso(saleRow.created_at),
    cashierUserId: saleRow.cashier_user_id,
    cashierName: saleRow.cashier_name,
    items: lineItems,
    subtotal: saleRow.subtotal,
    tax: saleRow.tax,
    total: saleRow.total,
    amountPaid: saleRow.amount_paid,
    change: saleRow.change,
    paymentMethod: saleRow.payment_method as Sale["paymentMethod"],
    payerType: saleRow.payer_type as Sale["payerType"],
  };
}

export function serializeDebtor(row: {
  id: string;
  shop_id: string;
  name: string;
  date: unknown;
  invoice_number: string;
  amount: number;
  status: string;
  created_at: unknown;
  updated_at: unknown;
}): Debtor {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    date: iso(row.date).slice(0, 10),
    invoiceNumber: row.invoice_number,
    amount: row.amount,
    status: row.status as Debtor["status"],
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function serializeSaleLineItem(row: {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
}): SaleLineItem {
  return {
    productId: row.product_id,
    name: row.name,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    unitCost: row.unit_cost,
  };
}
