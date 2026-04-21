import { getStaffSession } from "@/lib/staffAuth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { type PageKey } from "@/lib/staffConstants";

// Re-export for consumers that only need constants
export {
  ALL_PAGE_KEYS,
  ROLE_TEMPLATES,
  type PageKey,
} from "@/lib/staffConstants";

// ─── Page key → dashboard path mapping ───
const PAGE_KEY_TO_PATH: Record<PageKey, string> = {
  pos: "/dashboard/pos",
  products: "/dashboard/products",
  inventory: "/dashboard/inventory",
  orders: "/dashboard/orders",
  customers: "/dashboard/customers",
  suppliers: "/dashboard/suppliers",
  promos: "/dashboard/promos",
  reports: "/dashboard/reports",
  analytics: "/dashboard/analytics",
  settings: "/dashboard/settings",
};

// ─── Page key → allowed API prefixes (full CRUD access) ───
const PAGE_KEY_TO_APIS: Record<PageKey, string[]> = {
  pos: [
    "/api/merchant/orders",
    "/api/merchant/payments",
    "/api/merchant/customers",
    "/api/merchant/promotions/validate",
  ],
  products: ["/api/merchant/products", "/api/merchant/categories"],
  inventory: ["/api/merchant/products", "/api/merchant/inventory"],
  orders: ["/api/merchant/orders", "/api/merchant/payments"],
  customers: ["/api/merchant/customers"],
  suppliers: ["/api/merchant/suppliers"],
  promos: ["/api/merchant/promotions"],
  reports: [],
  analytics: [],
  settings: ["/api/merchant/settings"],
};

// ─── Page key → read-only API prefixes (GET only) ───
const PAGE_KEY_TO_READ_APIS: Record<PageKey, string[]> = {
  pos: [
    "/api/merchant/products",
    "/api/merchant/categories",
    "/api/merchant/promotions",
  ],
  products: [],
  inventory: [],
  orders: [],
  customers: [],
  suppliers: [],
  promos: [],
  reports: ["/api/merchant/orders", "/api/merchant/products"],
  analytics: [
    "/api/merchant/orders",
    "/api/merchant/products",
    "/api/merchant/customers",
  ],
  settings: [],
};

// ─── Owner-only API prefixes (never granted to non-owners) ───
const OWNER_ONLY_APIS = ["/api/merchant/staff", "/api/merchant/onboarding"];

// ─── Derive dashboard paths from allowedPages ───
export function getAllowedPaths(
  allowedPages: string[],
  isOwner: boolean,
): string[] {
  if (isOwner) {
    return [
      "/dashboard",
      ...Object.values(PAGE_KEY_TO_PATH),
      "/dashboard/staff",
    ];
  }
  const paths = ["/dashboard"]; // everyone gets the home page
  for (const key of allowedPages) {
    const path = PAGE_KEY_TO_PATH[key as PageKey];
    if (path) paths.push(path);
  }
  return paths;
}

// ─── Check page access ───
export function canAccessPage(
  allowedPages: string[],
  isOwner: boolean,
  path: string,
): boolean {
  if (isOwner) return true;
  if (path === "/dashboard") return true; // home always accessible
  const paths = getAllowedPaths(allowedPages, false);
  return paths.some(
    (p) => p !== "/dashboard" && (p === path || path.startsWith(p + "/")),
  );
}

// ─── Check API access ───
export function canAccessApi(
  allowedPages: string[],
  isOwner: boolean,
  apiPath: string,
  method: string = "GET",
): boolean {
  if (isOwner) return true;

  // Non-owners can never access owner-only APIs
  if (OWNER_ONLY_APIS.some((prefix) => apiPath.startsWith(prefix))) {
    return false;
  }

  // Full CRUD access
  const fullAccess = new Set<string>();
  for (const key of allowedPages) {
    const apis = PAGE_KEY_TO_APIS[key as PageKey];
    if (apis) apis.forEach((a) => fullAccess.add(a));
  }
  if (Array.from(fullAccess).some((prefix) => apiPath.startsWith(prefix))) {
    return true;
  }

  // Read-only access (GET only)
  if (method === "GET") {
    const readAccess = new Set<string>();
    for (const key of allowedPages) {
      const apis = PAGE_KEY_TO_READ_APIS[key as PageKey];
      if (apis) apis.forEach((a) => readAccess.add(a));
    }
    if (Array.from(readAccess).some((prefix) => apiPath.startsWith(prefix))) {
      return true;
    }
  }

  return false;
}

// ─── Session helpers ───

export async function getStaff() {
  const session = await getStaffSession();
  if (!session) return null;
  return {
    staffId: session.staffId,
    merchantId: session.merchantId,
    role: session.role,
    allowedPages: session.allowedPages,
    isOwner: session.isOwner,
  };
}

export async function requireStaff() {
  const staff = await getStaff();
  if (!staff) {
    // Don't redirect — the dashboard layout handles the no-session case
    // by showing the PinPad gate. Redirecting here causes an infinite loop
    // because Next.js executes layout + page in parallel.
    return null;
  }
  return staff;
}

export async function requireStaffForPage(pathname: string) {
  const staff = await requireStaff();
  if (!staff) return null; // layout shows PinPad
  if (!canAccessPage(staff.allowedPages, staff.isOwner, pathname)) {
    const allowed = getAllowedPaths(staff.allowedPages, staff.isOwner);
    redirect(allowed[0] || "/dashboard");
  }
  return staff;
}

export async function requireStaffForApi(
  apiPath: string,
  method: string = "GET",
) {
  const staff = await getStaff();
  if (!staff) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      staff: null,
    };
  }
  if (!canAccessApi(staff.allowedPages, staff.isOwner, apiPath, method)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      staff: null,
    };
  }
  return { error: null, staff };
}
