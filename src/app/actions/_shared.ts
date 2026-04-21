"use server";

import { prisma, getGracePeriodDays } from "@/lib/db";
import { getMerchantFromSession } from "@/lib/merchant";
import { getEffectiveStatus } from "@/lib/constants";
import { checkMerchantLicense } from "@/lib/licenseCheck";
import { getStaff, canAccessApi } from "@/lib/staff";

// ─── Types ───

export type ActionResult = {
  error?: string;
  success?: boolean;
  data?: unknown;
};

// ─── Auth helpers ───

export async function requireMerchant() {
  const merchant = await getMerchantFromSession();
  if (!merchant)
    return { error: "Unauthorized" as const, merchant: null as never };

  const sub = merchant.subscription;
  const graceDays = await getGracePeriodDays();
  const effectiveStatus = getEffectiveStatus(
    sub?.status,
    sub?.expiresAt,
    graceDays,
  );

  if (effectiveStatus === "SUSPENDED")
    return { error: "Account suspended" as const, merchant: null as never };
  if (effectiveStatus === "EXPIRED")
    return { error: "Subscription expired" as const, merchant: null as never };

  return { error: null, merchant };
}

export async function requireMerchantWithLicense() {
  const { error, merchant } = await requireMerchant();
  if (error) return { error, merchant: null as never, license: null };

  const { error: licenseErr, license } = await checkMerchantLicense(
    merchant.id,
  );
  if (licenseErr)
    return {
      error: "No active license",
      merchant: null as never,
      license: null,
    };

  return { error: null, merchant, license };
}

export async function requireStaffAction(
  apiPath: string,
  method: string = "GET",
) {
  const staff = await getStaff();
  if (!staff)
    return { error: "Staff authentication required" as const, staff: null };
  if (!canAccessApi(staff.allowedPages, staff.isOwner, apiPath, method)) {
    return { error: "Forbidden" as const, staff: null };
  }
  return { error: null, staff };
}
