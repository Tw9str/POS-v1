import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/apiError";
import { NextResponse } from "next/server";
import { z } from "zod";

const revokeSchema = z.object({
  licenseId: z.string().min(1),
});

/* ────── GET: list license keys for a merchant ────── */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || session.user?.systemRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const url = new URL(req.url);
    const merchantId = url.searchParams.get("merchantId") || "";

    if (!merchantId) {
      return NextResponse.json(
        { error: "merchantId required" },
        { status: 400 },
      );
    }

    const licenses = await prisma.licenseKey.findMany({
      where: { merchantId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ licenses });
  } catch (err) {
    return apiError(err, "GET /api/admin/licenses");
  }
}

/* ────── DELETE: revoke a license key ────── */
export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session || session.user?.systemRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = revokeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "licenseId required" },
        { status: 400 },
      );
    }

    const license = await prisma.licenseKey.findUnique({
      where: { id: parsed.data.licenseId },
    });

    if (!license) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.licenseKey.update({
      where: { id: parsed.data.licenseId },
      data: { isRevoked: true },
    });

    await prisma.activityLog
      .create({
        data: {
          merchantId: license.merchantId,
          userId: session.user.id,
          action: "LICENSE_REVOKED",
          entity: "license",
          entityId: license.id,
        },
      })
      .catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError(err, "DELETE /api/admin/licenses");
  }
}
