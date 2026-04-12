"use client";

export type SortDirection = "asc" | "desc" | null;

interface SortableThProps {
  label: string;
  sortKey: string;
  currentSort: string | null;
  currentDirection: SortDirection;
  onSort: (key: string) => void;
  className?: string;
}

export function SortableTh({
  label,
  sortKey,
  currentSort,
  currentDirection,
  onSort,
  className = "",
}: SortableThProps) {
  const isActive = currentSort === sortKey;

  return (
    <th
      className={`px-5 py-3.5 text-left font-semibold select-none ${className}`}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 cursor-pointer hover:text-indigo-600 transition-colors group"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <span className="inline-flex flex-col leading-0 -space-y-px">
          <svg
            width="8"
            height="5"
            viewBox="0 0 8 5"
            className={
              isActive && currentDirection === "asc"
                ? "text-indigo-600"
                : "text-slate-300 group-hover:text-slate-400"
            }
          >
            <path d="M4 0L8 5H0L4 0Z" fill="currentColor" />
          </svg>
          <svg
            width="8"
            height="5"
            viewBox="0 0 8 5"
            className={
              isActive && currentDirection === "desc"
                ? "text-indigo-600"
                : "text-slate-300 group-hover:text-slate-400"
            }
          >
            <path d="M4 5L0 0H8L4 5Z" fill="currentColor" />
          </svg>
        </span>
      </button>
    </th>
  );
}

export function useSortToggle() {
  function toggle(
    key: string,
    currentSort: string | null,
    currentDirection: SortDirection,
  ): { sort: string | null; direction: SortDirection } {
    if (currentSort !== key) return { sort: key, direction: "asc" };
    if (currentDirection === "asc") return { sort: key, direction: "desc" };
    return { sort: null, direction: null };
  }

  return toggle;
}
