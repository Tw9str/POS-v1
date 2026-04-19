import { prisma } from "@/lib/db";
import { getMerchantFromSession, requireActiveMerchant } from "@/lib/merchant";
import { requireStaffForApi } from "@/lib/staff";
import { hashPin, verifyPin } from "@/lib/pinHash";
import { apiError } from "@/lib/apiError";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

const staffSchema = z.object({
  name: z.string().min(1).max(100),
  pin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
  role: z.enum(["CASHIER", "MANAGER", "STOCK_CLERK", "OWNER"]),
});

const staffUpdateSchema = staffSchema.partial().extend({
  id: z.string().min(1),
  isActive: z.boolean().optional(),
});

const deleteSchema = z.object({
  id: z.string().min(1),
});

export async function GET() {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await requireStaffForApi("/api/merchant/staff");

    const staffList = await prisma.staff.findMany({
      where: { merchantId: merchant.id, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        role: true,
        isActive: true,
        maxDiscountPercent: true,
      },
    });

    return NextResponse.json(staffList);
  } catch (err) {
    return apiError(err, "GET /api/merchant/staff");
  }
}

export async function POST(req: Request) {
  try {
    const {
      error: authError,
      merchant,
      license,
    } = await requireActiveMerchant();
    if (authError || !merchant) return authError!;

    const { error } = await requireStaffForApi("/api/merchant/staff");
    if (error) return error;

    // Plan limit: max staff
    if (license?.maxStaff) {
      const activeCount = await prisma.staff.count({
        where: { merchantId: merchant.id, isActive: true },
      });
      if (activeCount >= license.maxStaff) {
        return NextResponse.json(
          {
            error: `Staff limit reached (${license.maxStaff}). Upgrade your plan to add more staff.`,
          },
          { status: 403 },
        );
      }
    }

    const body = await req.json();
    const parsed = staffSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    // Check unique PIN per merchant (compare against hashed PINs)
    const existingStaff = await prisma.staff.findMany({
      where: { merchantId: merchant.id, isActive: true },
      select: { pin: true },
    });
    for (const s of existingStaff) {
      if (await verifyPin(parsed.data.pin, s.pin)) {
        return NextResponse.json(
          { error: "This PIN is already in use" },
          { status: 400 },
        );
      }
    }

    const hashedPin = await hashPin(parsed.data.pin);
    const staff = await prisma.staff.create({
      data: {
        merchantId: merchant.id,
        name: parsed.data.name,
        pin: hashedPin,
        role: parsed.data.role,
      },
    });

    await prisma.activityLog
      .create({
        data: {
          merchantId: merchant.id,
          action: "STAFF_CREATED",
          entity: "staff",
          entityId: staff.id,
        },
      })
      .catch(() => {});

    revalidatePath("/dashboard/staff");
    revalidatePath("/dashboard/pos");
    return NextResponse.json(staff, { status: 201 });
  } catch (err) {
    return apiError(err, "POST /api/merchant/staff");
  }
}

export async function PUT(req: Request) {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await requireStaffForApi("/api/merchant/staff");
    if (error) return error;

    const parsed = staffUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const existing = await prisma.staff.findFirst({
      where: { id: parsed.data.id, merchantId: merchant.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    if (parsed.data.pin) {
      // Check if the new PIN conflicts with another staff member
      const otherStaff = await prisma.staff.findMany({
        where: {
          merchantId: merchant.id,
          isActive: true,
          id: { not: parsed.data.id },
        },
        select: { pin: true },
      });
      for (const s of otherStaff) {
        if (await verifyPin(parsed.data.pin, s.pin)) {
          return NextResponse.json(
            { error: "This PIN is already in use" },
            { status: 400 },
          );
        }
      }
    }

    const hashedPin = parsed.data.pin
      ? await hashPin(parsed.data.pin)
      : undefined;
    const staff = await prisma.staff.update({
      where: { id: parsed.data.id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(hashedPin !== undefined && { pin: hashedPin }),
        ...(parsed.data.role !== undefined && { role: parsed.data.role }),
        ...(parsed.data.isActive !== undefined && {
          isActive: parsed.data.isActive,
        }),
      },
    });

    revalidatePath("/dashboard/staff");
    revalidatePath("/dashboard/pos");
    return NextResponse.json(staff);
  } catch (err) {
    return apiError(err, "PUT /api/merchant/staff");
  }
}

export async function DELETE(req: Request) {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await requireStaffForApi("/api/merchant/staff");
    if (error) return error;

    const parsed = deleteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const existing = await prisma.staff.findFirst({
      where: { id: parsed.data.id, merchantId: merchant.id, isActive: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    await prisma.staff.update({
      where: { id: parsed.data.id },
      data: { isActive: false },
    });

    revalidatePath("/dashboard/staff");
    revalidatePath("/dashboard/pos");
    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError(err, "DELETE /api/merchant/staff");
  }
}
