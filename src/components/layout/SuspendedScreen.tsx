"use client";

import { signOutMerchant } from "@/lib/staffActions";
import { t, type Locale } from "@/lib/i18n";

interface SuspendedScreenProps {
  language: Locale;
}

export function SuspendedScreen({ language }: SuspendedScreenProps) {
  const i = t(language);

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
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
        </div>

        <h1 className="mb-2 text-xl font-bold text-gray-900">
          {i.storeSuspended.title}
        </h1>

        <p className="mb-6 text-sm text-gray-600">{i.storeSuspended.message}</p>

        <button
          onClick={() => signOutMerchant()}
          className="w-full rounded-lg bg-slate-100 px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
        >
          {i.storeSuspended.signOut}
        </button>
      </div>
    </div>
  );
}
