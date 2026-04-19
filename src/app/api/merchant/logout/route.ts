import { clearMerchantSession } from "@/lib/merchantAuth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    await clearMerchantSession();
  } catch {
    // Best-effort cookie clear — redirect regardless
  }
  return NextResponse.redirect(new URL("/store", req.url));
}

export async function POST() {
  try {
    await clearMerchantSession();
  } catch {
    // Best-effort cookie clear
  }
  return NextResponse.json({ success: true });
}
