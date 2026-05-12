import type {
  AuthLoginRequest,
  AuthResponse,
  CreateProductRequest,
  CreateSaleRequest,
  CreateUserRequest,
  UpdateProductRequest,
} from "@shared/api";
import type { Product, Sale, Shop, ShopPreferences, User } from "@shared/bektix";

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
};
