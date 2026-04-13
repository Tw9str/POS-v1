import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { setStaffSession, clearStaffSession } from "@/lib/staffAuth";
import { getMerchantSession } from "@/lib/merchantAuth";

const pinSchema = z.object({
  pin: z.string().min(4).max(6).regex(/^\d+$/, "PIN must be digits only"),
  offlineVerified: z.boolean().optional(),
  staffId: z.string().optional(),
  staffName: z.string().optional(),
  staffRole: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = pinSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid PIN" },
        { status: 400 },
      );
    }

    const { pin } = parsed.data;

    // Get merchant from session cookie
    const merchantSession = await getMerchantSession();
    if (!merchantSession) {
      return NextResponse.json(
        { error: "Store session not found" },
        { status: 401 },
      );
    }

    // Verify merchant exists and is active
    let merchant: {
      id: string;
      isActive: boolean;
      name: string;
      currency: string;
      taxRate: number;
    } | null;
    try {
      merchant = await prisma.merchant.findUnique({
        where: { id: merchantSession.id },
        select: {
          id: true,
          isActive: true,
          name: true,
          currency: true,
          taxRate: true,
        },
      });
    } catch {
      // DB unreachable (offline) · use cached merchant data for PIN verification
      merchant = { ...merchantSession, isActive: true };
    }

    if (!merchant || !merchant.isActive) {
      return NextResponse.json(
        { error: "Store not found or inactive" },
        { status: 404 },
      );
    }

    // Find staff by plain PIN within this merchant
    let staff: {
      id: string;
      name: string;
      role: string;
      isActive: boolean;
    } | null = null;
    try {
      staff = await prisma.staff.findUnique({
        where: {
          merchantId_pin: { merchantId: merchant.id, pin },
        },
        select: {
          id: true,
          name: true,
          role: true,
          isActive: true,
        },
      });
    } catch {
      // DB unreachable · if client already verified PIN against IndexedDB, trust it
      if (
        parsed.data.offlineVerified &&
        parsed.data.staffId &&
        parsed.data.staffRole
      ) {
        await setStaffSession({
          staffId: parsed.data.staffId,
          merchantId: merchant.id,
          role: parsed.data.staffRole,
        });
        return NextResponse.json({
          staff: {
            id: parsed.data.staffId,
            name: parsed.data.staffName || "Staff",
            role: parsed.data.staffRole,
          },
        });
      }
      return NextResponse.json(
        {
          error:
            "Cannot verify PIN while offline. Please try again when connected.",
        },
        { status: 503 },
      );
    }

    if (!staff) {
      return NextResponse.json(
        { error: "Invalid PIN. Please try again." },
        { status: 401 },
      );
    }

    if (!staff.isActive) {
      return NextResponse.json(
        { error: "Your account has been deactivated. Contact your manager." },
        { status: 403 },
      );
    }

    // Set staff session cookie
    await setStaffSession({
      staffId: staff.id,
      merchantId: merchant.id,
      role: staff.role,
    });

    return NextResponse.json({
      staff: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
      },
    });
  } catch (err) {
    console.error("POST /api/staff/auth error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  await clearStaffSession();
  return NextResponse.json({ success: true });
}
