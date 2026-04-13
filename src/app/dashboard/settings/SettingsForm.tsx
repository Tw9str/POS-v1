"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useRouter } from "next/navigation";
import { offlineFetch } from "@/lib/offline-fetch";
import { normalizeDateFormat } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { IconCamera } from "@/components/Icons";

interface SettingsFormProps {
  merchant: {
    id: string;
    name: string;
    phone: string;
    address: string;
    currency: string;
    currencyFormat: string;
    numberFormat: string;
    dateFormat: string;
    language: string;
    taxRate: number;
    shamcashId: string;
  };
}

const DEFAULT_CURRENCIES = ["USD", "EUR", "SAR", "SYP", "TRY", "AED"] as const;
type DefaultCurrency = (typeof DEFAULT_CURRENCIES)[number];

export function SettingsForm({ merchant }: SettingsFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [shamcashScannerOpen, setShamcashScannerOpen] = useState(false);
  const isCustomCurrency = !DEFAULT_CURRENCIES.includes(
    merchant.currency as DefaultCurrency,
  );
  const [showCustomCurrency, setShowCustomCurrency] =
    useState(isCustomCurrency);
  const [form, setForm] = useState({
    name: merchant.name,
    phone: merchant.phone,
    address: merchant.address,
    currency: merchant.currency,
    currencyFormat: merchant.currencyFormat || "symbol",
    numberFormat: merchant.numberFormat,
    dateFormat: normalizeDateFormat(merchant.dateFormat),
    language: merchant.language,
    taxRate: merchant.taxRate.toString(),
    shamcashId: merchant.shamcashId,
  });

  const i = t(form.language as Locale);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await offlineFetch({
        url: "/api/merchant/settings",
        method: "PUT",
        body: {
          ...form,
          currency: form.currency.toUpperCase(),
          taxRate: parseFloat(form.taxRate) || 0,
          shamcashId: form.shamcashId,
        },
        entity: "settings",
        merchantId: merchant.id,
      });

      if (!result.ok) {
        setError(result.error || i.settings.failedToUpdate);
        return;
      }

      setSuccess(
        result.offline
          ? i.settings.settingsSavedOffline
          : i.settings.settingsSaved,
      );
      if (!result.offline) router.refresh();
    } catch {
      setError(i.common.somethingWentWrong);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
      {/* ── Store Information ── */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-5">
          {i.settings.storeInformation}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            id="name"
            label={i.settings.storeName}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            id="phone"
            label={i.settings.phone}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <div className="md:col-span-2">
            <Input
              id="address"
              label={i.settings.address}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* ── Currency ── */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-5">
          {i.settings.currency}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            id="currency"
            label={i.settings.currency}
            value={showCustomCurrency ? "__custom__" : form.currency}
            onChange={(e) => {
              if (e.target.value === "__custom__") {
                setShowCustomCurrency(true);
                setForm({ ...form, currency: "" });
              } else {
                setShowCustomCurrency(false);
                setForm({ ...form, currency: e.target.value });
              }
            }}
            options={[
              { value: "USD", label: i.settings.currencyUSD },
              { value: "EUR", label: i.settings.currencyEUR },
              { value: "SAR", label: i.settings.currencySAR },
              { value: "SYP", label: i.settings.currencySYP },
              { value: "TRY", label: i.settings.currencyTRY },
              { value: "AED", label: i.settings.currencyAED },
              { value: "__custom__", label: i.settings.customCurrency },
            ]}
          />
          <Select
            id="currencyFormat"
            label={i.settings.currencyFormat}
            value={form.currencyFormat}
            onChange={(e) =>
              setForm({ ...form, currencyFormat: e.target.value })
            }
            options={[
              { value: "symbol", label: i.settings.currencySymbol },
              { value: "code", label: i.settings.currencyCode },
              { value: "none", label: i.settings.currencyNone },
            ]}
          />
          {showCustomCurrency && (
            <Input
              id="customCurrency"
              label={i.settings.customCurrency}
              value={form.currency}
              onChange={(e) =>
                setForm({
                  ...form,
                  currency: e.target.value.toUpperCase().slice(0, 3),
                })
              }
              maxLength={3}
              placeholder="e.g. GBP"
              required
            />
          )}
        </div>
      </section>

      {/* ── Regional & Display ── */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-5">
          {i.settings.regionalSettings}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            id="language"
            label={i.settings.language}
            value={form.language}
            onChange={(e) => setForm({ ...form, language: e.target.value })}
            options={[
              { value: "en", label: i.settings.english },
              { value: "ar", label: i.settings.arabic },
            ]}
          />
          <Select
            id="numberFormat"
            label={i.settings.numberFormat}
            value={form.numberFormat}
            onChange={(e) => setForm({ ...form, numberFormat: e.target.value })}
            options={[
              { value: "western", label: i.settings.westernNumbers },
              { value: "eastern", label: i.settings.easternNumbers },
            ]}
          />
          <Select
            id="dateFormat"
            label={i.settings.dateDisplay}
            value={form.dateFormat}
            onChange={(e) =>
              setForm({
                ...form,
                dateFormat: e.target.value as "long" | "numeric" | "arabic",
              })
            }
            options={[
              { value: "long", label: i.settings.dateEnglish },
              { value: "numeric", label: i.settings.dateNumeric },
              { value: "arabic", label: i.settings.dateArabic },
            ]}
          />
        </div>
      </section>

      {/* ── Tax ── */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-5">
          {i.settings.taxSettings}
        </h2>
        <div className="max-w-xs">
          <Input
            id="taxRate"
            label={i.settings.taxRate}
            type="number"
            value={form.taxRate}
            onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
            min="0"
            max="100"
            step="0.01"
          />
        </div>
      </section>

      {/* ── ShamCash Payment ── */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-5">
          {i.settings.shamcashSettings}
        </h2>
        <div className="max-w-md space-y-1.5">
          <div className="relative">
            <Input
              id="shamcashId"
              label={i.settings.shamcashId}
              value={form.shamcashId}
              onChange={(e) =>
                setForm({ ...form, shamcashId: e.target.value.trim() })
              }
              placeholder={i.settings.shamcashIdPlaceholder}
              className="pr-11"
            />
            <div className="absolute right-2 bottom-1.5 flex items-center">
              <button
                type="button"
                onClick={() => setShamcashScannerOpen(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
                title={i.settings.shamcashId}
              >
                <IconCamera size={20} />
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500">{i.settings.shamcashIdHint}</p>
        </div>
      </section>

      {/* ── Feedback & Submit ── */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-green-600 bg-green-50 px-4 py-3 rounded-xl border border-green-100">
          {success}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          {i.common.save}
        </Button>
      </div>

      {shamcashScannerOpen && (
        <BarcodeScanner
          language={form.language}
          onScan={(value) => {
            setShamcashScannerOpen(false);
            setForm((prev) => ({ ...prev, shamcashId: value.trim() }));
          }}
          onClose={() => setShamcashScannerOpen(false)}
        />
      )}
    </form>
  );
}
