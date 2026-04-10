import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { generateLicenseToken, generateActivationCode } from "@/lib/license";
import { addDays } from "date-fns";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session || session.user?.systemRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;

    const merchant = await prisma.merchant.findUnique({
      where: { id },
      include: { subscription: true },
    });

    if (!merchant) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const expiresAt = addDays(new Date(), 30);
    const plan = merchant.subscription?.plan || "STANDARD";

    // Generate JWT license token
    const token = generateLicenseToken({
      merchantId: id,
      plan,
      expiresAt: expiresAt.toISOString(),
      issuedAt: new Date().toISOString(),
    });

    // Generate offline activation code
    const activationCode = generateActivationCode(id, expiresAt);

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
        status: "ACTIVE",
        expiresAt,
        graceEndsAt: addDays(expiresAt, 7),
        paidAt: new Date(),
      },
      create: {
        merchantId: id,
        plan: "STANDARD",
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
          details: `Activation code: ${activationCode}`,
        },
      })
      .catch(() => {});

    return NextResponse.json({
      success: true,
      activationCode,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("POST /api/admin/merchants/[id]/license error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
