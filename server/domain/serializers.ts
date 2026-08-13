import type {
  BankDeposit,
  BankDepositLineItem,
  Branch,
  Debtor,
  Employee,
  PayrollRun,
  Product,
  PurchaseInvoice,
  PurchaseLineItem,
  PurchaseOrder,
  Sale,
  SaleLineItem,
  Shop,
  FeatureAccess,
  ShopPreferences,
  Supplier,
  SupplierPayment,
  User,
} from "@shared/bektix";
import { normalizeShopPreferences } from "./preferences.js";

export const defaultFeatureAccess: FeatureAccess = {
  payroll: true,
  creditors: true,
  banking: true,
  debtors: true,
  reports: true,
  users: true,
};

export function normalizeFeatureAccess(value: unknown): FeatureAccess {
  const raw = value && typeof value === "object" ? (value as Partial<FeatureAccess>) : {};
  return {
    payroll: raw.payroll ?? true,
    creditors: raw.creditors ?? true,
    banking: raw.banking ?? true,
    debtors: raw.debtors ?? true,
    reports: raw.reports ?? true,
    users: raw.users ?? true,
  };
}

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
  features?: unknown;
  preferences: unknown;
}): Shop {
  return {
    id: row.id,
    name: row.name,
    businessType: row.business_type as Shop["businessType"],
    status: row.status as Shop["status"],
    features: normalizeFeatureAccess(row.features),
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
  branch_id?: string | null;
  permissions?: unknown;
}): User {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    email: row.email,
    role: row.role as User["role"],
    status: row.status as User["status"],
    createdAt: iso(row.created_at),
    branchId: row.branch_id ?? undefined,
    permissions: normalizeUserPermissions(row.permissions),
  };
}

export function normalizeUserPermissions(value: unknown): User["permissions"] {
  const raw = value && typeof value === "object" ? value as Partial<User["permissions"]> : {};
  return { manage_inventory: raw.manage_inventory ?? false, collect_payments: raw.collect_payments ?? false };
}

