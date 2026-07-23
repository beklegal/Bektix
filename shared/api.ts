import type {
  BankDeposit,
  Branch,
  Debtor,
  Employee,
  PayrollRun,
  Product,
  PurchaseInvoice,
  PurchaseLineItem,
  PurchaseOrder,
  Sale,
  Shop,
  SimplePaymentMethod,
  Supplier,
  SupplierPayment,
  User,
} from "./bektix";

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "payload_too_large"
  | "too_many_requests"
  | "internal_error";

export interface ApiErrorResponse {
  error: ApiErrorCode;
  message: string;
}

export interface AuthSession {
  userId: string;
  shopId: string;
}

export interface AuthLoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  session: AuthSession;
  user: User;
  shop: Shop;
}

export interface PlatformTenant {
  shop: Shop;
  admin: User | null;
  userCount: number;
  branches: Branch[];
  branchCount: number;
}

export interface CreateTenantRequest {
  shopName: string;
  businessType: Shop["businessType"];
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  features: Partial<Shop["features"]>;
}

export type UpdateTenantFeaturesRequest = Partial<Shop["features"]>;
export type UpdateTenantStatusRequest = Pick<Shop, "status">;

export interface CreateBranchRequest {
  name: string;
  location?: string;
}

export interface CreateProductRequest
  extends Pick<
    Product,
    | "name"
    | "category"
    | "quantity"
    | "costPrice"
    | "sellingPrice"
    | "expiryDate"
    | "size"
    | "color"
    | "warranty"
  > {}

export type UpdateProductRequest = Partial<CreateProductRequest>;

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: Exclude<User["role"], "admin" | "super_admin">;
}

export interface CreateSaleRequest {
  items: Array<{ productId: string; quantity: number }>;
  paymentMethod: Sale["paymentMethod"];
  payerType: Sale["payerType"];
  amountPaid: number;
}

export interface CreateDebtorRequest
  extends Pick<Debtor, "name" | "date" | "invoiceNumber" | "amount"> {}

export type UpdateDebtorRequest = Partial<
  Pick<Debtor, "name" | "date" | "invoiceNumber" | "amount" | "status">
>;

export interface CreateEmployeeRequest
  extends Pick<Employee, "name" | "title" | "payType" | "basePay"> {}

export type UpdateEmployeeRequest = Partial<
  Pick<Employee, "name" | "title" | "payType" | "basePay" | "status">
>;

export interface CreatePayrollRunRequest
  extends Pick<
    PayrollRun,
    | "employeeId"
    | "periodStart"
    | "periodEnd"
    | "payDate"
    | "grossPay"
    | "allowances"
    | "deductions"
    | "paymentMethod"
  > {}

export type UpdatePayrollRunRequest = Partial<
  Pick<
    PayrollRun,
    | "periodStart"
    | "periodEnd"
    | "payDate"
    | "grossPay"
    | "allowances"
    | "deductions"
    | "paymentMethod"
    | "status"
  >
>;

export interface PayrollPayload {
  employees: Employee[];
  runs: PayrollRun[];
}

export interface CreateSupplierRequest
  extends Pick<Supplier, "name" | "contactName" | "phone" | "email"> {}

export type UpdateSupplierRequest = Partial<
  Pick<Supplier, "name" | "contactName" | "phone" | "email" | "status">
>;

export interface CreatePurchaseOrderRequest {
  supplierId: string;
  orderDate: string;
  expectedDate?: string;
  items: PurchaseLineItem[];
}

export type UpdatePurchaseOrderStatusRequest = Pick<PurchaseOrder, "status">;

export interface CreatePurchaseInvoiceRequest {
  supplierId: string;
  purchaseOrderId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  items: PurchaseLineItem[];
}

export interface CreateSupplierPaymentRequest {
  purchaseInvoiceId: string;
  paymentDate: string;
  amount: number;
  paymentMethod: SimplePaymentMethod;
  reference?: string;
}

export interface CreditorsPayload {
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  purchaseInvoices: PurchaseInvoice[];
  supplierPayments: SupplierPayment[];
}

export interface CreateBankDepositRequest
  extends Pick<BankDeposit, "depositDate" | "bankName" | "reference" | "status"> {
  lines: Array<Omit<BankDeposit["lines"][number], "id">>;
}

export type UpdateBankDepositStatusRequest = Pick<BankDeposit, "status">;
