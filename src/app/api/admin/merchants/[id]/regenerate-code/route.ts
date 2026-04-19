import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { generateAccessCode, hashAccessCode } from "@/lib/accessCode";

/* ────── POST: regenerate access code for a merchant ────── */
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

    const existing = await prisma.merchant.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Generate new unique access code
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
      where: { id },
      data: { accessCodeDigest: digest },
    });

    await prisma.activityLog
      .create({
        data: {
          merchantId: id,
          userId: session.user.id,
          action: "ACCESS_CODE_REGENERATED",
          entity: "merchant",
          entityId: id,
        },
      })
      .catch(() => {});

    return NextResponse.json({ success: true, accessCode });
  } catch (err) {
    return apiError(err, "POST /api/admin/merchants/[id]/regenerate-code");
  }
}
