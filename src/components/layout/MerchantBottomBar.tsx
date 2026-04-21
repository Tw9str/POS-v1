"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { IconLogout, IconKey } from "@/components/Icons";
import { switchUser, signOutMerchant } from "@/lib/staffActions";
import { useState, useEffect } from "react";
import { t, type Locale } from "@/lib/i18n";
import { NAV_ITEMS, BOTTOM_TAB_HREFS } from "@/lib/nav";

interface MerchantBottomBarProps {
  merchantName?: string;
  staffName?: string;
  staffRole?: string;
  allowedPages?: string[];
  language?: string;
}

export function MerchantBottomBar({
  merchantName = "My Store",
  staffName = "Staff",
  staffRole = "CASHIER",
  allowedPages = [],
  language = "en",
}: MerchantBottomBarProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const i = t(language as Locale);

  // Close "More" sheet on navigation
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const navItems = NAV_ITEMS.map((item) => ({
    ...item,
    label: i.nav[item.labelKey],
    short: i.nav[item.shortKey],
  }));

  const visibleItems = navItems.filter((item) =>
    allowedPages.some((p) => {
      if (p === item.href) return true;
      if (item.href.startsWith(p + "/")) return true;
      return false;
    }),
  );

  // Split into bottom tabs vs "more" items
  const tabItems = visibleItems.filter((i) => BOTTOM_TAB_HREFS.has(i.href));
  const moreItems = visibleItems.filter((i) => !BOTTOM_TAB_HREFS.has(i.href));
  const isMoreActive = moreItems.some((i) => isActive(i.href));

  const handleLock = () => switchUser();

  const handleSignOut = () => signOutMerchant();

  // If only 1 or fewer visible items, don't show bottom nav (e.g. cashier with only POS)
  const showBottomNav = visibleItems.length > 1;

  return (
    <>
      {/* ─── Mobile Bottom Tab Bar (<lg) ─── */}
      {showBottomNav && (
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/80 backdrop-blur-xl border-t border-slate-200/80"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="flex items-center justify-around h-16">
            {tabItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 min-w-15 py-1.5 rounded-xl transition-colors",
                    active
                      ? "text-indigo-600"
                      : "text-slate-400 active:text-slate-600",
                  )}
                >
                  <item.icon size={22} />
                  <span className="text-[10px] font-semibold leading-none mt-0.5">
                    {item.short}
                  </span>
                </Link>
              );
            })}

            {/* More button */}
            {moreItems.length > 0 && (
              <button
                onClick={() => setMoreOpen(true)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 min-w-15 py-1.5 rounded-xl transition-colors",
                  isMoreActive || moreOpen
                    ? "text-indigo-600"
                    : "text-slate-400 active:text-slate-600",
                )}
              >
                {/* Grid/More icon */}
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="12" r="1" />
                </svg>
                <span className="text-[10px] font-semibold leading-none mt-0.5">
                  {i.common.more}
                </span>
              </button>
            )}
          </div>
        </nav>
      )}

      {/* ─── More Bottom Sheet ─── */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 bg-black/25 backdrop-blur-sm z-50"
            onClick={() => setMoreOpen(false)}
          />

          {/* Sheet */}
          <div
            className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-3xl animate-[slideUp_0.2s_ease-out]"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            {/* Store info */}
            <div className="px-6 pb-4 border-b border-slate-100">
              <p className="font-bold text-slate-900 text-sm capitalize">
                {merchantName}
              </p>
              <p className="text-xs text-slate-400 mt-0.5 capitalize">
                {staffName} ·{" "}
                {i.roles[staffRole as keyof typeof i.roles] || staffRole}
              </p>
            </div>

            {/* Nav grid */}
            <div className="px-4 py-4 grid grid-cols-4 gap-1">
              {moreItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 py-4 rounded-2xl transition-colors active:scale-95",
                      active
                        ? "bg-indigo-50 text-indigo-600"
                        : "text-slate-600 active:bg-slate-50",
                    )}
                  >
                    <item.icon size={24} />
                    <span className="text-[11px] font-semibold">
                      {item.short}
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* Actions */}
            <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-1">
              <button
                onClick={handleLock}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold text-amber-600 hover:bg-amber-50 active:scale-[0.98] transition-all w-full cursor-pointer"
              >
                <IconKey size={20} />
                {i.common.switchUser}
              </button>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 active:scale-[0.98] transition-all w-full cursor-pointer"
              >
                <IconLogout size={20} />
                {i.common.signOut}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
