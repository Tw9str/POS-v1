"use server";

import { auth } from "@/lib/auth";
import { prisma, getGracePeriodDays } from "@/lib/db";
import { generateAccessCode, hashAccessCode } from "@/lib/accessCode";
import { slugify } from "@/lib/utils";
import { generateLicenseToken, getPlanLimits } from "@/lib/license";
import { addDays } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Auth helper ───
async function requireAdmin() {
  const session = await auth();
  if (!session || session.user?.systemRole !== "SUPER_ADMIN") {
    return { error: "Unauthorized", session: null };
  }
  return { error: null, session };
}

// ─── Fetch: dashboard stats ───
export async function getAdminStats() {
  const { error } = await requireAdmin();
  if (error) return null;

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

  const topMerchants = await prisma.order.groupBy({
    by: ["merchantId"],
    _sum: { total: true },
    _count: true,
    where: { status: "COMPLETED" },
    orderBy: { _sum: { total: "desc" } },
    take: 10,
  });

  const topMerchantIds = topMerchants.map((m) => m.merchantId);
  const topMerchantNames = await prisma.merchant.findMany({
    where: { id: { in: topMerchantIds } },
    select: { id: true, name: true, currency: true },
  });
  const nameMap = Object.fromEntries(topMerchantNames.map((m) => [m.id, m]));

  return {
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
  };
}

// ─── Fetch: activity logs ───
export async function getActivityLogs(params: {
  search?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) {
  const { error } = await requireAdmin();
  if (error) return null;

  const { search, action, entity, from, to } = params;
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(200, Math.max(1, params.limit || 50));

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

  return {
    logs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    filters: {
      actions: actions.map((a) => a.action),
      entities: entities.map((e) => e.entity),
    },
  };
}

// ─── Fetch: merchants list ───
export async function getMerchantsList(params: {
  search?: string;
  status?: string;
  plan?: string;
  page?: number;
  limit?: number;
}) {
  const { error } = await requireAdmin();
  if (error) return null;

  const { search, status, plan } = params;
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 25));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status || plan) {
    where.subscription = {};
    if (status) where.subscription.status = status;
    if (plan) where.subscription.plan = plan;
  }

  const [merchants, total] = await Promise.all([
    prisma.merchant.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        address: true,
        currency: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        subscription: {
          select: {
            plan: true,
            status: true,
            startsAt: true,
            expiresAt: true,
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

  return {
    merchants,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

// ─── Fetch: subscriptions list ───
export async function getSubscriptionsList(params: {
  search?: string;
  status?: string;
  plan?: string;
  expiring?: boolean;
  sort?: string;
  order?: string;
  page?: number;
  limit?: number;
}) {
  const { error } = await requireAdmin();
  if (error) return null;

  const { search, status, plan, expiring, sort, order: sortOrder } = params;
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 25));

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

  const order = sortOrder === "desc" ? "desc" : "asc";
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
      orderBy: validSorts[sort || "expiresAt"] || { expiresAt: "asc" },
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

  return {
    subscriptions,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

// ─── Fetch: admin settings ───
export async function getAdminSettings() {
  const { error } = await requireAdmin();
  if (error) return null;

  const settings = await prisma.systemSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  return settings;
}

// ─── Fetch: merchant detail ───
export async function getMerchantDetail(id: string) {
  const { error } = await requireAdmin();
  if (error) return null;

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

  if (!merchant) return null;

  const { accessCodeDigest: _acd, ...safeMerchant } = merchant;

  const revenue = await prisma.order.aggregate({
    where: { merchantId: id, status: "COMPLETED" },
    _sum: { total: true },
  });

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

  const recentActivity = await prisma.activityLog.findMany({
    where: { merchantId: id },
    take: 20,
    orderBy: { createdAt: "desc" },
  });

  const gracePeriodDays = await getGracePeriodDays();

  return {
    merchant: safeMerchant,
    revenue: revenue._sum.total ?? 0,
    recentOrders,
    recentActivity,
    gracePeriodDays,
  };
}

// ═══════════════════════════════════════════════════
// MUTATIONS (Server Actions)
// ═══════════════════════════════════════════════════

type ActionResult = { error?: string; success?: boolean; data?: unknown };

// ─── Create merchant ───
const createMerchantSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().optional(),
  address: z.string().optional(),
  currency: z.string().default("USD"),
});

export async function createMerchant(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { error, session } = await requireAdmin();
  if (error || !session) return { error: "Unauthorized" };

  const parsed = createMerchantSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    currency: formData.get("currency") || "USD",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, phone, address, currency } = parsed.data;

  let slug = slugify(name);
  const slugExists = await prisma.merchant.findUnique({ where: { slug } });
  if (slugExists) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

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
          status: "ACTIVE",
          expiresAt: addDays(new Date(), 14),
        },
      },
    },
  });

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

  revalidatePath("/admin/merchants");

  return {
    success: true,
    data: {
      id: merchant.id,
      name: merchant.name,
      slug: merchant.slug,
      accessCode,
    },
  };
}

