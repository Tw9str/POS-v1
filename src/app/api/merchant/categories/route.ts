import { prisma } from "@/lib/db";
import { getMerchantFromSession } from "@/lib/merchant";
import { requireStaffForApi } from "@/lib/staff";
import { NextResponse } from "next/server";
import { z } from "zod";

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  color: z.string().max(20).optional().nullable().default("#4f46e5"),
  sortOrder: z.number().int().min(0).optional().default(0),
});

const deleteSchema = z.object({
  id: z.string().min(1),
});

export async function GET() {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await requireStaffForApi("/api/merchant/products");
    if (error) return error;

    const categories = await prisma.category.findMany({
      where: { merchantId: merchant.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(categories);
  } catch (err) {
    console.error("GET /api/merchant/categories error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const merchant = await getMerchantFromSession();
    if (!merchant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await requireStaffForApi("/api/merchant/products");
    if (error) return error;

    const parsed = categorySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const exists = await prisma.category.findFirst({
      where: {
        merchantId: merchant.id,
        name: parsed.data.name,
        isActive: true,
      },
    });

    if (exists) {
      return NextResponse.json(
        { error: "Category already exists" },
        { status: 400 },
      );
    }

    const category = await prisma.category.create({
      data: {
        merchantId: merchant.id,
        name: parsed.data.name,
        color: parsed.data.color || "#4f46e5",
        sortOrder: parsed.data.sortOrder,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    console.error("POST /api/merchant/categories error:", err);
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

    const { error } = await requireStaffForApi("/api/merchant/products");
    if (error) return error;

    const parsed = categorySchema.extend({ id: z.string().min(1) }).safeParse(
      await req.json(),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const category = await prisma.category.findFirst({
      where: { id: parsed.data.id, merchantId: merchant.id, isActive: true },
    });
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const duplicate = await prisma.category.findFirst({
      where: {
        merchantId: merchant.id,
        name: parsed.data.name,
        isActive: true,
        NOT: { id: parsed.data.id },
      },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "Category already exists" },
        { status: 400 },
      );
    }

    const updated = await prisma.category.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        color: parsed.data.color || "#4f46e5",
        sortOrder: parsed.data.sortOrder,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/merchant/categories error:", err);
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

    const { error } = await requireStaffForApi("/api/merchant/products");
    if (error) return error;

    const parsed = deleteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const category = await prisma.category.findFirst({
      where: { id: parsed.data.id, merchantId: merchant.id, isActive: true },
    });
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    await prisma.category.update({
      where: { id: category.id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/merchant/categories error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
