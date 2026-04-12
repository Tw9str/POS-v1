import { auth } from "@/lib/auth";
import { getMerchantSession } from "@/lib/merchant-auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  // Check for merchant session (access code auth)
  const merchantSession = await getMerchantSession();
  if (merchantSession) {
    redirect("/dashboard");
  }

  // Check for admin session (next-auth)
  const session = await auth();
  if (session?.user?.systemRole === "SUPER_ADMIN") {
    redirect("/admin");
  }

  // No session go to store login
  redirect("/store");
}
