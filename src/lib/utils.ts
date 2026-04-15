// Map Eastern Arabic numerals ٠١٢٣٤٥٦٧٨٩ to Western 0123456789
const EASTERN_TO_WESTERN: Record<string, string> = {
  "\u0660": "0",
  "\u0661": "1",
  "\u0662": "2",
  "\u0663": "3",
  "\u0664": "4",
  "\u0665": "5",
  "\u0666": "6",
  "\u0667": "7",
  "\u0668": "8",
  "\u0669": "9",
};
const WESTERN_TO_EASTERN: Record<string, string> = Object.fromEntries(
  Object.entries(EASTERN_TO_WESTERN).map(([k, v]) => [v, k]),
);

function toWesternNumerals(str: string): string {
  return str.replace(/[\u0660-\u0669]/g, (c) => EASTERN_TO_WESTERN[c] ?? c);
}

function toEasternNumerals(str: string): string {
  return str.replace(/[0-9]/g, (c) => WESTERN_TO_EASTERN[c] ?? c);
}

export type NumberFormat = "western" | "eastern";
export type DateFormat = "long" | "numeric" | "arabic" | "gregorian" | "hijri";

export function normalizeDateFormat(
  dateFormat: DateFormat | string = "long",
): "long" | "numeric" | "arabic" {
  switch (dateFormat) {
    case "numeric":
      return "numeric";
    case "arabic":
    case "hijri":
      return "arabic";
    case "long":
    case "gregorian":
    default:
      return "long";
  }
}

function applyNumberFormat(
  value: string,
  numberFormat: NumberFormat = "western",
): string {
  return numberFormat === "eastern"
    ? toEasternNumerals(value)
    : toWesternNumerals(value);
}

export type CurrencyFormat = "symbol" | "code" | "none";

// Explicit symbol map – Intl is inconsistent across locales/runtimes
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  TRY: "₺",
  SAR: "ر.س",
  AED: "د.إ",
  SYP: "ل.س",
  EGP: "ج.م",
  IQD: "ع.د",
  JOD: "د.ا",
  KWD: "د.ك",
  QAR: "ر.ق",
  BHD: "د.ب",
  OMR: "ر.ع",
  LBP: "ل.ل",
  MAD: "د.م",
  DZD: "د.ج",
  TND: "د.ت",
  LYD: "د.ل",
  JPY: "¥",
  CNY: "¥",
  INR: "₹",
  KRW: "₩",
};

function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

export function formatCurrency(
  amount: number,
  currency = "USD",
  numberFormat: NumberFormat = "western",
  currencyFormat: CurrencyFormat = "symbol",
): string {
  const num = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

  const formatted = applyNumberFormat(num, numberFormat);

  if (currencyFormat === "none") return formatted;

  if (currencyFormat === "code") return `${formatted} ${currency}`;

  // "symbol" — prefix with the currency symbol
  const sym = getCurrencySymbol(currency);
  return `${sym} ${formatted}`;
}

export function formatNumber(
  value: number | string,
  numberFormat: NumberFormat = "western",
): string {
  return applyNumberFormat(String(value), numberFormat);
}

export function formatDate(
  date: Date | string,
  dateFormat: DateFormat = "long",
  numberFormat: NumberFormat = "western",
): string {
  const normalized = normalizeDateFormat(dateFormat);
  const formatter =
    normalized === "numeric"
      ? new Intl.DateTimeFormat("en-GB", {
          year: "numeric",
          month: "numeric",
          day: "numeric",
        })
      : normalized === "arabic"
        ? new Intl.DateTimeFormat("ar-SY", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : new Intl.DateTimeFormat("en", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });

  return applyNumberFormat(formatter.format(new Date(date)), numberFormat);
}

export function formatDateTime(
  date: Date | string,
  dateFormat: DateFormat = "long",
  numberFormat: NumberFormat = "western",
): string {
  const normalized = normalizeDateFormat(dateFormat);
  const formatter =
    normalized === "numeric"
      ? new Intl.DateTimeFormat("en-GB", {
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : normalized === "arabic"
        ? new Intl.DateTimeFormat("ar-SY", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : new Intl.DateTimeFormat("en", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

  return applyNumberFormat(formatter.format(new Date(date)), numberFormat);
}

export function generateOrderNumber(): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `ORD-${date}-${rand}`;
}

export const SUPPORTED_PAYMENT_METHODS = [
  "CASH",
  "MOBILE_MONEY",
  "CARD",
  "CREDIT",
] as const;

export type SupportedPaymentMethod = (typeof SUPPORTED_PAYMENT_METHODS)[number];

export function getPaymentMethodLabel(method?: string | null): string {
  switch (method) {
    case "CASH":
      return "Cash";
    case "CARD":
      return "Card";
    case "MOBILE_MONEY":
    case "SHAMCASH":
      return "ShamCash";
    case "TRANSFER":
      return "Transfer";
    case "CREDIT":
      return "Credit";
    case "SPLIT":
      return "Split";
    case "OTHER":
      return "Other";
    default:
      return method
        ? method
            .toLowerCase()
            .replaceAll("_", " ")
            .replace(/\b\w/g, (char) => char.toUpperCase())
        : "Unknown";
  }
}

export function getProductDisplayName(
  name: string,
  variantName?: string | null,
): string {
  const baseName = name.trim();
  const variant = variantName?.trim();

  return variant ? `${baseName} · ${variant}` : baseName;
}

export function cn(
  ...classes: (string | boolean | undefined | null)[]
): string {
  return classes.filter(Boolean).join(" ");
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