// ─── Update merchant ───
export async function updateMerchant(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { error } = await requireAdmin();
  if (error) return { error: "Unauthorized" };

  const id = formData.get("id") as string;
  if (!id) return { error: "Missing merchant ID" };

  const data: Record<string, unknown> = {};
  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string;
  const address = formData.get("address") as string;
  const currency = formData.get("currency") as string;
  const taxRate = formData.get("taxRate") as string | null;
  const language = formData.get("language") as string | null;

  if (name) data.name = name;
  if (phone !== null) data.phone = phone || null;
  if (address !== null) data.address = address || null;
  if (currency) data.currency = currency;
  if (taxRate != null) data.taxRate = Number(taxRate) || 0;
  if (language) data.language = language;

  await prisma.merchant.update({ where: { id }, data });
  revalidatePath("/admin/merchants");
  revalidatePath(`/admin/merchants/${id}`);

  return { success: true };
}

// ─── Toggle merchant active/suspended ───
export async function toggleMerchant(
  merchantId: string,
): Promise<ActionResult> {
  const { error, session } = await requireAdmin();
  if (error || !session) return { error: "Unauthorized" };

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: { subscription: true },
  });
  if (!merchant) return { error: "Not found" };
  if (!merchant.subscription) return { error: "No subscription" };

  const isSuspended = merchant.subscription.status === "SUSPENDED";
  const newStatus = isSuspended ? "ACTIVE" : "SUSPENDED";
  const newIsActive = isSuspended;

  await prisma.$transaction([
    prisma.subscription.update({
      where: { merchantId },
      data: { status: newStatus },
    }),
    prisma.merchant.update({
      where: { id: merchantId },
      data: { isActive: newIsActive },
    }),
  ]);

  await prisma.activityLog
    .create({
      data: {
        merchantId,
        userId: session.user.id,
        action: isSuspended ? "MERCHANT_ACTIVATED" : "MERCHANT_SUSPENDED",
        entity: "merchant",
        entityId: merchantId,
      },
    })
    .catch(() => {});

  revalidatePath("/admin/merchants");
  revalidatePath(`/admin/merchants/${merchantId}`);

  return { success: true };
}

// ─── Generate license / manage plan ───
export async function manageMerchantPlan(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { error, session } = await requireAdmin();
  if (error || !session) return { error: "Unauthorized" };

  const merchantId = formData.get("merchantId") as string;
  if (!merchantId) return { error: "Missing merchant ID" };

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: { subscription: true },
  });
  if (!merchant) return { error: "Not found" };

  const requestedPlan = formData.get("plan") as string | null;
  const requestedStatus = formData.get("status") as string | null;
  const durationDays = Number(formData.get("durationDays")) || 30;
  const paidAmountStr = formData.get("paidAmount") as string | null;
  const paymentRef = formData.get("paymentRef") as string | null;
  const notes = formData.get("notes") as string | null;
  const expiresAtStr = formData.get("expiresAt") as string | null;

  const expiresAt = expiresAtStr
    ? new Date(expiresAtStr)
    : addDays(new Date(), durationDays);

  const plan = requestedPlan || merchant.subscription?.plan || "STANDARD";
  const limits = getPlanLimits(plan);

  const token = await generateLicenseToken({
    merchantId,
    plan,
    expiresAt: expiresAt.toISOString(),
    issuedAt: new Date().toISOString(),
    maxStaff: limits.maxStaff,
    maxProducts: limits.maxProducts,
  });

  await prisma.licenseKey.create({
    data: { merchantId, token, expiresAt },
  });

  const validStatuses = ["ACTIVE", "PAST_DUE", "EXPIRED", "SUSPENDED"];
  const status = (
    requestedStatus && validStatuses.includes(requestedStatus)
      ? requestedStatus
      : "ACTIVE"
  ) as "ACTIVE" | "PAST_DUE" | "EXPIRED" | "SUSPENDED";

  const paidAmount = paidAmountStr != null ? Number(paidAmountStr) : undefined;
  const subData = {
    plan: plan as "BASIC" | "STANDARD" | "PREMIUM" | "FREE_TRIAL",
    status,
    expiresAt,
    paidAt: new Date(),
    ...(paidAmount !== undefined && { paidAmount }),
    ...(paymentRef && { paymentRef }),
    ...(notes !== undefined && { notes }),
  };

  await prisma.subscription.upsert({
    where: { merchantId },
    update: subData,
    create: { merchantId, ...subData },
  });

  if (status === "ACTIVE" && !merchant.isActive) {
    await prisma.merchant.update({
      where: { id: merchantId },
      data: { isActive: true },
    });
  }

  await prisma.activityLog
    .create({
      data: {
        merchantId,
        userId: session.user.id,
        action: "LICENSE_GENERATED",
        entity: "license",
        entityId: merchantId,
        details: `Plan: ${plan}, Expires: ${expiresAt.toISOString().slice(0, 10)}`,
      },
    })
    .catch(() => {});

  revalidatePath("/admin/merchants");
  revalidatePath(`/admin/merchants/${merchantId}`);
  revalidatePath("/admin/subscriptions");

  return { success: true };
}

