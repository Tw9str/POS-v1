"use client";

import Link from "next/link";
import { IconChevronLeft } from "@/components/Icons";

export function BackButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/dashboard"
      className={`w-10 h-10 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 active:scale-95 transition-all shrink-0 shadow-sm ${className}`}
    >
      <IconChevronLeft size={20} className="rtl:rotate-180" />
    </Link>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <BackButton className="hidden lg:flex" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-slate-500 text-sm mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}
