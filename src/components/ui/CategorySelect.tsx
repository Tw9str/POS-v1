"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { IconPlus } from "@/components/Icons";
import { useOutsideClick } from "@/hooks/useOutsideClick";

interface Category {
  id: string;
  name: string;
  color?: string | null;
}

interface CategorySelectProps {
  label?: string;
  value: string;
  categories: Category[];
  onChange: (categoryId: string) => void;
  onCreateCategory: (name: string, color: string) => Promise<string | null>;
  translateName?: (name: string) => string;
}

export function CategorySelect({
  label,
  value,
  categories,
  onChange,
  onCreateCategory,
  translateName = (n) => n,
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#4f46e5");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const selected = categories.find((c) => c.id === value);

  const handleOutside = useCallback(() => {
    setOpen(false);
    setCreating(false);
    setError("");
  }, []);
  useOutsideClick(ref, handleOutside, open);

  useEffect(() => {
    if (creating && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [creating]);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    try {
      const newId = await onCreateCategory(trimmed, newColor);
      if (newId) {
        onChange(newId);
        setNewName("");
        setNewColor("#4f46e5");
        setCreating(false);
        setOpen(false);
      } else {
        setError("Failed to create");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
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
          transition-colors duration-200 bg-white flex items-center gap-2.5"
      >
        {selected ? (
          <>
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: selected.color || "#4f46e5" }}
            />
            <span className="text-slate-900 truncate">
              {translateName(selected.name)}
            </span>
          </>
        ) : (
          <span className="text-slate-400">Select category</span>
        )}
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
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-60 overflow-auto">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                onChange(cat.id);
                setOpen(false);
                setCreating(false);
              }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors
                ${cat.id === value ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-700"}`}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: cat.color || "#4f46e5" }}
              />
              <span className="truncate">{translateName(cat.name)}</span>
              {cat.id === value && (
                <svg
                  className="ml-auto w-4 h-4 text-indigo-600 shrink-0"
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
                New category
              </button>
            ) : (
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreate();
                      }
                      if (e.key === "Escape") {
                        setCreating(false);
                        setError("");
                      }
                    }}
                    placeholder="Category name"
                    className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="h-9 w-9 rounded-lg border border-slate-200 cursor-pointer shrink-0 p-0.5"
                  />
                </div>
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setNewName("");
                      setError("");
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={loading || !newName.trim()}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {loading ? "Adding..." : "Add"}
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
