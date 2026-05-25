import type {
  AuthLoginRequest,
  AuthResponse,
  CreateBankDepositRequest,
  CreateDebtorRequest,
  CreateEmployeeRequest,
  CreatePayrollRunRequest,
  CreateProductRequest,
  CreatePurchaseInvoiceRequest,
  CreatePurchaseOrderRequest,
  CreateSaleRequest,
  CreateSupplierPaymentRequest,
  CreateSupplierRequest,
  CreditorsPayload,
  PayrollPayload,
  UpdateBankDepositStatusRequest,
  CreateUserRequest,
  UpdateDebtorRequest,
  UpdateEmployeeRequest,
  UpdatePayrollRunRequest,
  UpdateProductRequest,
  UpdatePurchaseOrderStatusRequest,
  UpdateSupplierRequest,
} from "@shared/api";
import type { BankDeposit, Debtor, Product, Sale, Shop, ShopPreferences, User } from "@shared/bektix";

async function parseErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as any;
    if (typeof data?.message === "string") return data.message;
  } catch {
    // ignore
  }
  return `Request failed (${response.status})`;
}

async function apiRequest<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, headers, ...rest } = init ?? {};
  const response = await fetch(path, {
    ...rest,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  // 204 No Content
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  me: () => apiRequest<AuthResponse>("/api/auth/me"),
  login: (input: AuthLoginRequest) =>
    apiRequest<AuthResponse>("/api/auth/login", { method: "POST", json: input }),
  logout: () => apiRequest<void>("/api/auth/logout", { method: "POST" }),

  getShop: () => apiRequest<Shop>("/api/shop"),
  updateShop: (patch: { name?: string; businessType?: Shop["businessType"] }) =>
    apiRequest<Shop>("/api/shop", { method: "PATCH", json: patch }),
  updateShopPreferences: (patch: Partial<ShopPreferences>) =>
    apiRequest<Shop>("/api/shop/preferences", { method: "PATCH", json: patch }),
  resetSystemData: () => apiRequest<void>("/api/shop/reset-data", { method: "POST" }),

  getProducts: () => apiRequest<Product[]>("/api/products"),
  createProduct: (input: CreateProductRequest) =>
    apiRequest<Product>("/api/products", { method: "POST", json: input }),
  updateProduct: (productId: string, patch: UpdateProductRequest) =>
    apiRequest<Product>(`/api/products/${productId}`, { method: "PATCH", json: patch }),
  deleteProduct: (productId: string) =>
    apiRequest<void>(`/api/products/${productId}`, { method: "DELETE" }),

  getUsers: () => apiRequest<User[]>("/api/users"),
  createUser: (input: CreateUserRequest) =>
    apiRequest<User>("/api/users", { method: "POST", json: input }),
  toggleUserStatus: (userId: string) =>
    apiRequest<User>(`/api/users/${userId}/toggle-status`, { method: "POST" }),
  deleteUser: (userId: string) => apiRequest<void>(`/api/users/${userId}`, { method: "DELETE" }),

  getSales: () => apiRequest<Sale[]>("/api/sales"),
  createSale: (input: CreateSaleRequest) =>
    apiRequest<Sale>("/api/sales", { method: "POST", json: input }),
  getSale: (saleId: string) => apiRequest<Sale>(`/api/sales/${saleId}`),

  getDebtors: () => apiRequest<Debtor[]>("/api/debtors"),
  createDebtor: (input: CreateDebtorRequest) =>
    apiRequest<Debtor>("/api/debtors", { method: "POST", json: input }),
  updateDebtor: (debtorId: string, patch: UpdateDebtorRequest) =>
    apiRequest<Debtor>(`/api/debtors/${debtorId}`, { method: "PATCH", json: patch }),
  deleteDebtor: (debtorId: string) =>
    apiRequest<void>(`/api/debtors/${debtorId}`, { method: "DELETE" }),

  getPayroll: () => apiRequest<PayrollPayload>("/api/payroll"),
  createEmployee: (input: CreateEmployeeRequest) =>
    apiRequest<PayrollPayload["employees"][number]>("/api/payroll/employees", {
      method: "POST",
      json: input,
    }),
  updateEmployee: (employeeId: string, patch: UpdateEmployeeRequest) =>
    apiRequest<PayrollPayload["employees"][number]>(`/api/payroll/employees/${employeeId}`, {
      method: "PATCH",
      json: patch,
    }),
  createPayrollRun: (input: CreatePayrollRunRequest) =>
    apiRequest<PayrollPayload["runs"][number]>("/api/payroll/runs", { method: "POST", json: input }),
  updatePayrollRun: (runId: string, patch: UpdatePayrollRunRequest) =>
    apiRequest<PayrollPayload["runs"][number]>(`/api/payroll/runs/${runId}`, {
      method: "PATCH",
      json: patch,
    }),

  getCreditors: () => apiRequest<CreditorsPayload>("/api/creditors"),
  createSupplier: (input: CreateSupplierRequest) =>
    apiRequest<CreditorsPayload["suppliers"][number]>("/api/creditors/suppliers", {
      method: "POST",
      json: input,
    }),
  updateSupplier: (supplierId: string, patch: UpdateSupplierRequest) =>
    apiRequest<CreditorsPayload["suppliers"][number]>(`/api/creditors/suppliers/${supplierId}`, {
      method: "PATCH",
      json: patch,
    }),
  createPurchaseOrder: (input: CreatePurchaseOrderRequest) =>
    apiRequest<CreditorsPayload["purchaseOrders"][number]>("/api/creditors/purchase-orders", {
      method: "POST",
      json: input,
    }),
  updatePurchaseOrderStatus: (orderId: string, patch: UpdatePurchaseOrderStatusRequest) =>
    apiRequest<CreditorsPayload["purchaseOrders"][number]>(
      `/api/creditors/purchase-orders/${orderId}/status`,
      { method: "PATCH", json: patch },
    ),
  createPurchaseInvoice: (input: CreatePurchaseInvoiceRequest) =>
    apiRequest<CreditorsPayload["purchaseInvoices"][number]>("/api/creditors/purchase-invoices", {
      method: "POST",
      json: input,
    }),
  createSupplierPayment: (input: CreateSupplierPaymentRequest) =>
    apiRequest<CreditorsPayload>("/api/creditors/payments", { method: "POST", json: input }),

  getBankDeposits: () => apiRequest<BankDeposit[]>("/api/banking/deposits"),
  createBankDeposit: (input: CreateBankDepositRequest) =>
    apiRequest<BankDeposit>("/api/banking/deposits", { method: "POST", json: input }),
  updateBankDepositStatus: (depositId: string, patch: UpdateBankDepositStatusRequest) =>
    apiRequest<BankDeposit>(`/api/banking/deposits/${depositId}/status`, {
      method: "PATCH",
      json: patch,
    }),
};
