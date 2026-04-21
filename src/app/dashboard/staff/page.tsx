import { requireMerchant } from "@/lib/merchant";
import { requireStaffForPage } from "@/lib/staff";
import { prisma } from "@/lib/db";
import { dbQuery } from "@/lib/apiError";
import { StaffContent } from "./StaffContent";
import { getMerchantSession } from "@/lib/merchantAuth";
import { t, type Locale } from "@/lib/i18n";

export async function generateMetadata() {
  const session = await getMerchantSession();
  const locale = (session?.language ?? "en") as Locale;
  return { title: t(locale).nav.staff };
}

export default async function StaffPage() {
  const merchant = await requireMerchant();
  const currentStaff = await requireStaffForPage("/dashboard/staff");

  const dbStaff = await dbQuery(() =>
    prisma.staff.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: "desc" },
    }),
  );

  return (
    <StaffContent
      currentStaffId={currentStaff?.staffId ?? null}
      numberFormat={
        (merchant.numberFormat ?? "western") as "western" | "eastern"
      }
      language={merchant.language ?? "en"}
      staff={dbStaff.map((s) => ({
        id: s.id,
        name: s.name,
        pin: s.pin,
        role: s.role,
        isActive: s.isActive,
        isOwner: s.isOwner,
        allowedPages: s.allowedPages,
        maxDiscountPercent: s.maxDiscountPercent,
      }))}
    />
  );
}