// ─── Regenerate access code ───
export async function regenerateAccessCode(
  merchantId: string,
): Promise<ActionResult> {
  const { error, session } = await requireAdmin();
  if (error || !session) return { error: "Unauthorized" };

  const existing = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });
  if (!existing) return { error: "Not found" };

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

  await prisma.merchant.update({
    where: { id: merchantId },
    data: { accessCodeDigest: digest },
  });

  await prisma.activityLog
    .create({
      data: {
        merchantId,
        userId: session.user.id,
        action: "ACCESS_CODE_REGENERATED",
        entity: "merchant",
        entityId: merchantId,
      },
    })
    .catch(() => {});

  revalidatePath(`/admin/merchants/${merchantId}`);

  return { success: true, data: { accessCode } };
}

// ─── Update admin settings ───
export async function updateAdminSettings(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { error } = await requireAdmin();
  if (error) return { error: "Unauthorized" };

  const days = Number(formData.get("gracePeriodDays"));
  if (isNaN(days) || days < 0 || days > 90) {
    return { error: "Grace period must be between 0 and 90" };
  }

  await prisma.systemSettings.upsert({
    where: { id: "default" },
    create: { id: "default", gracePeriodDays: days },
    update: { gracePeriodDays: days },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/merchants");
  revalidatePath("/admin/subscriptions");

  return { success: true };
}

// ─── Update subscription (from subscriptions page) ───
const updateSubSchema = z.object({
  merchantId: z.string().min(1),
  plan: z.enum(["FREE_TRIAL", "BASIC", "STANDARD", "PREMIUM"]).optional(),
  status: z.enum(["ACTIVE", "PAST_DUE", "EXPIRED", "SUSPENDED"]).optional(),
  expiresAt: z.string().optional(),
  paidAmount: z.coerce.number().min(0).nullable().optional(),
  paidAt: z.string().nullable().optional(),
  paymentRef: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function updateSubscription(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { error, session } = await requireAdmin();
  if (error || !session) return { error: "Unauthorized" };

  const rawData: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    rawData[key] = value;
  }
  // Handle nullable numbers
  if (rawData.paidAmount === "") rawData.paidAmount = null;

  const parsed = updateSubSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { merchantId, ...data } = parsed.data;

  const existing = await prisma.subscription.findUnique({
    where: { merchantId },
  });
  if (!existing) return { error: "Subscription not found" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {};
  if (data.plan) updateData.plan = data.plan;
  if (data.status) updateData.status = data.status;
  if (data.expiresAt) updateData.expiresAt = new Date(data.expiresAt);
  if (data.paidAmount !== undefined) updateData.paidAmount = data.paidAmount;
  if (data.paidAt !== undefined)
    updateData.paidAt = data.paidAt ? new Date(data.paidAt) : null;
  if (data.paymentRef !== undefined) updateData.paymentRef = data.paymentRef;
  if (data.notes !== undefined) updateData.notes = data.notes;

  await prisma.subscription.update({
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
        entityId: existing.id,
        details: `Updated: ${changes}`,
      },
    })
    .catch(() => {});

  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/merchants");

  return { success: true };
}

// ─── Revoke license ───
export async function revokeLicense(licenseId: string): Promise<ActionResult> {
  const { error, session } = await requireAdmin();
  if (error || !session) return { error: "Unauthorized" };

  const license = await prisma.licenseKey.findUnique({
    where: { id: licenseId },
  });
  if (!license) return { error: "License not found" };

  await prisma.licenseKey.update({
    where: { id: licenseId },
    data: { isRevoked: true },
  });

  await prisma.activityLog
    .create({
      data: {
        merchantId: license.merchantId,
        userId: session.user.id,
        action: "LICENSE_REVOKED",
        entity: "license",
        entityId: licenseId,
      },
    })
    .catch(() => {});

  revalidatePath(`/admin/merchants/${license.merchantId}`);

  return { success: true };
}
