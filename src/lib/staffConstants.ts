// ─── Toggleable page keys (what Owner can assign) ───
export const ALL_PAGE_KEYS = [
  "pos",
  "products",
  "inventory",
  "orders",
  "customers",
  "suppliers",
  "promos",
  "reports",
  "analytics",
  "settings",
] as const;

export type PageKey = (typeof ALL_PAGE_KEYS)[number];

// ─── Role templates (presets for the UI) ───
export const ROLE_TEMPLATES: Record<string, PageKey[]> = {
  MANAGER: [
    "pos",
    "products",
    "inventory",
    "orders",
    "customers",
    "suppliers",
    "promos",
    "reports",
    "analytics",
  ],
  CASHIER: ["pos"],
  STOCK_CLERK: ["products", "inventory", "suppliers"],
};