export function serializeBranch(row: {
  id: string;
  shop_id: string;
  name: string;
  location: string | null;
  status: string;
  created_at: unknown;
}): Branch {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    location: row.location ?? undefined,
    status: row.status as Branch["status"],
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

export function serializeEmployee(row: {
  id: string;
  shop_id: string;
  name: string;
  title: string;
  pay_type: string;
  base_pay: number;
  status: string;
  created_at: unknown;
  updated_at: unknown;
}): Employee {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    title: row.title,
    payType: row.pay_type as Employee["payType"],
    basePay: Number(row.base_pay),
    status: row.status as Employee["status"],
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function serializePayrollRun(row: {
  id: string;
  shop_id: string;
  employee_id: string;
  employee_name: string;
  period_start: unknown;
  period_end: unknown;
  pay_date: unknown;
  gross_pay: number;
  allowances: number;
  deductions: number;
  net_pay: number;
  payment_method: string;
  status: string;
  created_at: unknown;
  updated_at: unknown;
}): PayrollRun {
  return {
    id: row.id,
    shopId: row.shop_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    periodStart: iso(row.period_start).slice(0, 10),
    periodEnd: iso(row.period_end).slice(0, 10),
    payDate: iso(row.pay_date).slice(0, 10),
    grossPay: Number(row.gross_pay),
    allowances: Number(row.allowances),
    deductions: Number(row.deductions),
    netPay: Number(row.net_pay),
    paymentMethod: row.payment_method as PayrollRun["paymentMethod"],
    status: row.status as PayrollRun["status"],
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function serializeSupplier(row: {
  id: string;
  shop_id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  created_at: unknown;
  updated_at: unknown;
}): Supplier {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    contactName: row.contact_name ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    status: row.status as Supplier["status"],
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function serializePurchaseLineItem(row: {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
}): PurchaseLineItem {
  return {
    productId: row.product_id,
    productName: row.product_name,
    quantity: Number(row.quantity),
    unitCost: Number(row.unit_cost),
  };
}

export function serializePurchaseOrder(
  row: {
    id: string;
    shop_id: string;
    supplier_id: string;
    supplier_name: string;
    order_number: string;
    order_date: unknown;
    expected_date: unknown | null;
    status: string;
    total: number;
    created_at: unknown;
    updated_at: unknown;
  },
  items: PurchaseLineItem[],
): PurchaseOrder {
  return {
    id: row.id,
    shopId: row.shop_id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    orderNumber: row.order_number,
    orderDate: iso(row.order_date).slice(0, 10),
    expectedDate: row.expected_date ? iso(row.expected_date).slice(0, 10) : undefined,
    status: row.status as PurchaseOrder["status"],
    items,
    total: Number(row.total),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function serializePurchaseInvoice(
  row: {
    id: string;
    shop_id: string;
    supplier_id: string;
    supplier_name: string;
    purchase_order_id: string | null;
    invoice_number: string;
    invoice_date: unknown;
    due_date: unknown | null;
    subtotal: number;
    amount_paid: number;
    status: string;
    created_at: unknown;
    updated_at: unknown;
  },
  items: PurchaseLineItem[],
): PurchaseInvoice {
  const subtotal = Number(row.subtotal);
  const amountPaid = Number(row.amount_paid);
  return {
    id: row.id,
    shopId: row.shop_id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    purchaseOrderId: row.purchase_order_id ?? undefined,
    invoiceNumber: row.invoice_number,
    invoiceDate: iso(row.invoice_date).slice(0, 10),
    dueDate: row.due_date ? iso(row.due_date).slice(0, 10) : undefined,
    items,
    subtotal,
    amountPaid,
    balance: Math.max(0, subtotal - amountPaid),
    status: row.status as PurchaseInvoice["status"],
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function serializeSupplierPayment(row: {
  id: string;
  shop_id: string;
  supplier_id: string;
  supplier_name: string;
  purchase_invoice_id: string;
  invoice_number: string;
  payment_date: unknown;
  amount: number;
  payment_method: string;
  reference: string | null;
  created_at: unknown;
}): SupplierPayment {
  return {
    id: row.id,
    shopId: row.shop_id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    purchaseInvoiceId: row.purchase_invoice_id,
    invoiceNumber: row.invoice_number,
    paymentDate: iso(row.payment_date).slice(0, 10),
    amount: Number(row.amount),
    paymentMethod: row.payment_method as SupplierPayment["paymentMethod"],
    reference: row.reference ?? undefined,
    createdAt: iso(row.created_at),
  };
}

export function serializeBankDepositLineItem(row: {
  id: string;
  source_type: string;
  source_reference: string | null;
  description: string;
  payment_method: string;
  amount: number;
}): BankDepositLineItem {
  return {
    id: row.id,
    sourceType: row.source_type as BankDepositLineItem["sourceType"],
    sourceReference: row.source_reference ?? undefined,
    description: row.description,
    paymentMethod: row.payment_method as BankDepositLineItem["paymentMethod"],
    amount: Number(row.amount),
  };
}

export function serializeBankDeposit(
  row: {
    id: string;
    shop_id: string;
    deposit_date: unknown;
    bank_name: string;
    reference: string | null;
    status: string;
    created_at: unknown;
    updated_at: unknown;
  },
  lines: BankDepositLineItem[],
): BankDeposit {
  const totalCash = lines
    .filter((line) => line.paymentMethod === "cash")
    .reduce((sum, line) => sum + line.amount, 0);
  const totalCheque = lines
    .filter((line) => line.paymentMethod === "cheque")
    .reduce((sum, line) => sum + line.amount, 0);
  return {
    id: row.id,
    shopId: row.shop_id,
    depositDate: iso(row.deposit_date).slice(0, 10),
    bankName: row.bank_name,
    reference: row.reference ?? undefined,
    status: row.status as BankDeposit["status"],
    lines,
    totalCash,
    totalCheque,
    total: totalCash + totalCheque,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}
