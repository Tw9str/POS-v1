import { handlers } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { NextRequest, NextResponse } from "next/server";

const magicLinkLimiter = rateLimit({ limit: 3, windowSeconds: 60 });

export const { GET } = handlers;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = magicLinkLimiter.check(ip);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      },
    );
  }

  // Block magic link emails to anyone other than the admin
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase();
  if (adminEmail) {
    try {
      const cloned = req.clone();
      const body = await cloned.formData();
      const email = body.get("email");
      if (typeof email === "string" && email.toLowerCase() !== adminEmail) {
        return NextResponse.json(
          { error: "Unauthorized email address" },
          { status: 403 },
        );
      }
    } catch {
      // If body parsing fails, let NextAuth handle it
    }
  }

  return handlers.POST(req);
}
