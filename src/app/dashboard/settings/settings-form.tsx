"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { offlineFetch } from "@/lib/offline-fetch";

interface SettingsFormProps {
  merchant: {
    id: string;
    name: string;
    phone: string;
    address: string;
    currency: string;
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
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: merchant.name,
    phone: merchant.phone,
    address: merchant.address,
    currency: merchant.currency,
    taxRate: merchant.taxRate.toString(),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

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
        setError(result.error || "Failed to update settings");
        return;
      }

      setSuccess(true);
      if (!result.offline) router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Store Information */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-5">
          Store Information
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="name"
            label="Store Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            id="phone"
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            id="address"
            label="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <Select
            id="currency"
            label="Currency"
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            options={currencies}
          />
          <Input
            id="taxRate"
            label="Tax Rate (%)"
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
              Settings updated successfully
            </p>
          )}

          <div className="flex justify-end pt-4">
            <Button type="submit" loading={loading}>
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
