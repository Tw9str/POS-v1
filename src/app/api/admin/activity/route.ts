import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";

/* ────── GET: activity logs with search, filters, pagination ────── */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || session.user?.systemRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const action = url.searchParams.get("action") || "";
    const entity = url.searchParams.get("entity") || "";
    const merchantId = url.searchParams.get("merchantId") || "";
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const limit = Math.min(
      200,
      Math.max(1, Number(url.searchParams.get("limit")) || 50),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { entity: { contains: search, mode: "insensitive" } },
        { details: { contains: search, mode: "insensitive" } },
      ];
    }

    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (merchantId) where.merchantId = merchantId;

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          merchant: { select: { id: true, name: true } },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    // Get distinct actions and entities for filter dropdowns
    const [actions, entities] = await Promise.all([
      prisma.activityLog.findMany({
        select: { action: true },
        distinct: ["action"],
        orderBy: { action: "asc" },
      }),
      prisma.activityLog.findMany({
        select: { entity: true },
        distinct: ["entity"],
        orderBy: { entity: "asc" },
      }),
    ]);

    return NextResponse.json({
      logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      filters: {
        actions: actions.map((a) => a.action),
        entities: entities.map((e) => e.entity),
      },
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/activity");
  }
}
