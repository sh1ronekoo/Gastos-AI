export type CurrencyCode = "PHP" | "EUR" | "USD" | "JPY" | "KRW";

export const CURRENCIES: { code: CurrencyCode; label: string; locale: string }[] = [
  { code: "PHP", label: "Philippine Peso", locale: "en-PH" },
  { code: "EUR", label: "Euro", locale: "de-DE" },
  { code: "USD", label: "US Dollar", locale: "en-US" },
  { code: "JPY", label: "Japanese Yen", locale: "ja-JP" },
  { code: "KRW", label: "Korean Won", locale: "ko-KR" },
];

/** How many PHP equal one unit of the foreign currency (approximate display rates). */
const PHP_PER_UNIT: Record<CurrencyCode, number> = {
  PHP: 1,
  EUR: 62,
  USD: 56,
  JPY: 0.38,
  KRW: 0.042,
};

export const CURRENCY_STORAGE_KEY = "gastos-currency";

export function convertFromPHP(amountPHP: number, target: CurrencyCode): number {
  return amountPHP / PHP_PER_UNIT[target];
}

export function formatMoney(amountPHP: number, currency: CurrencyCode): string {
  const converted = convertFromPHP(amountPHP, currency);
  const locale = CURRENCIES.find((c) => c.code === currency)?.locale ?? "en-PH";
  const noDecimals = currency === "JPY" || currency === "KRW";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: noDecimals ? 0 : 2,
    maximumFractionDigits: noDecimals ? 0 : 2,
  }).format(converted);
}

export function getCurrencyLabel(code: CurrencyCode): string {
  return CURRENCIES.find((c) => c.code === code)?.label ?? code;
}
