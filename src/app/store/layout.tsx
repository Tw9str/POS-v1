import { getMerchantSession } from "@/lib/merchantAuth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Store Access" };

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getMerchantSession();
  if (session) {
    // Verify the merchant still exists in DB before redirecting
    let merchantActive = false;
    try {
      const merchant = await prisma.merchant.findUnique({
        where: { id: session.id },
        select: { id: true, isActive: true },
      });
      merchantActive = !!merchant?.isActive;
    } catch {
      // DB unreachable — trust the cookie
      merchantActive = true;
    }
    if (merchantActive) {
      redirect("/dashboard");
    }
    // Merchant was deleted (DB reset) — clear stale cookie via route handler
    redirect("/api/merchant/logout");
  }
  return <>{children}</>;
}
