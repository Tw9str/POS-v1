/**
 * Single source of truth for currencies, languages, plans, and subscription statuses.
 * Used by admin panel, onboarding, settings, and API validation.
 */

export const CURRENCIES = [
  { value: "SYP", labelKey: "currencySYP" },
  { value: "USD", labelKey: "currencyUSD" },
  { value: "EUR", labelKey: "currencyEUR" },
  { value: "TRY", labelKey: "currencyTRY" },
  { value: "AED", labelKey: "currencyAED" },
  { value: "SAR", labelKey: "currencySAR" },
] as const;

export const CURRENCY_CODES = CURRENCIES.map((c) => c.value);

export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
] as const;

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.value);

export const PLANS = [
  { value: "FREE_TRIAL", label: "Free Trial" },
  { value: "BASIC", label: "Basic" },
  { value: "STANDARD", label: "Standard" },
  { value: "PREMIUM", label: "Premium" },
] as const;

export const PLAN_VALUES = PLANS.map((p) => p.value);

export const PLAN_LABELS: Record<string, string> = Object.fromEntries(
  PLANS.map((p) => [p.value, p.label]),
);

export const SUBSCRIPTION_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "PAST_DUE", label: "Past Due" },
  { value: "EXPIRED", label: "Expired" },
  { value: "SUSPENDED", label: "Suspended" },
] as const;

export const STATUS_VALUES = SUBSCRIPTION_STATUSES.map((s) => s.value);

export const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  SUBSCRIPTION_STATUSES.map((s) => [s.value, s.label]),
);

export function formatPlan(plan: string | undefined) {
  if (!plan) return "None";
  return PLAN_LABELS[plan] ?? plan.replace(/_/g, " ");
}

export function formatStatus(status: string | undefined) {
  if (!status) return "None";
  return STATUS_LABELS[status] ?? status;
}

export type BadgeVariant = "success" | "info" | "warning" | "danger";

export function statusVariant(s: string | undefined): BadgeVariant {
  switch (s) {
    case "ACTIVE":
      return "success";
    case "PAST_DUE":
      return "warning";
    case "SUSPENDED":
      return "danger";
    default:
      return "danger";
  }
}

/** Default grace period if SystemSettings row doesn't exist */
export const DEFAULT_GRACE_PERIOD_DAYS = 7;

/** Compute displayed status from DB status + expiry + grace period days */
export function getEffectiveStatus(
  dbStatus: string | undefined,
  expiresAt: string | Date | undefined | null,
  gracePeriodDays: number = DEFAULT_GRACE_PERIOD_DAYS,
): string {
  if (!dbStatus) return "EXPIRED";
  if (dbStatus === "SUSPENDED") return "SUSPENDED";
  if (!expiresAt) return dbStatus;
  const now = Date.now();
  const exp = new Date(expiresAt).getTime();
  if (exp < now) {
    const graceEnd = exp + gracePeriodDays * 24 * 60 * 60 * 1000;
    if (graceEnd > now) return "PAST_DUE";
    return "EXPIRED";
  }
  return dbStatus;
}
