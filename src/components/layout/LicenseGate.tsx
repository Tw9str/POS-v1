"use client";

import { useEffect, useState } from "react";
import {
  fetchAndCacheLicense,
  type ClientLicenseStatus,
} from "@/lib/clientLicense";

interface LicenseGateProps {
  merchantId: string;
  children: React.ReactNode;
}

export function LicenseGate({ merchantId, children }: LicenseGateProps) {
  const [status, setStatus] = useState<ClientLicenseStatus | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const result = await fetchAndCacheLicense();

      if (mounted) {
        setStatus(result);
        setChecking(false);
      }
    }

    check();
    return () => {
      mounted = false;
    };
  }, [merchantId]);

  if (checking) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Verifying license…</p>
        </div>
      </div>
    );
  }

  if (!status?.valid) {
    return <LicenseExpiredScreen status={status} />;
  }

  return (
    <>
      {status.inGrace && <GracePeriodBanner />}
      {status.daysLeft > 0 && status.daysLeft <= 7 && !status.inGrace && (
        <ExpiringBanner daysLeft={status.daysLeft} />
      )}
      {children}
    </>
  );
}

function LicenseExpiredScreen({
  status,
}: {
  status: ClientLicenseStatus | null;
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
            ? "License Required"
            : reason === "no_public_key"
              ? "Activation Required"
              : "License Expired"}
        </h1>

        <p className="mb-6 text-sm text-gray-600">
          {reason === "no_license" || reason === "no_public_key"
            ? "This store needs to be activated. Please connect to the internet and contact your administrator for a license."
            : "Your subscription has expired. Please connect to the internet and contact your administrator to renew."}
        </p>

        {status?.expiresAt && (
          <p className="mb-4 text-xs text-gray-400">
            Expired on: {new Date(status.expiresAt).toLocaleDateString()}
          </p>
        )}

        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function GracePeriodBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-800">
      <strong>Grace period:</strong> Your license has expired. You have 7 days
      to renew before access is blocked. Contact your administrator.
    </div>
  );
}

function ExpiringBanner({ daysLeft }: { daysLeft: number }) {
  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-center text-sm text-blue-800">
      Your license expires in{" "}
      <strong>
        {daysLeft} day{daysLeft !== 1 ? "s" : ""}
      </strong>
      . Contact your administrator to renew.
    </div>
  );
}
