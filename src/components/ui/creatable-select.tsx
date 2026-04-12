"use client";

import { useState, useRef, useEffect } from "react";
import { IconPlus } from "@/components/icons";

interface CreatableSelectProps {
  label?: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export function CreatableSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Select...",
}: CreatableSelectProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newValue, setNewValue] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (creating && inputRef.current) inputRef.current.focus();
  }, [creating]);

  function handleCreate() {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setNewValue("");
    setCreating(false);
    setOpen(false);
  }

  return (
    <div className="w-full relative" ref={ref}>
      {label && (
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm text-left
          focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
          transition-colors duration-200 bg-white flex items-center"
      >
        <span className={value ? "text-slate-900" : "text-slate-400"}>
          {value || placeholder}
        </span>
        <svg
          className={`ml-auto w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-48 overflow-auto">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
                setCreating(false);
              }}
              className={`w-full px-4 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors
                ${opt === value ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-700"}`}
            >
              <span className="truncate">{opt}</span>
              {opt === value && (
                <svg
                  className="inline ml-2 w-4 h-4 text-indigo-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}

          <div className="border-t border-slate-100">
            {!creating ? (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-indigo-600 font-medium hover:bg-indigo-50 transition-colors"
              >
                <IconPlus size={16} />
                Custom {label?.toLowerCase() || "option"}
              </button>
            ) : (
              <div className="p-3 space-y-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreate();
                    }
                    if (e.key === "Escape") {
                      setCreating(false);
                    }
                  }}
                  placeholder={`Custom ${label?.toLowerCase() || "option"}`}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setNewValue("");
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={!newValue.trim()}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    Use
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
