import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BankDeposit,
  Debtor,
  Employee,
  PaymentMethod,
  PayerType,
  PayrollRun,
  Product,
  PurchaseInvoice,
  PurchaseLineItem,
  PurchaseOrder,
  Sale,
  Session,
  ShopPreferences,
  Supplier,
  SupplierPayment,
  TenantFeature,
  User,
  UserRole,
} from "@shared/bektix";
import type { AuthResponse, PlatformTenant } from "@shared/api";
import type { BusinessType, Shop } from "@shared/bektix";
import { api } from "@/lib/bektix/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type BektixContextValue = {
  authStatus: AuthStatus;
  session: Session | null;
  user: User | null;
  shop: Shop | null;
  products: Product[];
  users: User[];
  sales: Sale[];
  debtors: Debtor[];
  employees: Employee[];
  payrollRuns: PayrollRun[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  purchaseInvoices: PurchaseInvoice[];
  supplierPayments: SupplierPayment[];
  bankDeposits: BankDeposit[];
  tenants: PlatformTenant[];
  actions: {
    login: (input: { email: string; password: string }) => Promise<AuthResponse>;
    logout: () => Promise<void>;
    createTenant: (input: {
      shopName: string;
      businessType: BusinessType;
      adminName: string;
      adminEmail: string;
      adminPassword: string;
      features: Partial<Record<TenantFeature, boolean>>;
    }) => Promise<void>;
    updateTenantStatus: (shopId: string, status: Shop["status"]) => Promise<void>;
    updateTenantFeatures: (shopId: string, features: Partial<Record<TenantFeature, boolean>>) => Promise<void>;
    createBranch: (shopId: string, input: { name: string; location?: string }) => Promise<void>;
    updateShopDetails: (patch: { name?: string; businessType?: BusinessType }) => Promise<void>;
    updateShopPreferences: (patch: Partial<ShopPreferences>) => Promise<void>;
    resetSystemData: () => Promise<void>;
    addProduct: (input: Omit<Product, "id" | "createdAt" | "updatedAt">) => Promise<void>;
    updateProduct: (
      productId: string,
      patch: Partial<Omit<Product, "id" | "shopId" | "createdAt">>,
    ) => Promise<void>;
    deleteProduct: (productId: string) => Promise<void>;
    addUser: (input: {
      name: string;
      email: string;
      password: string;
      role: UserRole;
    }) => Promise<void>;
    toggleUserStatus: (userId: string) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
    createSale: (input: {
      items: Array<{ productId: string; quantity: number }>;
      paymentMethod: PaymentMethod;
      payerType: PayerType;
      amountPaid: number;
    }) => Promise<{ saleId: string }>;
    addDebtor: (input: Pick<Debtor, "name" | "date" | "invoiceNumber" | "amount">) => Promise<void>;
    updateDebtor: (
      debtorId: string,
      patch: Partial<Pick<Debtor, "name" | "date" | "invoiceNumber" | "amount" | "status">>,
    ) => Promise<void>;
    deleteDebtor: (debtorId: string) => Promise<void>;
    addEmployee: (input: Pick<Employee, "name" | "title" | "payType" | "basePay">) => Promise<void>;
    updateEmployee: (
      employeeId: string,
      patch: Partial<Pick<Employee, "name" | "title" | "payType" | "basePay" | "status">>,
    ) => Promise<void>;
    addPayrollRun: (
      input: Pick<
        PayrollRun,
        | "employeeId"
        | "periodStart"
        | "periodEnd"
        | "payDate"
        | "grossPay"
        | "allowances"
        | "deductions"
        | "paymentMethod"
      >,
    ) => Promise<void>;
    updatePayrollRun: (
      runId: string,
      patch: Partial<
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
      >,
    ) => Promise<void>;
    addSupplier: (input: Pick<Supplier, "name" | "contactName" | "phone" | "email">) => Promise<void>;
    updateSupplier: (
      supplierId: string,
      patch: Partial<Pick<Supplier, "name" | "contactName" | "phone" | "email" | "status">>,
    ) => Promise<void>;
    addPurchaseOrder: (input: {
      supplierId: string;
      orderDate: string;
      expectedDate?: string;
      items: PurchaseLineItem[];
    }) => Promise<void>;
    updatePurchaseOrderStatus: (orderId: string, status: PurchaseOrder["status"]) => Promise<void>;
    addPurchaseInvoice: (input: {
      supplierId: string;
      purchaseOrderId?: string;
      invoiceNumber: string;
      invoiceDate: string;
      dueDate?: string;
      items: PurchaseLineItem[];
    }) => Promise<void>;
    addSupplierPayment: (input: {
      purchaseInvoiceId: string;
      paymentDate: string;
      amount: number;
      paymentMethod: PayrollRun["paymentMethod"];
      reference?: string;
    }) => Promise<void>;
    addBankDeposit: (input: {
      depositDate: string;
      bankName: string;
      reference?: string;
      status: BankDeposit["status"];
      lines: Array<Omit<BankDeposit["lines"][number], "id">>;
    }) => Promise<void>;
    updateBankDepositStatus: (depositId: string, status: BankDeposit["status"]) => Promise<void>;
  };
};

