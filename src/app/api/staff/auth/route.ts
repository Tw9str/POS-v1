import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { setStaffSession, clearStaffSession } from "@/lib/staffAuth";
import { getMerchantSession } from "@/lib/merchantAuth";
import { verifyPin } from "@/lib/pinHash";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { t, type Locale } from "@/lib/i18n";

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

    const i = t((merchantSession.language ?? "en") as Locale);

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
        { error: i.storeLogin.unableToVerify },
        { status: 503 },
      );
    }

    if (!merchant || !merchant.isActive) {
      return NextResponse.json(
        { error: i.storeLogin.storeInactive },
        { status: 404 },
      );
    }

    // Find staff by comparing PIN against hashed values
    let staff: {
      id: string;
      name: string;
      role: string;
      allowedPages: string[];
      isOwner: boolean;
      isActive: boolean;
    } | null = null;
    try {
      const allStaff = await prisma.staff.findMany({
        where: { merchantId: merchant.id, isActive: true },
        select: {
          id: true,
          name: true,
          role: true,
          allowedPages: true,
          isOwner: true,
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
            allowedPages: s.allowedPages,
            isOwner: s.isOwner,
            isActive: s.isActive,
          };
          break;
        }
      }
    } catch {
      // DB unreachable · cannot verify PIN
      return NextResponse.json(
        {
          error: i.storeLogin.cannotVerify,
        },
        { status: 503 },
      );
    }

    if (!staff) {
      return NextResponse.json({ error: i.pin.invalidPin }, { status: 401 });
    }

    if (!staff.isActive) {
      return NextResponse.json(
        { error: i.storeLogin.staffDeactivated },
        { status: 403 },
      );
    }

    // Set staff session cookie
    await setStaffSession({
      staffId: staff.id,
      merchantId: merchant.id,
      role: staff.role,
      allowedPages: staff.allowedPages,
      isOwner: staff.isOwner,
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
