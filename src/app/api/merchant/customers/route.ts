import { prisma } from "@/lib/db";
import { getMerchantFromSession } from "@/lib/merchant";
import { NextResponse } from "next/server";
import { z } from "zod";

const customerSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

export async function GET() {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const customers = await prisma.customer.findMany({
      where: { merchantId: merchant.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true },
    });

    return NextResponse.json(customers);
  } catch (err) {
    console.error("GET /api/merchant/customers error:", err);
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
    const parsed = customerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const customer = await prisma.customer.create({
      data: {
        merchantId: merchant.id,
        ...parsed.data,
        email: parsed.data.email || null,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (err) {
    console.error("POST /api/merchant/customers error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
