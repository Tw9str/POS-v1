import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { setStaffSession, clearStaffSession } from "@/lib/staffAuth";
import { getMerchantSession } from "@/lib/merchantAuth";
import { verifyPin } from "@/lib/pinHash";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

const pinSchema = z.object({
  pin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
});

const pinLimiter = rateLimit({ limit: 5, windowSeconds: 60 });

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = pinLimiter.check(ip);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many PIN attempts. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSeconds) },
        },
      );
    }

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
      // DB unreachable — fail closed; cannot verify merchant status
      return NextResponse.json(
        { error: "Unable to verify store status. Please try again later." },
        { status: 503 },
      );
    }

    if (!merchant || !merchant.isActive) {
      return NextResponse.json(
        { error: "Store not found or inactive" },
        { status: 404 },
      );
    }

    // Find staff by comparing PIN against hashed values
    let staff: {
      id: string;
      name: string;
      role: string;
      isActive: boolean;
    } | null = null;
    try {
      const allStaff = await prisma.staff.findMany({
        where: { merchantId: merchant.id, isActive: true },
        select: {
          id: true,
          name: true,
          role: true,
          pin: true,
          isActive: true,
        },
      });
      for (const s of allStaff) {
        if (await verifyPin(pin, s.pin)) {
          staff = {
            id: s.id,
            name: s.name,
            role: s.role,
            isActive: s.isActive,
          };
          break;
        }
      }
    } catch {
      // DB unreachable · cannot verify PIN
      return NextResponse.json(
        {
          error: "Cannot verify PIN right now. Please try again later.",
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
  try {
    await clearStaffSession();
  } catch {
    // Best-effort cookie clear
  }
  return NextResponse.json({ success: true });
}
