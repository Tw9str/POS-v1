import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { generateLicenseToken, getPlanLimits } from "@/lib/license";
import { addDays } from "date-fns";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session || session.user?.systemRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const durationDays = Number(body.durationDays) || 30;
    const requestedPlan = body.plan as string | undefined;

    const merchant = await prisma.merchant.findUnique({
      where: { id },
      include: { subscription: true },
    });

    if (!merchant) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const expiresAt = addDays(new Date(), durationDays);
    const plan = requestedPlan || merchant.subscription?.plan || "STANDARD";
    const limits = getPlanLimits(plan);

    // Generate Ed25519-signed JWT license token
    const token = await generateLicenseToken({
      merchantId: id,
      plan,
      expiresAt: expiresAt.toISOString(),
      issuedAt: new Date().toISOString(),
      maxStaff: limits.maxStaff,
      maxProducts: limits.maxProducts,
    });

    // Save license key
    await prisma.licenseKey.create({
      data: {
        merchantId: id,
        token,
        expiresAt,
      },
    });

    // Update subscription
    await prisma.subscription.upsert({
      where: { merchantId: id },
      update: {
        plan: plan as "BASIC" | "STANDARD" | "PREMIUM" | "FREE_TRIAL",
        status: "ACTIVE",
        expiresAt,
        graceEndsAt: addDays(expiresAt, 7),
        paidAt: new Date(),
      },
      create: {
        merchantId: id,
        plan: plan as "BASIC" | "STANDARD" | "PREMIUM" | "FREE_TRIAL",
        status: "ACTIVE",
        expiresAt,
        graceEndsAt: addDays(expiresAt, 7),
        paidAt: new Date(),
      },
    });

    await prisma.activityLog
      .create({
        data: {
          merchantId: id,
          userId: session.user.id,
          action: "LICENSE_GENERATED",
          entity: "license",
          entityId: id,
          details: `Plan: ${plan}, Duration: ${durationDays}d`,
        },
      })
      .catch(() => {});

    return NextResponse.json({
      success: true,
      licenseToken: token,
      plan,
      durationDays,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    return apiError(err, "POST /api/admin/merchants/[id]/license");
  }
}
