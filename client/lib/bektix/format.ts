export function formatMoney(amount: number, currencySymbol: string) {
  const value = Number.isFinite(amount) ? amount : 0;
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currencySymbol} ${formatted}`;
}

export function formatCompact(amount: number, currencySymbol: string) {
  const value = Number.isFinite(amount) ? amount : 0;
  const formatted = value.toLocaleString(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  });
  return `${currencySymbol} ${formatted}`;
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

