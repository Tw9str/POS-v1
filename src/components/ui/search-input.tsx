"use client";

import { Input } from "@/components/ui/input";
import { IconCamera, IconX } from "@/components/icons";
import { formatNumber, type NumberFormat } from "@/lib/utils";

interface SearchInputProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
  numberFormat?: NumberFormat;
  onScan?: () => void;
  className?: string;
}

export function SearchInput({
  id,
  label,
  placeholder,
  value,
  onChange,
  resultCount,
  totalCount,
  numberFormat = "western",
  onScan,
  className,
}: SearchInputProps) {
  const isFiltered = value.trim().length > 0 || resultCount !== totalCount;

  return (
    <div className={className}>
      <div className="relative">
        <Input
          id={id}
          label={label}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={onScan ? "pr-20" : value ? "pr-11" : undefined}
        />
        <div className="absolute right-2 bottom-1.5 flex items-center gap-0.5">
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              title="Clear search"
            >
              <IconX size={16} />
            </button>
          )}
          {onScan && (
            <button
              type="button"
              onClick={onScan}
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
              title="Scan barcode"
            >
              <IconCamera size={20} />
            </button>
          )}
        </div>
      </div>
      {isFiltered && (
        <p className="mt-1.5 text-xs font-medium text-slate-500 tabular-nums">
          {formatNumber(resultCount, numberFormat)} of{" "}
          {formatNumber(totalCount, numberFormat)} results
        </p>
      )}
    </div>
  );
}
