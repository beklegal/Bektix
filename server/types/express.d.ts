import type { Shop, User } from "@shared/bektix";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        shopId: string;
        role: User["role"];
        user: User;
      shop: Shop;
      branchId: string | null;
      };
    }
  }
}

export {};
