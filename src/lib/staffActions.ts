"use server";

import { clearStaffSession } from "@/lib/staffAuth";
import { clearMerchantSession } from "@/lib/merchantAuth";
import { redirect } from "next/navigation";

export async function switchUser() {
  await clearStaffSession();
  redirect("/dashboard");
}

export async function signOutMerchant() {
  await clearStaffSession();
  await clearMerchantSession();
  redirect("/store");
}
