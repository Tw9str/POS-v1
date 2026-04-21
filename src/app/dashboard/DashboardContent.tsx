"use client";

import type { Order, Product, Customer } from "@/types/pos";
import {
  IconSettings,
  IconMoney,
  IconKey,
  IconLogout,
  IconOrders,
  IconCustomers,
} from "@/components/Icons";
import { formatCurrency, formatNumber, type NumberFormat } from "@/lib/utils";
import { getRefundAmount, getOrderCost } from "@/lib/productPerformance";
import { t, type Locale } from "@/lib/i18n";
import {
  useMemo,
  useState,
  useRef,
  useEffect,
  useCallback,
  useOptimistic,
  useTransition,
} from "react";
import Link from "next/link";
import { verifyCachedLicense } from "@/lib/clientLicense";
import { updateQuickSettings } from "@/app/actions/merchant";
import { switchUser, signOutMerchant } from "@/lib/staffActions";
import { NAV_CARDS } from "@/lib/nav";
import { useOutsideClick } from "@/hooks/useOutsideClick";

export function DashboardContent({
  merchantName,
  currency,
  currencyFormat: initialCurrencyFormat = "symbol",
  numberFormat: initialNumberFormat = "western",
  dateFormat: initialDateFormat = "long",
  language: initialLanguage = "en",
  staffName,
  staffRole,
  allowedPages,
  products,
  customers,
  orders,
}: {
  merchantName: string;
  currency: string;
  currencyFormat: "symbol" | "code" | "none";
  numberFormat?: NumberFormat;
  dateFormat?: string;
  language?: string;
  staffName: string;
  staffRole: string;
  allowedPages: string[];
  products: Product[];
  customers: Customer[];
  orders: Order[];
}) {
  type QuickSettings = {
    language: string;
    currencyFormat: "symbol" | "code" | "none";
    numberFormat: NumberFormat;
    dateFormat: string;
  };
  const [optimisticSettings, setOptimisticSettings] =
    useOptimistic<QuickSettings>({
      language: initialLanguage,
      currencyFormat: initialCurrencyFormat,
      numberFormat: initialNumberFormat,
      dateFormat: initialDateFormat,
    });
  const [, startTransition] = useTransition();
  const { language, currencyFormat, numberFormat, dateFormat } =
    optimisticSettings;

  const [licenseDaysLeft, setLicenseDaysLeft] = useState<number | null>(null);
  const i = t(language as Locale);

  useEffect(() => {
    verifyCachedLicense().then((s) => {
      if (s.valid && s.daysLeft > 0 && s.daysLeft <= 7) {
        setLicenseDaysLeft(s.daysLeft);
      }
    });
  }, []);

  // Quick settings
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);
  const [quickSettingsError, setQuickSettingsError] = useState<string | null>(
    null,
  );
  const [quickSettingsLoading, setQuickSettingsLoading] = useState(false);
  const quickSettingsRef = useRef<HTMLDivElement>(null);

  useOutsideClick(
    quickSettingsRef,
    useCallback(() => setQuickSettingsOpen(false), []),
    quickSettingsOpen,
  );

  const handleQuickSetting = useCallback(
    (field: keyof QuickSettings, value: string) => {
      setQuickSettingsError(null);
      setQuickSettingsLoading(true);
      startTransition(async () => {
        setOptimisticSettings({
          ...optimisticSettings,
          [field]: value,
        });
        try {
          const result = await updateQuickSettings({ [field]: value });
          if (result.error) {
            setQuickSettingsError(result.error);
          }
        } catch {
          setQuickSettingsError(i.common.somethingWentWrong);
        } finally {
          setQuickSettingsLoading(false);
        }
      });
    },
    [optimisticSettings, setOptimisticSettings, i.common.somethingWentWrong],
  );

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const stats = useMemo(() => {
    const saleOrders = orders.filter((order) => order.status !== "VOIDED");
    const refundedOrders = orders.filter(
      (order) =>
        order.status === "REFUNDED" || order.status === "PARTIALLY_REFUNDED",
    );

    const todayOrders = saleOrders.filter(
      (order) => order.createdAt >= todayStart,
    );
    const todayGross = todayOrders.reduce((sum, order) => sum + order.total, 0);
    const todayRefunds = todayOrders.reduce(
      (sum, order) => sum + getRefundAmount(order),
      0,
    );
    const todayGrossCogs = todayOrders.reduce(
      (sum, order) => sum + getOrderCost(order),
      0,
    );
    const refundedCogs = todayOrders.reduce((sum, order) => {
      const refundAmount = getRefundAmount(order);
      if (!refundAmount || order.total <= 0) return sum;
      return (
        sum + getOrderCost(order) * Math.min(1, refundAmount / order.total)
      );
    }, 0);

    const todayNet = todayGross - todayRefunds;
    const todayProfit = todayNet - (todayGrossCogs - refundedCogs);
    const profitMargin = todayNet > 0 ? (todayProfit / todayNet) * 100 : 0;
    const uniqueProducts = new Set(
      products
        .map((product) => product.name.trim().toLowerCase())
        .filter(Boolean),
    );
    const lowStockCount = products.filter(
      (product) =>
        product.trackStock &&
        product.stock > 0 &&
        product.stock <= Math.max(1, product.lowStockAt || 5),
    ).length;
    const outOfStockCount = products.filter(
      (product) => product.trackStock && product.stock <= 0,
    ).length;

    return {
      todayGross,
      todayRefunds,
      todayNet,
      todayProfit,
      profitMargin,
      todayOrderCount: todayOrders.length,
      productCount: uniqueProducts.size,
      variantCount: products.length,
      customerCount: customers.length,
      lowStockCount,
      outOfStockCount,
      refundedTodayCount: refundedOrders.filter(
        (order) => order.createdAt >= todayStart,
      ).length,
      totalOutstanding: customers.reduce((sum, c) => sum + (c.balance || 0), 0),
      debtorCount: customers.filter((c) => (c.balance || 0) > 0).length,
    };
  }, [products, customers, orders, todayStart]);

  const visibleCards = NAV_CARDS.filter((card) =>
    allowedPages.some(
      (page) => card.href === page || card.href.startsWith(page + "/"),
    ),
  );

  const handleLock = () => switchUser();
  const handleSignOut = () => signOutMerchant();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="w-14 h-14 bg-linear-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20"
          >
            <span className="text-2xl font-bold text-white">
              {merchantName.charAt(0).toUpperCase()}
            </span>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 uppercase">
              {merchantName}
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {i.common.today}{" "}
              {formatCurrency(
                stats.todayNet,
                currency,
                numberFormat,
                currencyFormat,
                language,
              )}{" "}
              · <bdi>{formatNumber(stats.todayOrderCount, numberFormat)}</bdi>{" "}
              {i.dashboard.orders}
            </p>
            <p className="text-xs text-slate-400 mt-0.5 capitalize">
              {staffName} ·{" "}
              {i.roles[staffRole as keyof typeof i.roles] || staffRole}
            </p>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-2">
          {allowedPages.includes("/dashboard/settings") && (
            <div className="relative" ref={quickSettingsRef}>
              <button
                onClick={() => setQuickSettingsOpen((o) => !o)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 active:scale-[0.98] transition-all cursor-pointer"
              >
                <IconSettings size={18} />
                {i.nav.settings}
                {licenseDaysLeft !== null && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                    {licenseDaysLeft}{" "}
                    {licenseDaysLeft !== 1 ? i.license.days : i.license.day}
                  </span>
                )}
              </button>

              {quickSettingsOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-4 space-y-4">
                  {quickSettingsLoading && (
                    <div className="absolute inset-0 bg-white/70 rounded-2xl flex items-center justify-center z-10">
                      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {quickSettingsError && (
                    <p
                      role="alert"
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
                    >
                      {quickSettingsError}
                    </p>
                  )}
                  {/* Language */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {i.settings.language}
                    </label>
                    <div className="mt-1.5 flex gap-1.5">
                      {(
                        [
                          ["en", i.settings.english],
                          ["ar", i.settings.arabic],
                        ] as const
                      ).map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => handleQuickSetting("language", val)}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${language === val ? "bg-indigo-100 text-indigo-700 border border-indigo-200" : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Currency Format */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {i.settings.currencyFormat}
                    </label>
                    <div className="mt-1.5 flex gap-1.5">
                      {(
                        [
                          ["symbol", i.settings.currencySymbol],
                          ["code", i.settings.currencyCode],
                          ["none", i.settings.currencyNone],
                        ] as const
                      ).map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() =>
                            handleQuickSetting("currencyFormat", val)
                          }
                          className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${currencyFormat === val ? "bg-indigo-100 text-indigo-700 border border-indigo-200" : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Number Format */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {i.settings.numberFormat}
                    </label>
                    <div className="mt-1.5 flex gap-1.5">
                      {(
                        [
                          ["western", i.settings.westernNumbers],
                          ["eastern", i.settings.easternNumbers],
                        ] as const
                      ).map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() =>
                            handleQuickSetting("numberFormat", val)
                          }
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${numberFormat === val ? "bg-indigo-100 text-indigo-700 border border-indigo-200" : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date Format */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {i.settings.dateDisplay}
                    </label>
                    <div className="mt-1.5 flex flex-col gap-1.5">
                      {(
                        [
                          ["long", i.settings.dateEnglish],
                          ["numeric", i.settings.dateNumeric],
                          ["arabic", i.settings.dateArabic],
                        ] as const
                      ).map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => handleQuickSetting("dateFormat", val)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors text-start cursor-pointer ${dateFormat === val ? "bg-indigo-100 text-indigo-700 border border-indigo-200" : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Link to full settings */}
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setQuickSettingsOpen(false)}
                    className="block text-center text-xs font-semibold text-indigo-600 hover:text-indigo-700 pt-2 border-t border-slate-100"
                  >
                    {i.settings.title} →
                  </Link>
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleLock}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-amber-600 hover:bg-amber-50 active:scale-[0.98] transition-all cursor-pointer"
          >
            <IconKey size={18} />
            {i.common.switchUser}
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 active:scale-[0.98] transition-all cursor-pointer"
          >
            <IconLogout size={18} />
            {i.common.signOut}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
            <IconOrders size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">
              {i.dashboard.refundedToday}
            </p>
            <p className="text-lg font-bold text-slate-900 tabular-nums">
              {formatCurrency(
                stats.todayRefunds,
                currency,
                numberFormat,
                currencyFormat,
                language,
              )}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <IconMoney size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">
              {i.dashboard.netToday}
            </p>
            <p className="text-lg font-bold text-slate-900 tabular-nums">
              {formatCurrency(
                stats.todayNet,
                currency,
                numberFormat,
                currencyFormat,
                language,
              )}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <IconMoney size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">
              {i.dashboard.profitToday}
            </p>
            <p className="text-lg font-bold text-slate-900 tabular-nums">
              {formatCurrency(
                stats.todayProfit,
                currency,
                numberFormat,
                currencyFormat,
                language,
              )}
            </p>
            <p className="text-[11px] text-indigo-600 font-semibold">
              {stats.profitMargin.toFixed(1)}% {i.dashboard.margin}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
            <IconOrders size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">
              {i.dashboard.ordersToday}
            </p>
            <p className="text-lg font-bold text-slate-900 tabular-nums">
              {formatNumber(stats.todayOrderCount, numberFormat)}
            </p>
          </div>
        </div>
        {stats.totalOutstanding > 0 ? (
          <Link
            href="/dashboard/customers"
            className="bg-white rounded-2xl border border-amber-200 p-4 flex items-center gap-3 hover:border-amber-300 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <IconCustomers size={20} />
            </div>
            <div>
              <p className="text-xs text-amber-600 font-medium">
                {i.dashboard.outstanding}
              </p>
              <p className="text-lg font-bold text-amber-700 tabular-nums">
                {formatCurrency(
                  stats.totalOutstanding,
                  currency,
                  numberFormat,
                  currencyFormat,
                  language,
                )}
              </p>
              <p className="text-[11px] text-amber-600 font-semibold">
                {i.dashboard.outstandingSubtitle.replace(
                  "{count}",
                  formatNumber(stats.debtorCount, numberFormat),
                )}
              </p>
            </div>
          </Link>
        ) : (
          <Link
            href="/dashboard/customers"
            className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center gap-3 hover:border-slate-300 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <IconCustomers size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">
                {i.dashboard.outstanding}
              </p>
              <p className="text-lg font-bold text-emerald-600 tabular-nums">
                {formatCurrency(
                  0,
                  currency,
                  numberFormat,
                  currencyFormat,
                  language,
                )}
              </p>
            </div>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {visibleCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 hover:shadow-lg hover:border-slate-300 active:scale-[0.97] transition-all group"
          >
            <div
              className={`w-14 h-14 ${card.color} rounded-2xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform`}
            >
              <card.icon size={28} className="text-white" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">
              {i.nav[card.labelKey]}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {i.dashboard[card.descKey]}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
