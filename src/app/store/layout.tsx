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
    let merchantExists = false;
    try {
      const merchant = await prisma.merchant.findUnique({
        where: { id: session.id },
        select: { id: true },
      });
      merchantExists = !!merchant;
    } catch {
      // DB unreachable — trust the cookie
      merchantExists = true;
    }
    if (merchantExists) {
      redirect("/dashboard");
    }
    // Merchant was deleted (DB reset) — clear stale cookie via route handler
    redirect("/api/merchant/logout");
  }
  return <>{children}</>;
}
