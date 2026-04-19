"use client";
import type React from "react";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useRouter } from "next/navigation";
import { t, getDirection, type Locale } from "@/lib/i18n";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { IconCamera } from "@/components/Icons";

interface OnboardingFormProps {
  merchantName: string;
  language: string;
}

const CURRENCIES = [
  { value: "USD", key: "currencyUSD" },
  { value: "EUR", key: "currencyEUR" },
  { value: "SAR", key: "currencySAR" },
  { value: "SYP", key: "currencySYP" },
  { value: "TRY", key: "currencyTRY" },
  { value: "AED", key: "currencyAED" },
] as const;

export function OnboardingForm({
  merchantName,
  language: initialLanguage,
}: OnboardingFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shamcashScannerOpen, setShamcashScannerOpen] = useState(false);
  const [step, setStep] = useState(1);

  const [language, setLanguage] = useState<Locale>(
    (initialLanguage as Locale) || "en",
  );
  const i = t(language);
  const dir = getDirection(language);

  const [form, setForm] = useState({
    name: merchantName,
    phone: "",
    address: "",
    currency: "USD",
    taxRate: "0",
    shamcashId: "",
    ownerName: "",
    ownerPin: "",
    confirmPin: "",
  });

  const [pinError, setPinError] = useState("");

  function handleStep1(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPinError("");

    if (form.ownerPin.length !== 4) {
      setPinError(i.onboarding.pinPlaceholder);
      return;
    }
    if (form.ownerPin !== form.confirmPin) {
      setPinError(i.onboarding.pinMismatch);
      return;
    }

    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/merchant/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          address: form.address,
          currency: form.currency.toUpperCase(),
          language,
          taxRate: parseFloat(form.taxRate) || 0,
          shamcashId: form.shamcashId,
          ownerName: form.ownerName,
          ownerPin: form.ownerPin,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || i.onboarding.failedToSave);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(i.onboarding.failedToSave);
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/merchant/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name || merchantName,
          currency: form.currency || "USD",
          language,
          taxRate: 0,
          ownerName: form.ownerName,
          ownerPin: form.ownerPin,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || i.onboarding.failedToSave);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(i.onboarding.failedToSave);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      dir={dir}
      lang={language}
      className="min-h-dvh bg-linear-to-br from-indigo-50 via-white to-slate-50 flex items-start justify-center px-4 py-8 sm:py-12"
    >
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">
            {i.onboarding.title}
          </h1>
          <p className="text-sm text-slate-500">
            {step === 1 ? i.onboarding.subtitleStep1 : i.onboarding.subtitle}
          </p>
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <div className="w-8 h-1 rounded-full bg-indigo-600" />
            <div
              className={`w-8 h-1 rounded-full ${step === 2 ? "bg-indigo-600" : "bg-slate-200"}`}
            />
          </div>
        </div>

        {step === 1 ? (
          /* ═══════════ STEP 1: Account Setup (required) ═══════════ */
          <form onSubmit={handleStep1} className="space-y-6">
            {/* ── Language ── */}
            <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">
                {i.onboarding.languageFirst}
              </h2>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setLanguage("en")}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                    language === "en"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage("ar")}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                    language === "ar"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
                  }`}
                >
                  العربية
                </button>
              </div>
            </section>

            {/* ── Owner Account ── */}
            <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">
                {i.onboarding.accountSetup}
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                {i.onboarding.accountSetupHint}
              </p>
              <div className="space-y-4">
                <Input
                  id="ownerName"
                  label={i.onboarding.ownerName}
                  value={form.ownerName}
                  onChange={(e) =>
                    setForm({ ...form, ownerName: e.target.value })
                  }
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    id="ownerPin"
                    label={i.onboarding.pinPlaceholder}
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={form.ownerPin}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setForm({ ...form, ownerPin: v });
                      setPinError("");
                    }}
                    placeholder="••••"
                    required
                    error={pinError || undefined}
                  />
                  <Input
                    id="confirmPin"
                    label={i.onboarding.confirmPin}
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={form.confirmPin}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setForm({ ...form, confirmPin: v });
                      setPinError("");
                    }}
                    placeholder="••••"
                    required
                  />
                </div>
              </div>
            </section>

            {/* ── Error ── */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full">
              {i.onboarding.continue}
            </Button>
          </form>
        ) : (
          /* ═══════════ STEP 2: Store Settings (skippable) ═══════════ */
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ── Store Details ── */}
            <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">
                {i.onboarding.storeDetails}
              </h2>
              <div className="space-y-4">
                <Input
                  id="name"
                  label={i.onboarding.storeName}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                <Input
                  id="phone"
                  label={i.onboarding.phone}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
                <Input
                  id="address"
                  label={i.onboarding.address}
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </div>
            </section>

            {/* ── Currency & Tax ── */}
            <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">
                {i.onboarding.currencyAndTax}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  id="currency"
                  label={i.onboarding.currency}
                  value={form.currency}
                  onChange={(e) =>
                    setForm({ ...form, currency: e.target.value })
                  }
                  options={CURRENCIES.map(({ value, key }) => ({
                    value,
                    label: i.settings[key as keyof typeof i.settings] as string,
                  }))}
                />
                <Input
                  id="taxRate"
                  label={i.onboarding.taxRate}
                  type="number"
                  value={form.taxRate}
                  onChange={(e) =>
                    setForm({ ...form, taxRate: e.target.value })
                  }
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>
            </section>

            {/* ── ShamCash ── */}
            <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">
                {i.onboarding.shamcash}
              </h2>
              <div className="relative">
                <Input
                  id="shamcashId"
                  label=""
                  value={form.shamcashId}
                  onChange={(e) =>
                    setForm({ ...form, shamcashId: e.target.value.trim() })
                  }
                  placeholder={i.onboarding.shamcashPlaceholder}
                  className="pr-11"
                />
                <div className="absolute right-2 bottom-1.5 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShamcashScannerOpen(true)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
                  >
                    <IconCamera size={20} />
                  </button>
                </div>
              </div>
            </section>

            {/* ── Error ── */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">
                {error}
              </p>
            )}

            {/* ── Actions ── */}
            <div className="flex flex-col gap-3">
              <Button
                type="submit"
                size="lg"
                loading={loading}
                className="w-full"
              >
                {loading ? i.onboarding.settingUp : i.onboarding.saveAndStart}
              </Button>
              <button
                type="button"
                onClick={handleSkip}
                disabled={loading}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors py-2 cursor-pointer"
              >
                {i.onboarding.skip}
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={loading}
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors py-1 cursor-pointer"
              >
                {i.onboarding.back}
              </button>
            </div>
          </form>
        )}
      </div>

      {shamcashScannerOpen && (
        <BarcodeScanner
          language={language}
          onScan={(value) => {
            setShamcashScannerOpen(false);
            setForm((prev) => ({ ...prev, shamcashId: value.trim() }));
          }}
          onClose={() => setShamcashScannerOpen(false)}
        />
      )}
    </div>
  );
}