const BektixContext = React.createContext<BektixContextValue | null>(null);
const LIVE_SYNC_INTERVAL_MS = 5_000;

export function BektixProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const meQuery = useQuery<AuthResponse | null>({
    queryKey: ["auth", "me"],
    queryFn: api.me,
    retry: false,
  });

  const authStatus: AuthStatus = meQuery.isPending
    ? "loading"
    : meQuery.isSuccess && meQuery.data
      ? "authenticated"
      : "unauthenticated";

  const session = meQuery.data?.session ?? null;
  const user = meQuery.data?.user ?? null;
  const shop = meQuery.data?.shop ?? null;
  const isTenantUser = authStatus === "authenticated" && user?.role !== "super_admin";
  const isSuperAdmin = authStatus === "authenticated" && user?.role === "super_admin";

  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: api.getProducts,
    enabled: isTenantUser,
    refetchInterval: LIVE_SYNC_INTERVAL_MS,
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
  });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: api.getUsers,
    enabled: isTenantUser && Boolean(shop?.features.users),
    refetchInterval: LIVE_SYNC_INTERVAL_MS,
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
  });

  const salesQuery = useQuery({
    queryKey: ["sales"],
    queryFn: api.getSales,
    enabled: isTenantUser,
    refetchInterval: LIVE_SYNC_INTERVAL_MS,
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
  });

  const debtorsQuery = useQuery({
    queryKey: ["debtors"],
    queryFn: api.getDebtors,
    enabled: isTenantUser && Boolean(shop?.features.debtors),
    refetchInterval: LIVE_SYNC_INTERVAL_MS,
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
  });

  const payrollQuery = useQuery({
    queryKey: ["payroll"],
    queryFn: api.getPayroll,
    enabled: isTenantUser && user?.role === "admin" && Boolean(shop?.features.payroll),
    refetchInterval: LIVE_SYNC_INTERVAL_MS,
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
  });

  const creditorsQuery = useQuery({
    queryKey: ["creditors"],
    queryFn: api.getCreditors,
    enabled: isTenantUser && user?.role === "admin" && Boolean(shop?.features.creditors),
    refetchInterval: LIVE_SYNC_INTERVAL_MS,
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
  });

  const bankDepositsQuery = useQuery({
    queryKey: ["bankDeposits"],
    queryFn: api.getBankDeposits,
    enabled: isTenantUser && user?.role === "admin" && Boolean(shop?.features.banking),
    refetchInterval: LIVE_SYNC_INTERVAL_MS,
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
  });

  const tenantsQuery = useQuery({
    queryKey: ["platform", "tenants"],
    queryFn: api.getTenants,
    enabled: isSuperAdmin,
    refetchInterval: LIVE_SYNC_INTERVAL_MS,
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
  });

  const actions = React.useMemo<BektixContextValue["actions"]>(() => {
    return {
      login: async ({ email, password }) => {
        const payload = await api.login({ email, password });
        queryClient.setQueryData(["auth", "me"], payload);
        await queryClient.invalidateQueries({ queryKey: ["products"] });
        await queryClient.invalidateQueries({ queryKey: ["users"] });
        await queryClient.invalidateQueries({ queryKey: ["sales"] });
        await queryClient.invalidateQueries({ queryKey: ["debtors"] });
        await queryClient.invalidateQueries({ queryKey: ["payroll"] });
        await queryClient.invalidateQueries({ queryKey: ["creditors"] });
        await queryClient.invalidateQueries({ queryKey: ["bankDeposits"] });
        await queryClient.invalidateQueries({ queryKey: ["platform", "tenants"] });
        return payload;
      },
      logout: async () => {
        await api.logout();
        queryClient.setQueryData(["auth", "me"], null);
        queryClient.removeQueries({ queryKey: ["products"] });
        queryClient.removeQueries({ queryKey: ["users"] });
        queryClient.removeQueries({ queryKey: ["sales"] });
        queryClient.removeQueries({ queryKey: ["debtors"] });
        queryClient.removeQueries({ queryKey: ["payroll"] });
        queryClient.removeQueries({ queryKey: ["creditors"] });
        queryClient.removeQueries({ queryKey: ["bankDeposits"] });
        queryClient.removeQueries({ queryKey: ["platform", "tenants"] });
      },
      createTenant: async (input) => {
        await api.createTenant(input);
        await queryClient.invalidateQueries({ queryKey: ["platform", "tenants"] });
      },
      updateTenantStatus: async (shopId, status) => {
        await api.updateTenantStatus(shopId, { status });
        await queryClient.invalidateQueries({ queryKey: ["platform", "tenants"] });
      },
      updateTenantFeatures: async (shopId, features) => {
        await api.updateTenantFeatures(shopId, features);
        await queryClient.invalidateQueries({ queryKey: ["platform", "tenants"] });
      },
      createBranch: async (shopId, input) => {
        await api.createBranch(shopId, input);
        await queryClient.invalidateQueries({ queryKey: ["platform", "tenants"] });
      },
      updateShopDetails: async (patch) => {
        const nextShop = await api.updateShop(patch);
        queryClient.setQueryData(["auth", "me"], (prev: any) => (prev ? { ...prev, shop: nextShop } : prev));
        await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      },
      updateShopPreferences: async (patch) => {
        const nextShop = await api.updateShopPreferences(patch);
        queryClient.setQueryData(["auth", "me"], (prev: any) => (prev ? { ...prev, shop: nextShop } : prev));
        await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      },
      resetSystemData: async () => {
        await api.resetSystemData();
        await queryClient.invalidateQueries({ queryKey: ["products"] });
        await queryClient.invalidateQueries({ queryKey: ["users"] });
        await queryClient.invalidateQueries({ queryKey: ["sales"] });
        await queryClient.invalidateQueries({ queryKey: ["debtors"] });
        await queryClient.invalidateQueries({ queryKey: ["payroll"] });
        await queryClient.invalidateQueries({ queryKey: ["creditors"] });
        await queryClient.invalidateQueries({ queryKey: ["bankDeposits"] });
      },
      addProduct: async (input) => {
        await api.createProduct(input);
        await queryClient.invalidateQueries({ queryKey: ["products"] });
      },
      updateProduct: async (productId, patch) => {
        await api.updateProduct(productId, patch);
        await queryClient.invalidateQueries({ queryKey: ["products"] });
      },
      deleteProduct: async (productId) => {
        await api.deleteProduct(productId);
        await queryClient.invalidateQueries({ queryKey: ["products"] });
      },
      addUser: async ({ name, email, password, role }) => {
        if (role === "admin" || role === "super_admin") throw new Error("Admin accounts cannot be created here.");
        await api.createUser({ name, email, password, role });
        await queryClient.invalidateQueries({ queryKey: ["users"] });
      },
      toggleUserStatus: async (userId) => {
        await api.toggleUserStatus(userId);
        await queryClient.invalidateQueries({ queryKey: ["users"] });
      },
      deleteUser: async (userId) => {
        await api.deleteUser(userId);
        await queryClient.invalidateQueries({ queryKey: ["users"] });
      },
      createSale: async ({ items, paymentMethod, payerType, amountPaid }) => {
        const sale = await api.createSale({ items, paymentMethod, payerType, amountPaid });
        await queryClient.invalidateQueries({ queryKey: ["sales"] });
        await queryClient.invalidateQueries({ queryKey: ["products"] });
        return { saleId: sale.id };
      },
      addDebtor: async (input) => {
        await api.createDebtor(input);
        await queryClient.invalidateQueries({ queryKey: ["debtors"] });
      },
      updateDebtor: async (debtorId, patch) => {
        await api.updateDebtor(debtorId, patch);
        await queryClient.invalidateQueries({ queryKey: ["debtors"] });
      },
      deleteDebtor: async (debtorId) => {
        await api.deleteDebtor(debtorId);
        await queryClient.invalidateQueries({ queryKey: ["debtors"] });
      },
      addEmployee: async (input) => {
        await api.createEmployee(input);
        await queryClient.invalidateQueries({ queryKey: ["payroll"] });
      },
      updateEmployee: async (employeeId, patch) => {
        await api.updateEmployee(employeeId, patch);
        await queryClient.invalidateQueries({ queryKey: ["payroll"] });
      },
      addPayrollRun: async (input) => {
        await api.createPayrollRun(input);
        await queryClient.invalidateQueries({ queryKey: ["payroll"] });
      },
      updatePayrollRun: async (runId, patch) => {
        await api.updatePayrollRun(runId, patch);
        await queryClient.invalidateQueries({ queryKey: ["payroll"] });
      },
      addSupplier: async (input) => {
        await api.createSupplier(input);
        await queryClient.invalidateQueries({ queryKey: ["creditors"] });
      },
      updateSupplier: async (supplierId, patch) => {
        await api.updateSupplier(supplierId, patch);
        await queryClient.invalidateQueries({ queryKey: ["creditors"] });
      },
      addPurchaseOrder: async (input) => {
        await api.createPurchaseOrder(input);
        await queryClient.invalidateQueries({ queryKey: ["creditors"] });
      },
      updatePurchaseOrderStatus: async (orderId, status) => {
        await api.updatePurchaseOrderStatus(orderId, { status });
        await queryClient.invalidateQueries({ queryKey: ["creditors"] });
      },
      addPurchaseInvoice: async (input) => {
        await api.createPurchaseInvoice(input);
        await queryClient.invalidateQueries({ queryKey: ["creditors"] });
        await queryClient.invalidateQueries({ queryKey: ["products"] });
      },
      addSupplierPayment: async (input) => {
        await api.createSupplierPayment(input);
        await queryClient.invalidateQueries({ queryKey: ["creditors"] });
      },
      addBankDeposit: async (input) => {
        await api.createBankDeposit(input);
        await queryClient.invalidateQueries({ queryKey: ["bankDeposits"] });
      },
      updateBankDepositStatus: async (depositId, status) => {
        await api.updateBankDepositStatus(depositId, { status });
        await queryClient.invalidateQueries({ queryKey: ["bankDeposits"] });
      },
    };
  }, [queryClient]);

  const value = React.useMemo<BektixContextValue>(
    () => ({
      authStatus,
      session,
      user,
      shop,
      products: productsQuery.data ?? [],
      users: usersQuery.data ?? [],
      sales: salesQuery.data ?? [],
      debtors: debtorsQuery.data ?? [],
      employees: payrollQuery.data?.employees ?? [],
      payrollRuns: payrollQuery.data?.runs ?? [],
      suppliers: creditorsQuery.data?.suppliers ?? [],
      purchaseOrders: creditorsQuery.data?.purchaseOrders ?? [],
      purchaseInvoices: creditorsQuery.data?.purchaseInvoices ?? [],
      supplierPayments: creditorsQuery.data?.supplierPayments ?? [],
      bankDeposits: bankDepositsQuery.data ?? [],
      tenants: tenantsQuery.data ?? [],
      actions,
    }),
    [
      actions,
      authStatus,
      debtorsQuery.data,
      payrollQuery.data,
      creditorsQuery.data,
      bankDepositsQuery.data,
      tenantsQuery.data,
      productsQuery.data,
      salesQuery.data,
      session,
      shop,
      user,
      usersQuery.data,
    ],
  );

  return <BektixContext.Provider value={value}>{children}</BektixContext.Provider>;
}

export function useBektix() {
  const ctx = React.useContext(BektixContext);
  if (!ctx) throw new Error("useBektix must be used within <BektixProvider>.");
  return ctx;
}
