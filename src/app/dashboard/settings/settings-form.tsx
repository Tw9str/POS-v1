"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { offlineFetch } from "@/lib/offline-fetch";
import { normalizeDateFormat } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";

interface SettingsFormProps {
  merchant: {
    id: string;
    name: string;
    phone: string;
    address: string;
    currency: string;
    numberFormat: string;
    dateFormat: string;
    language: string;
    taxRate: number;
  };
}

const currencies = [
  { value: "SYP", label: "SYP - Syrian Pound" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "TRY", label: "TRY - Turkish Lira" },
  { value: "AED", label: "AED - UAE Dirham" },
  { value: "SAR", label: "SAR - Saudi Riyal" },
];

export function SettingsForm({ merchant }: SettingsFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: merchant.name,
    phone: merchant.phone,
    address: merchant.address,
    currency: merchant.currency,
    numberFormat: merchant.numberFormat,
    dateFormat: normalizeDateFormat(merchant.dateFormat),
    language: merchant.language,
    taxRate: merchant.taxRate.toString(),
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
          taxRate: parseFloat(form.taxRate) || 0,
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
    <div className="max-w-2xl">
      {/* Store Information */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-5">
          {i.settings.storeInformation}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <Input
            id="address"
            label={i.settings.address}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <Select
            id="currency"
            label={i.settings.currency}
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            options={currencies}
          />
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

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">
              {success}
            </p>
          )}

          <div className="flex justify-end pt-4">
            <Button type="submit" loading={loading}>
              {i.common.save}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
