import { prisma } from "@/lib/db";
import { getMerchantFromSession } from "@/lib/merchant";
import { NextResponse } from "next/server";
import { z } from "zod";

const supplierSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(30).optional().default(""),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().max(500).optional().default(""),
  notes: z.string().max(1000).optional().default(""),
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
