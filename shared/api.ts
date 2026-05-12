import type { Product, Sale, Shop, User } from "./bektix";

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
  role: Exclude<User["role"], "admin">;
}

export interface CreateSaleRequest {
  items: Array<{ productId: string; quantity: number }>;
  paymentMethod: Sale["paymentMethod"];
  amountPaid: number;
}
