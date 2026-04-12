import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { generateAccessCode } from "@/lib/access-code";
import { slugify } from "@/lib/utils";
import { addDays } from "date-fns";

const createMerchantSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().optional(),
  address: z.string().optional(),
  currency: z.string().default("SYP"),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || session.user?.systemRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createMerchantSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const { name, phone, address, currency } = parsed.data;

    // Generate unique slug
    let slug = slugify(name);
    const slugExists = await prisma.merchant.findUnique({ where: { slug } });
    if (slugExists) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Generate unique access code
    let accessCode = generateAccessCode();
    let codeExists = await prisma.merchant.findUnique({
      where: { accessCode },
    });
    while (codeExists) {
      accessCode = generateAccessCode();
      codeExists = await prisma.merchant.findUnique({ where: { accessCode } });
    }

    const merchant = await prisma.merchant.create({
      data: {
        name,
        slug,
        accessCode,
        phone: phone || null,
        address: address || null,
        currency,
        subscription: {
          create: {
            plan: "FREE_TRIAL",
            status: "TRIAL",
            expiresAt: addDays(new Date(), 14),
            graceEndsAt: addDays(new Date(), 21),
          },
        },
      },
    });

    // Auto-create OWNER staff with default PIN
    await prisma.staff.create({
      data: {
        merchantId: merchant.id,
        name: "Owner",
        pin: "0000",
        role: "OWNER",
      },
    });

    // Auto-create default "Other" category
    await prisma.category.create({
      data: {
        merchantId: merchant.id,
        name: "Other",
        color: "#6b7280",
        sortOrder: 999,
      },
    });

    await prisma.activityLog
      .create({
        data: {
          merchantId: merchant.id,
          userId: session.user.id,
          action: "MERCHANT_CREATED",
          entity: "merchant",
          entityId: merchant.id,
          details: `Access code: ${accessCode}`,
        },
      })
      .catch(() => {});

    return NextResponse.json({
      success: true,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        slug: merchant.slug,
        accessCode: merchant.accessCode,
      },
    });
  } catch (err) {
    console.error("POST /api/admin/merchants error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
