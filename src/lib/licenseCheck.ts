import { prisma, getGracePeriodDays } from "@/lib/db";
import { verifyLicenseToken, isLicenseValid } from "@/lib/license";
import { NextResponse } from "next/server";

/**
 * Check if a merchant has a valid (non-expired, non-revoked) license.
 * Returns the license payload if valid, or a NextResponse error.
 */
export async function checkMerchantLicense(merchantId: string) {
  try {
    const [licenseKey, gracePeriodDays] = await Promise.all([
      prisma.licenseKey.findFirst({
        where: { merchantId, isRevoked: false },
        orderBy: { createdAt: "desc" },
      }),
      getGracePeriodDays(),
    ]);

    if (!licenseKey) {
      return {
        error: NextResponse.json(
          { error: "No active license. Contact your administrator." },
          { status: 402 },
        ),
        license: null,
      };
    }

    const payload = await verifyLicenseToken(licenseKey.token);
    if (!payload) {
      return {
        error: NextResponse.json(
          { error: "Invalid license token." },
          { status: 402 },
        ),
        license: null,
      };
    }

    const validation = isLicenseValid(payload, gracePeriodDays);
    if (!validation.valid) {
      return {
        error: NextResponse.json(
          { error: "License expired. Contact your administrator to renew." },
          { status: 402 },
        ),
        license: null,
      };
    }

    return { error: null, license: payload };
  } catch {
    // DB unreachable — fail closed; do not silently allow access
    return {
      error: NextResponse.json(
        { error: "Unable to verify license. Please try again later." },
        { status: 503 },
      ),
      license: null,
    };
  }
}
