import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}

export function Badge({
  children,
  variant = "default",
  className,
}: BadgeProps) {
  const variants = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10",
    warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/10",
    danger: "bg-red-50 text-red-700 ring-1 ring-red-600/10",
    info: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
