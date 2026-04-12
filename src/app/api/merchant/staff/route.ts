import { prisma } from "@/lib/db";
import { getMerchantFromSession } from "@/lib/merchant";
import { requireStaffForApi } from "@/lib/staff";
import { NextResponse } from "next/server";
import { z } from "zod";

const staffSchema = z.object({
  name: z.string().min(1).max(100),
  pin: z.string().min(4).max(6).regex(/^\d+$/, "PIN must be digits only"),
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
        pin: true,
        isActive: true,
        maxDiscountPercent: true,
      },
    });

    return NextResponse.json(staffList);
  } catch (err) {
    console.error("GET /api/merchant/staff error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await requireStaffForApi("/api/merchant/staff");
    if (error) return error;

    const body = await req.json();
    const parsed = staffSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    // Check unique PIN per merchant (plain text)
    const pinExists = await prisma.staff.findUnique({
      where: {
        merchantId_pin: { merchantId: merchant.id, pin: parsed.data.pin },
      },
    });

    if (pinExists) {
      return NextResponse.json(
        { error: "This PIN is already in use" },
        { status: 400 },
      );
    }

    const staff = await prisma.staff.create({
      data: {
        merchantId: merchant.id,
        name: parsed.data.name,
        pin: parsed.data.pin,
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

    return NextResponse.json(staff, { status: 201 });
  } catch (err) {
    console.error("POST /api/merchant/staff error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
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

    if (parsed.data.pin && parsed.data.pin !== existing.pin) {
      const pinExists = await prisma.staff.findUnique({
        where: {
          merchantId_pin: { merchantId: merchant.id, pin: parsed.data.pin },
        },
      });

      if (pinExists) {
        return NextResponse.json(
          { error: "This PIN is already in use" },
          { status: 400 },
        );
      }
    }

    const staff = await prisma.staff.update({
      where: { id: parsed.data.id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.pin !== undefined && { pin: parsed.data.pin }),
        ...(parsed.data.role !== undefined && { role: parsed.data.role }),
        ...(parsed.data.isActive !== undefined && {
          isActive: parsed.data.isActive,
        }),
      },
    });

    return NextResponse.json(staff);
  } catch (err) {
    console.error("PUT /api/merchant/staff error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
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

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/merchant/staff error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
