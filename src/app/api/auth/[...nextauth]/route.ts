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
  return handlers.POST(req);
}
