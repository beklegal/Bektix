export type BusinessType =
  | "pharmacy"
  | "grocery"
  | "clothing"
  | "electronics"
  | "other";

export type TenantFeature = "payroll" | "creditors" | "banking" | "debtors" | "reports" | "users";
export type FeatureAccess = Record<TenantFeature, boolean>;
export type UserRole = "super_admin" | "admin" | "cashier" | "staff";
export type UserStatus = "active" | "inactive";

export type PaymentMethod = "cash" | "mobileMoney" | "cheque";
export type PayerType = "private" | "government" | "walkIn";
export type DebtorStatus = "unpaid" | "paid";
export type SimplePaymentMethod = "cash" | "cheque";
export type EmployeePayType = "salary" | "hourly";
export type EmployeeStatus = "active" | "inactive";
export type PayrollRunStatus = "draft" | "paid" | "closed";
export type PurchaseOrderStatus = "draft" | "ordered" | "received" | "cancelled";
export type PurchaseInvoiceStatus = "unpaid" | "part_paid" | "paid";
export type BankDepositStatus = "draft" | "sent" | "confirmed";
export type BankDepositSourceType =
  | "sale"
  | "debtor_payment"
  | "supplier_refund"
  | "manual";

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
  features: FeatureAccess;
  createdAt: string; // ISO
  preferences: ShopPreferences;
}

export interface Branch {
  id: string;
  shopId: string;
  name: string;
  location?: string;
  status: ShopStatus;
  createdAt: string;
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

export interface Employee {
  id: string;
  shopId: string;
  name: string;
  title: string;
  payType: EmployeePayType;
  basePay: number;
  status: EmployeeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollRun {
  id: string;
  shopId: string;
  employeeId: string;
  employeeName: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  grossPay: number;
  allowances: number;
  deductions: number;
  netPay: number;
  paymentMethod: SimplePaymentMethod;
  status: PayrollRunStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  shopId: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  status: EmployeeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseLineItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
}

export interface PurchaseOrder {
  id: string;
  shopId: string;
  supplierId: string;
  supplierName: string;
  orderNumber: string;
  orderDate: string;
  expectedDate?: string;
  status: PurchaseOrderStatus;
  items: PurchaseLineItem[];
  total: number;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseInvoice {
  id: string;
  shopId: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  items: PurchaseLineItem[];
  subtotal: number;
  amountPaid: number;
  balance: number;
  status: PurchaseInvoiceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPayment {
  id: string;
  shopId: string;
  supplierId: string;
  supplierName: string;
  purchaseInvoiceId: string;
  invoiceNumber: string;
  paymentDate: string;
  amount: number;
  paymentMethod: SimplePaymentMethod;
  reference?: string;
  createdAt: string;
}

export interface BankDepositLineItem {
  id: string;
  sourceType: BankDepositSourceType;
  sourceReference?: string;
  description: string;
  paymentMethod: SimplePaymentMethod;
  amount: number;
}

export interface BankDeposit {
  id: string;
  shopId: string;
  depositDate: string;
  bankName: string;
  reference?: string;
  status: BankDepositStatus;
  lines: BankDepositLineItem[];
  totalCash: number;
  totalCheque: number;
  total: number;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  userId: string;
  shopId: string;
}
