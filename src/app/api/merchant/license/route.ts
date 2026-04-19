import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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
        (subscription.status === "TRIAL" || subscription.status === "ACTIVE")
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

    const validation = isLicenseValid(payload);

    return NextResponse.json({
      valid: validation.valid,
      daysLeft: validation.daysLeft,
      inGrace: validation.inGrace,
      plan: payload.plan,
      expiresAt: payload.expiresAt,
      maxStaff: payload.maxStaff,
      maxProducts: payload.maxProducts,
      token: licenseKey.token,
      publicKey: getPublicKeyJwk(),
    });
  } catch (err) {
    return apiError(err, "GET /api/merchant/license");
  }
}
