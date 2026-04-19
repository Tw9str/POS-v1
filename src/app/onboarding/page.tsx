import { getMerchantFromSession } from "@/lib/merchant";
import { redirect } from "next/navigation";
import { OnboardingForm } from "./OnboardingForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Setup Your Store" };

export default async function OnboardingPage() {
  const merchant = await getMerchantFromSession();

  if (!merchant) {
    redirect("/store");
  }

  if (merchant.onboardingDone) {
    redirect("/dashboard");
  }

  return (
    <OnboardingForm
      merchantName={merchant.name}
      language={merchant.language ?? "en"}
    />
  );
}
