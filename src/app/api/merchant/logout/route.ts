import { clearMerchantSession } from "@/lib/merchantAuth";
import { NextResponse } from "next/server";

export async function POST() {
  await clearMerchantSession();
  return NextResponse.json({ success: true });
}
