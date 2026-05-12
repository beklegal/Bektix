import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  PaymentMethod,
  Product,
  Sale,
  Session,
  ShopPreferences,
  User,
  UserRole,
} from "@shared/bektix";
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
  actions: {
    login: (input: { email: string; password: string }) => Promise<void>;
    logout: () => Promise<void>;
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
      amountPaid: number;
    }) => Promise<{ saleId: string }>;
  };
};

const BektixContext = React.createContext<BektixContextValue | null>(null);

export function BektixProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: api.me,
    retry: false,
  });

  const authStatus: AuthStatus = meQuery.isPending
    ? "loading"
    : meQuery.isSuccess
      ? "authenticated"
      : "unauthenticated";

  const session = meQuery.data?.session ?? null;
  const user = meQuery.data?.user ?? null;
  const shop = meQuery.data?.shop ?? null;

  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: api.getProducts,
    enabled: authStatus === "authenticated",
  });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: api.getUsers,
    enabled: authStatus === "authenticated",
  });

  const salesQuery = useQuery({
    queryKey: ["sales"],
    queryFn: api.getSales,
    enabled: authStatus === "authenticated",
  });

  const actions = React.useMemo<BektixContextValue["actions"]>(() => {
    return {
      login: async ({ email, password }) => {
        const payload = await api.login({ email, password });
        queryClient.setQueryData(["auth", "me"], payload);
        await queryClient.invalidateQueries({ queryKey: ["products"] });
        await queryClient.invalidateQueries({ queryKey: ["users"] });
        await queryClient.invalidateQueries({ queryKey: ["sales"] });
      },
      logout: async () => {
        await api.logout();
        queryClient.removeQueries({ queryKey: ["auth", "me"] });
        queryClient.removeQueries({ queryKey: ["products"] });
        queryClient.removeQueries({ queryKey: ["users"] });
        queryClient.removeQueries({ queryKey: ["sales"] });
      },
      updateShopDetails: async (patch) => {
        const nextShop = await api.updateShop(patch);
        queryClient.setQueryData(["auth", "me"], (prev: any) => (prev ? { ...prev, shop: nextShop } : prev));
      },
      updateShopPreferences: async (patch) => {
        const nextShop = await api.updateShopPreferences(patch);
        queryClient.setQueryData(["auth", "me"], (prev: any) => (prev ? { ...prev, shop: nextShop } : prev));
      },
      resetSystemData: async () => {
        await api.resetSystemData();
        await queryClient.invalidateQueries({ queryKey: ["products"] });
        await queryClient.invalidateQueries({ queryKey: ["users"] });
        await queryClient.invalidateQueries({ queryKey: ["sales"] });
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
        if (role === "admin") throw new Error("Admin cannot be created here.");
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
      createSale: async ({ items, paymentMethod, amountPaid }) => {
        const sale = await api.createSale({ items, paymentMethod, amountPaid });
        await queryClient.invalidateQueries({ queryKey: ["sales"] });
        await queryClient.invalidateQueries({ queryKey: ["products"] });
        return { saleId: sale.id };
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
      actions,
    }),
    [actions, authStatus, productsQuery.data, salesQuery.data, session, shop, user, usersQuery.data],
  );

  return <BektixContext.Provider value={value}>{children}</BektixContext.Provider>;
}

export function useBektix() {
  const ctx = React.useContext(BektixContext);
  if (!ctx) throw new Error("useBektix must be used within <BektixProvider>.");
  return ctx;
}
