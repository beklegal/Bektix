import type { ShopPreferences } from "@shared/bektix";

export function defaultShopPreferences(currency = "GH₵"): ShopPreferences {
  return {
    currency,
    enableExpiryTracking: true,
    enableProductVariants: true,
    enableLowStockAlerts: true,
    lowStockThreshold: 10,
    taxRatePercent: 5,
    autoPrintReceipt: false,
    receiptFooterMessage: "Thank you for shopping with us!",
  };
}

export function normalizeShopPreferences(raw: unknown): ShopPreferences {
  const obj =
    raw && typeof raw === "object" ? (raw as Partial<ShopPreferences>) : ({} as Partial<ShopPreferences>);

  const currency = typeof obj.currency === "string" && obj.currency.trim() ? obj.currency : "GH₵";
  return { ...defaultShopPreferences(currency), ...obj, currency };
}
