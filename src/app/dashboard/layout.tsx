import { getMerchantFromSession } from "@/lib/merchant";
import { redirect } from "next/navigation";
import { MerchantSidebar } from "@/components/layout/MerchantSidebar";
import { getStaffSession } from "@/lib/staffAuth";
import { getAllowedPages, type StaffRole } from "@/lib/staff";
import { DashboardGate } from "@/components/layout/DashboardGate";
import { LicenseGate } from "@/components/layout/LicenseGate";
import { prisma } from "@/lib/db";
import { getDirection, t, type Locale } from "@/lib/i18n";
import { getMerchantSession } from "@/lib/merchantAuth";

export async function generateMetadata() {
  const session = await getMerchantSession();
  const locale = (session?.language ?? "en") as Locale;
  const dashboard = t(locale).nav.dashboard;
  return {
    title: {
      template: `%s | ${dashboard}`,
      default: dashboard,
    },
  };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const merchant = await getMerchantFromSession();

  if (!merchant) {
    redirect("/store");
  }

  // Onboarding not done → redirect to onboarding page
  if (!merchant.onboardingDone) {
    redirect("/onboarding");
  }

  const staffSession = await getStaffSession();

  // No staff session → show PIN gate
  if (!staffSession || staffSession.merchantId !== merchant.id) {
    const language = (merchant.language ?? "en") as Locale;
    const dir = getDirection(language);

    return (
      <div dir={dir} lang={language}>
        <DashboardGate
          merchantId={merchant.id}
          merchantName={merchant.name}
          language={language}
        />
      </div>
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
      <LicenseGate merchantId={merchant.id}>
        <MerchantSidebar
          merchantName={merchant.name}
          staffName={staffName}
          staffRole={role}
          allowedPages={allowedPages}
          language={language}
        />
        <main className="h-full overflow-y-auto">
          <div className="max-w-400 mx-auto p-4 pb-[calc(var(--bottom-nav)+1rem)] lg:p-6">
            {children}
          </div>
        </main>
      </LicenseGate>
    </div>
  );
}
