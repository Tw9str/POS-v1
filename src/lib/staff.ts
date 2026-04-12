import { getStaffSession } from "@/lib/staff-auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export type StaffRole = "OWNER" | "MANAGER" | "CASHIER" | "STOCK_CLERK";

// Which routes each role can access
const ROLE_PAGES: Record<StaffRole, string[]> = {
  OWNER: [
    "/dashboard",
    "/dashboard/pos",
    "/dashboard/products",
    "/dashboard/inventory",
    "/dashboard/orders",
    "/dashboard/customers",
    "/dashboard/suppliers",
    "/dashboard/staff",
    "/dashboard/reports",
    "/dashboard/analytics",
    "/dashboard/settings",
    "/dashboard/promos",
  ],
  MANAGER: [
    "/dashboard",
    "/dashboard/pos",
    "/dashboard/products",
    "/dashboard/inventory",
    "/dashboard/orders",
    "/dashboard/customers",
    "/dashboard/reports",
    "/dashboard/analytics",
    "/dashboard/promos",
  ],
  CASHIER: ["/dashboard/pos"],
  STOCK_CLERK: [
    "/dashboard/products",
    "/dashboard/inventory",
    "/dashboard/suppliers",
  ],
};

// Which API prefixes each role can access
const ROLE_APIS: Record<StaffRole, string[]> = {
  OWNER: ["*"],
  MANAGER: [
    "/api/merchant/products",
    "/api/merchant/orders",
    "/api/merchant/customers",
    "/api/merchant/suppliers",
    "/api/merchant/inventory",
    "/api/merchant/promotions",
  ],
  CASHIER: [
    "/api/merchant/orders",
    "/api/merchant/products",
    "/api/merchant/promotions",
  ],
  STOCK_CLERK: [
    "/api/merchant/products",
    "/api/merchant/suppliers",
    "/api/merchant/inventory",
  ],
};

export function getAllowedPages(role: StaffRole): string[] {
  return ROLE_PAGES[role] || [];
}

export function canAccessPage(role: StaffRole, path: string): boolean {
  const pages = ROLE_PAGES[role];
  if (!pages) return false;
  return pages.some((p) => {
    if (p === path) return true;
    if (path.startsWith(p + "/")) return true;
    return false;
  });
}

export function canAccessApi(role: StaffRole, path: string): boolean {
  const apis = ROLE_APIS[role];
  if (!apis) return false;
  if (apis.includes("*")) return true;
  return apis.some((prefix) => path.startsWith(prefix));
}

export async function getStaff() {
  const session = await getStaffSession();
  if (!session) return null;
  return {
    staffId: session.staffId,
    merchantId: session.merchantId,
    role: session.role as StaffRole,
  };
}

export async function requireStaff() {
  const staff = await getStaff();
  if (!staff) {
    redirect("/dashboard");
  }
  return staff;
}

export async function requireStaffForPage(pathname: string) {
  const staff = await requireStaff();
  if (!canAccessPage(staff.role, pathname)) {
    // Redirect to their first allowed page
    const allowed = getAllowedPages(staff.role);
    redirect(allowed[0] || "/dashboard");
  }
  return staff;
}

export async function requireStaffForApi(apiPath: string) {
  const staff = await getStaff();
  if (!staff) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      staff: null,
    };
  }
  if (!canAccessApi(staff.role, apiPath)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      staff: null,
    };
  }
  return { error: null, staff };
}
