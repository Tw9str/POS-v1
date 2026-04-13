import { getMerchantFromSession } from "@/lib/merchant";
import { redirect } from "next/navigation";
import { MerchantSidebar } from "@/components/layout/merchant-sidebar";
import { getStaffSession } from "@/lib/staff-auth";
import { getAllowedPages, type StaffRole } from "@/lib/staff";
import { DashboardGate } from "@/components/layout/dashboard-gate";
import { DashboardHydrator } from "@/components/dashboard-hydrator";
import { prisma } from "@/lib/db";
import { getDirection, type Locale } from "@/lib/i18n";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const merchant = await getMerchantFromSession();

  if (!merchant) {
    redirect("/store");
  }

  const staffSession = await getStaffSession();

  // No staff session → show PIN gate
  if (!staffSession || staffSession.merchantId !== merchant.id) {
    return (
      <DashboardGate
        merchantId={merchant.id}
        merchantName={merchant.name}
        language={merchant.language ?? "en"}
      />
    );
  }

  const role = staffSession.role as StaffRole;
  const allowedPages = getAllowedPages(role);

  // Get staff name for sidebar display
  let staffName = "Staff";
  try {
    const staff = await prisma.staff.findUnique({
      where: { id: staffSession.staffId },
      select: { name: true },
    });
    if (staff) staffName = staff.name;
  } catch {
    // fallback to "Staff"
  }

  const language = (merchant.language ?? "en") as Locale;
  const dir = getDirection(language);

  return (
    <div
      className="h-dvh overflow-hidden bg-slate-50"
      dir={dir}
      lang={language}
    >
      <MerchantSidebar
        merchantName={merchant.name}
        staffName={staffName}
        staffRole={role}
        allowedPages={allowedPages}
        language={language}
      />
      <main className="h-full overflow-y-auto">
        <div className="max-w-400 mx-auto p-4 pb-[calc(var(--bottom-nav)+1rem)] lg:p-6">
          <DashboardHydrator merchantId={merchant.id} />
          {children}
        </div>
      </main>
    </div>
  );
}
