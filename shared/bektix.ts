export type BusinessType =
  | "pharmacy"
  | "grocery"
  | "clothing"
  | "electronics"
  | "other";

export type UserRole = "admin" | "cashier" | "staff";
export type UserStatus = "active" | "inactive";

export type PaymentMethod = "cash" | "mobileMoney" | "cheque";
export type PayerType = "private" | "government" | "walkIn";
export type DebtorStatus = "unpaid" | "paid";

export type ShopStatus = "active" | "inactive";

export interface ShopPreferences {
  currency: string; // e.g. "GH₵", "$", "€"
  enableExpiryTracking: boolean;
  enableProductVariants: boolean;
  enableLowStockAlerts: boolean;
  lowStockThreshold: number;
  taxRatePercent: number;
  autoPrintReceipt: boolean;
  receiptFooterMessage: string;
}

export interface Shop {
  id: string;
  name: string;
  businessType: BusinessType;
  status?: ShopStatus;
  createdAt: string; // ISO
  preferences: ShopPreferences;
}

export interface User {
  id: string;
  shopId: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  password?: string; // write-only input (never returned by the API)
  createdAt: string; // ISO
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  category: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  expiryDate?: string; // ISO date
  size?: string;
  color?: string;
  warranty?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface SaleLineItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
}

export interface Sale {
  id: string;
  shopId: string;
  receiptNumber: string;
  createdAt: string; // ISO
  cashierUserId: string;
  cashierName: string;
  items: SaleLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  change: number;
  paymentMethod: PaymentMethod;
  payerType: PayerType;
}

export interface Debtor {
  id: string;
  shopId: string;
  name: string;
  date: string; // ISO date
  invoiceNumber: string;
  amount: number;
  status: DebtorStatus;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface Session {
  userId: string;
  shopId: string;
}
