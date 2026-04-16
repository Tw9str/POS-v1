import { Badge } from "@/components/ui/Badge";

export function StatusToggle({
  isActive,
  activeLabel,
  inactiveLabel,
  badgeContent,
  badgeVariant,
  onToggle,
  title,
}: {
  isActive: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
  badgeContent?: React.ReactNode;
  badgeVariant?: "default" | "success" | "warning" | "danger" | "info";
  onToggle: () => void;
  title?: string;
}) {
  const label = badgeContent ?? (isActive ? activeLabel : inactiveLabel);
  const variant = badgeVariant ?? (isActive ? "success" : "default");

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={isActive}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        title={title}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${isActive ? "bg-emerald-500" : "bg-slate-200"}`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform ${isActive ? "ltr:translate-x-4 rtl:-translate-x-4" : "translate-x-0"}`}
        />
      </button>
      {label && <Badge variant={variant}>{label}</Badge>}
    </div>
  );
}
