import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { z } from "zod";
import { generateAccessCode, hashAccessCode } from "@/lib/accessCode";
import { slugify } from "@/lib/utils";
import { addDays } from "date-fns";

const createMerchantSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().optional(),
  address: z.string().optional(),
  currency: z.string().default("USD"),
});

/* ────── GET: list merchants with search, filters, pagination ────── */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || session.user?.systemRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "";
    const plan = url.searchParams.get("plan") || "";
    const active = url.searchParams.get("active"); // "true" | "false" | ""
    const sort = url.searchParams.get("sort") || "createdAt";
    const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit")) || 25),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    if (active === "true") where.isActive = true;
    else if (active === "false") where.isActive = false;

    if (status || plan) {
      where.subscription = {};
      if (status) where.subscription.status = status;
      if (plan) where.subscription.plan = plan;
    }

    const validSorts: Record<string, object> = {
      createdAt: { createdAt: order },
      name: { name: order },
      updatedAt: { updatedAt: order },
    };

    const [merchants, total] = await Promise.all([
      prisma.merchant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: validSorts[sort] || { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          phone: true,
          address: true,
          currency: true,
          taxRate: true,
          language: true,
          isActive: true,
          onboardingDone: true,
          createdAt: true,
          updatedAt: true,
          subscription: {
            select: {
              plan: true,
              status: true,
              startsAt: true,
              expiresAt: true,
              graceEndsAt: true,
              paidAmount: true,
              paidAt: true,
            },
          },
          _count: {
            select: {
              orders: true,
              staff: true,
              products: true,
              customers: true,
              licenseKeys: true,
            },
          },
        },
      }),
      prisma.merchant.count({ where }),
    ]);

    return NextResponse.json({
      merchants,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/merchants");
  }
}

/* ────── POST: create new merchant ────── */
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
    let digest = hashAccessCode(accessCode);
    let codeExists = await prisma.merchant.findUnique({
      where: { accessCodeDigest: digest },
    });
    while (codeExists) {
      accessCode = generateAccessCode();
      digest = hashAccessCode(accessCode);
      codeExists = await prisma.merchant.findUnique({
        where: { accessCodeDigest: digest },
      });
    }

    const merchant = await prisma.merchant.create({
      data: {
        name,
        slug,
        accessCodeDigest: digest,
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
          details: `Merchant created: ${merchant.name}`,
        },
      })
      .catch(() => {});

    return NextResponse.json({
      success: true,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        slug: merchant.slug,
        accessCode,
      },
    });
  } catch (err) {
    return apiError(err, "POST /api/admin/merchants");
  }
}
