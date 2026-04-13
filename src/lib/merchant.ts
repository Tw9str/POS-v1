import { prisma } from "@/lib/db";
import { getMerchantSession, setMerchantSession } from "@/lib/merchantAuth";
import { redirect } from "next/navigation";

export async function getMerchantFromSession() {
  const cached = await getMerchantSession();
  if (!cached) return null;

  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: cached.id },
      include: { subscription: true },
    });

    if (!merchant) return null;

    // Refresh cookie cache if merchant data changed
    if (
      merchant.name !== cached.name ||
      merchant.currency !== cached.currency ||
      merchant.taxRate !== cached.taxRate ||
      merchant.phone !== cached.phone ||
      merchant.address !== cached.address ||
      (merchant.numberFormat ?? "western") !== cached.numberFormat ||
      (merchant.dateFormat ?? "long") !== cached.dateFormat ||
      (merchant.language ?? "en") !== cached.language ||
      (merchant.currencyFormat ?? "symbol") !== cached.currencyFormat ||
      (merchant.shamcashId ?? null) !== cached.shamcashId ||
      (merchant.onboardingDone ?? false) !== cached.onboardingDone
    ) {
      await setMerchantSession({
        id: merchant.id,
        name: merchant.name,
        currency: merchant.currency,
        currencyFormat: merchant.currencyFormat ?? "symbol",
        taxRate: merchant.taxRate,
        phone: merchant.phone,
        address: merchant.address,
        numberFormat: merchant.numberFormat ?? "western",
        dateFormat: merchant.dateFormat ?? "long",
        language: merchant.language ?? "en",
        shamcashId: merchant.shamcashId ?? null,
        onboardingDone: merchant.onboardingDone ?? false,
      });
    }

    return merchant;
  } catch {
    // DB unreachable (offline) · return cached merchant data from cookie
    return {
      id: cached.id,
      name: cached.name,
      slug: "",
      accessCode: "",
      phone: cached.phone,
      address: cached.address,
      logo: null,
      currency: cached.currency,
      currencyFormat: cached.currencyFormat ?? "symbol",
      timezone: "Asia/Damascus",
      taxRate: cached.taxRate,
      numberFormat: cached.numberFormat ?? "western",
      dateFormat: cached.dateFormat ?? "long",
      language: cached.language ?? "en",
      shamcashId: cached.shamcashId ?? null,
      onboardingDone: cached.onboardingDone ?? false,
      isActive: true,
      subscription: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

export async function requireMerchant() {
  const merchant = await getMerchantFromSession();
  if (!merchant) {
    redirect("/store");
  }
  return merchant;
}
