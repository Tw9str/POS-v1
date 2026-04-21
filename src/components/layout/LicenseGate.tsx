"use client";

import { useEffect, useState } from "react";
import {
  fetchAndCacheLicense,
  type ClientLicenseStatus,
} from "@/lib/clientLicense";
import { signOutMerchant } from "@/lib/staffActions";
import { SuspendedScreen } from "@/components/layout/SuspendedScreen";
import { t, type Locale } from "@/lib/i18n";

interface LicenseGateProps {
  merchantId: string;
  language: Locale;
  children: React.ReactNode;
}

export function LicenseGate({
  merchantId,
  language,
  children,
}: LicenseGateProps) {
  const [status, setStatus] = useState<ClientLicenseStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const i = t(language);

  useEffect(() => {
    let mounted = true;

    async function check(showLoader = false) {
      if (showLoader && mounted) {
        setChecking(true);
      }

      const result = await fetchAndCacheLicense();

      if (mounted) {
        setStatus(result);
        setChecking(false);
      }
    }

    check(true);

    function handleFocus() {
      void check();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void check();
      }
    }

    // Re-check every 60s to detect deactivation or license changes
    const interval = setInterval(() => void check(), 60_000);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [merchantId]);

  if (checking) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!status?.valid) {
    if (status?.reason === "suspended") {
      return <SuspendedScreen language={language} />;
    }
    return <LicenseExpiredScreen status={status} i={i} />;
  }

  const showBanner =
    status.inGrace || (status.daysLeft > 0 && status.daysLeft <= 7);

  return (
    <>
      {showBanner && (
        <NotificationBanner
          inGrace={status.inGrace}
          daysLeft={status.daysLeft}
          graceDaysLeft={status.graceDaysLeft}
          i={i}
        />
      )}
      {children}
    </>
  );
}

function LicenseExpiredScreen({
  status,
  i,
}: {
  status: ClientLicenseStatus | null;
  i: ReturnType<typeof t>;
}) {
  const reason = status?.reason ?? "expired";

  return (
    <div className="flex h-dvh items-center justify-center bg-slate-50">
      <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-white p-8 shadow-lg text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-8 w-8 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <h1 className="mb-2 text-xl font-bold text-gray-900">
          {reason === "no_license"
            ? i.license.licenseRequired
            : reason === "no_public_key"
              ? i.license.activationRequired
              : i.license.licenseExpired}
        </h1>

        <p className="mb-6 text-sm text-gray-600">
          {reason === "no_license" || reason === "no_public_key"
            ? i.license.activationMessage
            : i.license.expiredMessage}
        </p>

        {status?.expiresAt && (
          <p className="mb-4 text-xs text-gray-400">
            {i.license.expiredOn}{" "}
            {new Date(status.expiresAt).toLocaleDateString()}
          </p>
        )}

        <div className="flex flex-col gap-3 mt-2">
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
          >
            {i.license.retry}
          </button>
          <button
            onClick={() => signOutMerchant()}
            className="rounded-lg bg-slate-100 px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            {i.license.signOut}
          </button>
        </div>
      </div>
    </div>
  );
}

function NotificationBanner({
  inGrace,
  daysLeft,
  graceDaysLeft,
  i,
}: {
  inGrace: boolean;
  daysLeft: number;
  graceDaysLeft: number;
  i: ReturnType<typeof t>;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const isUrgent = inGrace || daysLeft <= 2;
  const unit = daysLeft !== 1 ? i.license.days : i.license.day;
  const graceUnit = graceDaysLeft !== 1 ? i.license.days : i.license.day;
  const message = inGrace
    ? `${i.license.gracePrefix} ${i.license.graceMessage.replace("{days}", `${graceDaysLeft} ${graceUnit}`)}`
    : i.license.expiringMessage.replace("{days}", `${daysLeft} ${unit}`);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center p-3">
      <div
        className={`pointer-events-auto flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur-sm animate-in slide-in-from-top-2 duration-300 ${
          isUrgent ? "bg-red-600/95 text-white" : "bg-amber-500/95 text-white"
        }`}
      >
        <svg
          className="h-4 w-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          {isUrgent ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          ) : (
            <>
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" d="M12 6v6l4 2" />
            </>
          )}
        </svg>
        <span>{message}</span>
        <button
          onClick={() => setDismissed(true)}
          className="ml-1 rounded-lg p-0.5 hover:bg-white/20 transition-colors cursor-pointer"
          aria-label="Dismiss"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
