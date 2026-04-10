import { prisma } from "@/lib/db";
import { getMerchantFromSession } from "@/lib/merchant";
import { requireStaffForApi } from "@/lib/staff";
import { NextResponse } from "next/server";
import { z } from "zod";

const supplierSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(30).optional().default(""),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().max(500).optional().default(""),
  notes: z.string().max(1000).optional().default(""),
});

const supplierUpdateSchema = supplierSchema.extend({
  id: z.string().min(1),
});

const deleteSchema = z.object({
  id: z.string().min(1),
});

export async function GET() {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const suppliers = await prisma.supplier.findMany({
      where: { merchantId: merchant.id },
      orderBy: { name: "asc" },
      include: { _count: { select: { purchaseOrders: true } } },
    });

    return NextResponse.json(
      suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        email: s.email,
        address: s.address,
        notes: s.notes,
        _orderCount: s._count.purchaseOrders,
      })),
    );
  } catch (err) {
    console.error("GET /api/merchant/suppliers error:", err);
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

    const { error } = await requireStaffForApi("/api/merchant/suppliers");
    if (error) return error;

    const body = await req.json();
    const parsed = supplierSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const supplier = await prisma.supplier.create({
      data: {
        merchantId: merchant.id,
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
        notes: parsed.data.notes || null,
      },
    });

    await prisma.activityLog
      .create({
        data: {
          merchantId: merchant.id,
          action: "SUPPLIER_CREATED",
          entity: "supplier",
          entityId: supplier.id,
        },
      })
      .catch(() => {});

    return NextResponse.json(supplier, { status: 201 });
  } catch (err) {
    console.error("POST /api/merchant/suppliers error:", err);
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

    const { error } = await requireStaffForApi("/api/merchant/suppliers");
    if (error) return error;

    const parsed = supplierUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const existing = await prisma.supplier.findFirst({
      where: { id: parsed.data.id, merchantId: merchant.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    const supplier = await prisma.supplier.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
        notes: parsed.data.notes || null,
      },
    });

    return NextResponse.json(supplier);
  } catch (err) {
    console.error("PUT /api/merchant/suppliers error:", err);
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

    const { error } = await requireStaffForApi("/api/merchant/suppliers");
    if (error) return error;

    const parsed = deleteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const existing = await prisma.supplier.findFirst({
      where: { id: parsed.data.id, merchantId: merchant.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    await prisma.supplier.delete({ where: { id: parsed.data.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/merchant/suppliers error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
