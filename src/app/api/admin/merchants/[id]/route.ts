import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  currency: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  isActive: z.boolean().optional(),
});

/* ────── GET: single merchant detail ────── */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session || session.user?.systemRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;

    const merchant = await prisma.merchant.findUnique({
      where: { id },
      include: {
        subscription: true,
        licenseKeys: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        staff: {
          select: {
            id: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            orders: true,
            staff: true,
            products: true,
            customers: true,
            suppliers: true,
            categories: true,
            licenseKeys: true,
            payments: true,
          },
        },
      },
    });

    if (!merchant) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Strip sensitive fields before sending to client
    const { accessCodeDigest: _acd, ...safeMerchant } = merchant;

    // Aggregate revenue
    const revenue = await prisma.order.aggregate({
      where: { merchantId: id, status: "COMPLETED" },
      _sum: { total: true },
    });

    // Recent orders
    const recentOrders = await prisma.order.findMany({
      where: { merchantId: id },
      take: 20,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        status: true,
        paymentMethod: true,
        createdAt: true,
        staff: { select: { name: true } },
        customer: { select: { name: true } },
      },
    });

    // Recent activity for this merchant
    const recentActivity = await prisma.activityLog.findMany({
      where: { merchantId: id },
      take: 20,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      merchant: safeMerchant,
      revenue: revenue._sum.total ?? 0,
      recentOrders,
      recentActivity,
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/merchants/[id]");
  }
}

/* ────── PUT: update merchant fields ────── */
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session || session.user?.systemRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const existing = await prisma.merchant.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const merchant = await prisma.merchant.update({
      where: { id },
      data: parsed.data,
    });

    await prisma.activityLog
      .create({
        data: {
          merchantId: id,
          userId: session.user.id,
          action: "MERCHANT_UPDATED",
          entity: "merchant",
          entityId: id,
          details: `Updated: ${Object.keys(parsed.data).join(", ")}`,
        },
      })
      .catch(() => {});

    return NextResponse.json({ success: true, merchant });
  } catch (err) {
    return apiError(err, "PUT /api/admin/merchants/[id]");
  }
}

/* ────── DELETE: soft-delete (deactivate) merchant ────── */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session || session.user?.systemRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.merchant.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Soft delete: deactivate + revoke all licenses
    await prisma.$transaction([
      prisma.merchant.update({
        where: { id },
        data: { isActive: false },
      }),
      prisma.licenseKey.updateMany({
        where: { merchantId: id, isRevoked: false },
        data: { isRevoked: true },
      }),
      prisma.subscription.updateMany({
        where: { merchantId: id },
        data: { status: "SUSPENDED" },
      }),
    ]);

    await prisma.activityLog
      .create({
        data: {
          merchantId: id,
          userId: session.user.id,
          action: "MERCHANT_DEACTIVATED",
          entity: "merchant",
          entityId: id,
        },
      })
      .catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError(err, "DELETE /api/admin/merchants/[id]");
  }
}
