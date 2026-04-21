import { getMerchantFromSession } from "@/lib/merchant";
import { redirect } from "next/navigation";
import { MerchantBottomBar } from "@/components/layout/MerchantBottomBar";
import { getStaffSession } from "@/lib/staffAuth";
import { getAllowedPaths } from "@/lib/staff";
import { DashboardGate } from "@/components/layout/DashboardGate";
import { LicenseGate } from "@/components/layout/LicenseGate";
import { SuspendedScreen } from "@/components/layout/SuspendedScreen";
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

  // Suspended merchant → show suspended screen
  if (!merchant.isActive) {
    const language = (merchant.language ?? "en") as Locale;
    const dir = getDirection(language);
    return (
      <div dir={dir} lang={language}>
        <SuspendedScreen language={language} />
      </div>
    );
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
        <DashboardGate merchantName={merchant.name} language={language} />
      </div>
    );
  }

  const allowedPages = getAllowedPaths(
    staffSession.allowedPages,
    staffSession.isOwner,
  );

  // Get staff name for bottom bar display
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
      <LicenseGate merchantId={merchant.id} language={language}>
        <MerchantBottomBar
          merchantName={merchant.name}
          staffName={staffName}
          staffRole={staffSession.role}
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
