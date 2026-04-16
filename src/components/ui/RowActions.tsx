import { cn } from "@/lib/utils";
import { IconEdit, IconTrash, IconEye } from "@/components/Icons";

export interface RowAction {
  icon: "edit" | "delete" | "view" | React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger" | "warning";
  disabled?: boolean;
  hidden?: boolean;
}

const iconMap = {
  edit: IconEdit,
  delete: IconTrash,
  view: IconEye,
};

const variantStyles = {
  default:
    "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100",
  danger: "text-slate-400 hover:text-red-600 hover:bg-red-50 active:bg-red-100",
  warning:
    "text-amber-500 hover:text-amber-700 hover:bg-amber-50 active:bg-amber-100",
};

export function RowActions({
  actions,
  className,
}: {
  actions: RowAction[];
  className?: string;
}) {
  const visible = actions.filter((a) => !a.hidden);
  if (visible.length === 0) return null;

  return (
    <div className={cn("flex items-center justify-end gap-1", className)}>
      {visible.map((action, idx) => {
        const variant = action.variant ?? "default";
        const iconContent =
          typeof action.icon === "string" && action.icon in iconMap
            ? (() => {
                const Icon = iconMap[action.icon as keyof typeof iconMap];
                return <Icon size={16} />;
              })()
            : action.icon;

        return (
          <button
            key={idx}
            type="button"
            title={action.label}
            aria-label={action.label}
            disabled={action.disabled}
            onClick={(e) => {
              e.stopPropagation();
              action.onClick();
            }}
            className={cn(
              "inline-flex items-center justify-center min-w-[36px] min-h-[36px] p-2 rounded-xl transition-colors cursor-pointer",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              variantStyles[variant],
            )}
          >
            {iconContent}
          </button>
        );
      })}
    </div>
  );
}
