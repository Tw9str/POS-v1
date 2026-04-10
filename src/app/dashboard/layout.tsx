import { getMerchantFromSession } from "@/lib/merchant";
import { redirect } from "next/navigation";
import { MerchantSidebar } from "@/components/layout/merchant-sidebar";
import { getStaffSession } from "@/lib/staff-auth";
import { getAllowedPages, type StaffRole } from "@/lib/staff";
import { DashboardGate } from "@/components/layout/dashboard-gate";
import { DashboardHydrator } from "@/components/dashboard-hydrator";
import { prisma } from "@/lib/db";

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
      <DashboardGate merchantId={merchant.id} merchantName={merchant.name} />
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

  return (
    <div className="flex h-screen overflow-hidden">
      <MerchantSidebar
        merchantName={merchant.name}
        staffName={staffName}
        staffRole={role}
        allowedPages={allowedPages}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8">
          <DashboardHydrator merchantId={merchant.id} />
          {children}
        </div>
      </main>
    </div>
  );
}
