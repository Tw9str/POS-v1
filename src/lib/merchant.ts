import { prisma } from "@/lib/db";
import { getMerchantSession, setMerchantSession } from "@/lib/merchant-auth";
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
      merchant.address !== cached.address
    ) {
      await setMerchantSession({
        id: merchant.id,
        name: merchant.name,
        currency: merchant.currency,
        taxRate: merchant.taxRate,
        phone: merchant.phone,
        address: merchant.address,
      });
    }

    return merchant;
  } catch {
    // DB unreachable (offline) — return cached merchant data from cookie
    return {
      id: cached.id,
      name: cached.name,
      slug: "",
      accessCode: "",
      phone: cached.phone,
      address: cached.address,
      logo: null,
      currency: cached.currency,
      timezone: "Asia/Damascus",
      taxRate: cached.taxRate,
      numberFormat: "western",
      dateFormat: "long",
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
