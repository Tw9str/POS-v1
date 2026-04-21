import { NextResponse } from "next/server";
import { prisma, getGracePeriodDays } from "@/lib/db";
import {
  verifyLicenseToken,
  isLicenseValid,
  getPublicKeyJwk,
  generateLicenseToken,
  getPlanLimits,
} from "@/lib/license";
import { getMerchantSession } from "@/lib/merchantAuth";
import { apiError } from "@/lib/apiError";

/**
 * GET /api/merchant/license
 *
 * Returns the current license status + public key JWK for client-side verification.
 *
 * If no LicenseKey exists but the merchant has an active subscription/trial,
 * a license is auto-generated.
 */
export async function GET() {
  try {
    const session = await getMerchantSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if merchant is suspended
    const merchant = await prisma.merchant.findUnique({
      where: { id: session.id },
      select: {
        isActive: true,
        subscription: {
          select: { status: true },
        },
      },
    });
    if (merchant?.subscription?.status === "SUSPENDED") {
      return NextResponse.json({
        valid: false,
        reason: "suspended",
        publicKey: getPublicKeyJwk(),
      });
    }

    let licenseKey = await prisma.licenseKey.findFirst({
      where: { merchantId: session.id, isRevoked: false },
      orderBy: { createdAt: "desc" },
    });

    // Auto-generate license for merchants with active subscription but no key
    if (!licenseKey) {
      const subscription = await prisma.subscription.findUnique({
        where: { merchantId: session.id },
      });

      if (
        subscription &&
        subscription.expiresAt &&
        new Date(subscription.expiresAt) > new Date() &&
        subscription.status === "ACTIVE"
      ) {
        const limits = getPlanLimits(subscription.plan);
        const token = await generateLicenseToken({
          merchantId: session.id,
          plan: subscription.plan,
          expiresAt: subscription.expiresAt.toISOString(),
          issuedAt: new Date().toISOString(),
          maxStaff: limits.maxStaff,
          maxProducts: limits.maxProducts,
        });

        licenseKey = await prisma.licenseKey.create({
          data: {
            merchantId: session.id,
            token,
            expiresAt: subscription.expiresAt,
          },
        });
      } else {
        return NextResponse.json({
          valid: false,
          reason: "no_license",
          publicKey: getPublicKeyJwk(),
        });
      }
    }

    const payload = await verifyLicenseToken(licenseKey.token);
    if (!payload) {
      return NextResponse.json({
        valid: false,
        reason: "invalid_token",
        publicKey: getPublicKeyJwk(),
      });
    }

    const gracePeriodDays = await getGracePeriodDays();
    const validation = isLicenseValid(payload, gracePeriodDays);

    const response: Record<string, unknown> = {
      valid: validation.valid,
      daysLeft: validation.daysLeft,
      inGrace: validation.inGrace,
      graceDaysLeft: validation.graceDaysLeft,
      plan: payload.plan,
      expiresAt: payload.expiresAt,
      gracePeriodDays,
      maxStaff: payload.maxStaff,
      maxProducts: payload.maxProducts,
      token: licenseKey.token,
      publicKey: getPublicKeyJwk(),
    };

    if (!validation.valid) {
      response.reason = "expired";
    }

    return NextResponse.json(response);
  } catch (err) {
    return apiError(err, "GET /api/merchant/license");
  }
}
