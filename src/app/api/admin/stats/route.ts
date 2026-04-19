import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";

/* ────── GET: comprehensive admin dashboard stats ────── */
export async function GET() {
  try {
    const session = await auth();
    if (!session || session.user?.systemRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    const oneDayAgo = new Date(now.getTime() - day);
    const sevenDaysAgo = new Date(now.getTime() - 7 * day);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * day);

    const [
      totalMerchants,
      activeMerchants,
      inactiveMerchants,
      newMerchants7d,
      totalOrders,
      orders24h,
      orders7d,
      revenue,
      revenue7d,
      revenue30d,
      subsByStatus,
      subsByPlan,
      expiringIn7d,
      totalStaff,
      totalProducts,
      totalCustomers,
      recentMerchants,
      recentActivity,
    ] = await Promise.all([
      prisma.merchant.count(),
      prisma.merchant.count({ where: { isActive: true } }),
      prisma.merchant.count({ where: { isActive: false } }),
      prisma.merchant.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: oneDayAgo } } }),
      prisma.order.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { status: "COMPLETED" },
      }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { status: "COMPLETED", createdAt: { gte: sevenDaysAgo } },
      }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { status: "COMPLETED", createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.subscription.groupBy({
        by: ["status"],
        _count: true,
      }),
      prisma.subscription.groupBy({
        by: ["plan"],
        _count: true,
      }),
      prisma.subscription.count({
        where: {
          expiresAt: {
            lte: new Date(now.getTime() + 7 * day),
            gte: now,
          },
          status: { notIn: ["EXPIRED", "SUSPENDED"] },
        },
      }),
      prisma.staff.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.customer.count(),
      prisma.merchant.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          createdAt: true,
          currency: true,
          subscription: {
            select: { plan: true, status: true, expiresAt: true },
          },
          _count: { select: { orders: true, staff: true, products: true } },
        },
      }),
      prisma.activityLog.findMany({
        take: 15,
        orderBy: { createdAt: "desc" },
        include: { merchant: { select: { name: true } } },
      }),
    ]);

    // Top merchants by revenue
    const topMerchants = await prisma.order.groupBy({
      by: ["merchantId"],
      _sum: { total: true },
      _count: true,
      where: { status: "COMPLETED" },
      orderBy: { _sum: { total: "desc" } },
      take: 10,
    });

    // Fetch merchant names for top merchants
    const topMerchantIds = topMerchants.map((m) => m.merchantId);
    const topMerchantNames = await prisma.merchant.findMany({
      where: { id: { in: topMerchantIds } },
      select: { id: true, name: true, currency: true },
    });
    const nameMap = Object.fromEntries(topMerchantNames.map((m) => [m.id, m]));

    return NextResponse.json({
      overview: {
        totalMerchants,
        activeMerchants,
        inactiveMerchants,
        newMerchants7d,
        totalOrders,
        orders24h,
        orders7d,
        totalRevenue: revenue._sum.total ?? 0,
        revenue7d: revenue7d._sum.total ?? 0,
        revenue30d: revenue30d._sum.total ?? 0,
        totalStaff,
        totalProducts,
        totalCustomers,
        expiringIn7d,
      },
      subscriptions: {
        byStatus: Object.fromEntries(
          subsByStatus.map((s) => [s.status, s._count]),
        ),
        byPlan: Object.fromEntries(subsByPlan.map((s) => [s.plan, s._count])),
      },
      topMerchants: topMerchants.map((m) => ({
        id: m.merchantId,
        name: nameMap[m.merchantId]?.name ?? "Unknown",
        currency: nameMap[m.merchantId]?.currency ?? "USD",
        revenue: m._sum.total ?? 0,
        orders: m._count,
      })),
      recentMerchants,
      recentActivity,
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/stats");
  }
}
