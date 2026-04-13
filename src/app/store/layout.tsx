import { getMerchantSession } from "@/lib/merchantAuth";
import { redirect } from "next/navigation";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const merchant = await getMerchantSession();
  if (merchant) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
