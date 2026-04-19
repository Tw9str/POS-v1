import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session || session.user?.systemRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;

    const merchant = await prisma.merchant.findUnique({ where: { id } });
    if (!merchant) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.merchant.update({
      where: { id },
      data: { isActive: !merchant.isActive },
    });

    await prisma.activityLog
      .create({
        data: {
          merchantId: id,
          userId: session.user.id,
          action: merchant.isActive
            ? "MERCHANT_SUSPENDED"
            : "MERCHANT_ACTIVATED",
          entity: "merchant",
          entityId: id,
        },
      })
      .catch(() => {});

    return NextResponse.json({ success: true, isActive: !merchant.isActive });
  } catch (err) {
    return apiError(err, "POST /api/admin/merchants/[id]/toggle");
  }
}
