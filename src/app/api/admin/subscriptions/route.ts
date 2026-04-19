import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSubSchema = z.object({
  merchantId: z.string().min(1),
  plan: z.enum(["FREE_TRIAL", "BASIC", "STANDARD", "PREMIUM"]).optional(),
  status: z
    .enum(["TRIAL", "ACTIVE", "PAST_DUE", "EXPIRED", "SUSPENDED"])
    .optional(),
  expiresAt: z.iso.datetime().optional(),
  paidAmount: z.number().min(0).nullable().optional(),
  paidAt: z.iso.datetime().nullable().optional(),
  paymentRef: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/* ────── GET: list subscriptions with filters ────── */
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
    const expiring = url.searchParams.get("expiring") === "true";
    const sort = url.searchParams.get("sort") || "expiresAt";
    const order = url.searchParams.get("order") === "desc" ? "desc" : "asc";
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit")) || 25),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.merchant = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    if (status) where.status = status;
    if (plan) where.plan = plan;
    if (expiring) {
      where.expiresAt = {
        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        gte: new Date(),
      };
    }

    const validSorts: Record<string, object> = {
      expiresAt: { expiresAt: order },
      createdAt: { createdAt: order },
      plan: { plan: order },
    };

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: validSorts[sort] || { expiresAt: "asc" },
        include: {
          merchant: {
            select: {
              id: true,
              name: true,
              slug: true,
              isActive: true,
              phone: true,
              currency: true,
            },
          },
        },
      }),
      prisma.subscription.count({ where }),
    ]);

    return NextResponse.json({
      subscriptions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/subscriptions");
  }
}

/* ────── PUT: update subscription (plan change, extend, payment record, notes) ────── */
export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session || session.user?.systemRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateSubSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const { merchantId, ...data } = parsed.data;

    const existing = await prisma.subscription.findUnique({
      where: { merchantId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (data.plan) updateData.plan = data.plan;
    if (data.status) updateData.status = data.status;
    if (data.expiresAt) {
      updateData.expiresAt = new Date(data.expiresAt);
      // Auto-set grace end = 7 days after expiry
      updateData.graceEndsAt = new Date(
        new Date(data.expiresAt).getTime() + 7 * 24 * 60 * 60 * 1000,
      );
    }
    if (data.paidAmount !== undefined) updateData.paidAmount = data.paidAmount;
    if (data.paidAt !== undefined)
      updateData.paidAt = data.paidAt ? new Date(data.paidAt) : null;
    if (data.paymentRef !== undefined) updateData.paymentRef = data.paymentRef;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const subscription = await prisma.subscription.update({
      where: { merchantId },
      data: updateData,
    });

    const changes = Object.keys(updateData).join(", ");

    await prisma.activityLog
      .create({
        data: {
          merchantId,
          userId: session.user.id,
          action: "SUBSCRIPTION_UPDATED",
          entity: "subscription",
          entityId: subscription.id,
          details: `Updated: ${changes}`,
        },
      })
      .catch(() => {});

    return NextResponse.json({ success: true, subscription });
  } catch (err) {
    return apiError(err, "PUT /api/admin/subscriptions");
  }
}
