import { Button } from "@/components/ui/Button";
import { formatNumber, type NumberFormat } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";

export function FloatingActionBar({
  selectedCount,
  onDelete,
  onCancel,
  deleting,
  numberFormat = "western",
  language = "en",
}: {
  selectedCount: number;
  onDelete: () => void;
  onCancel: () => void;
  deleting?: boolean;
  numberFormat?: NumberFormat;
  language?: string;
}) {
  const i = t(language as Locale);
  if (selectedCount === 0) return null;

  return (
    <div className="sticky bottom-4 z-20 mx-auto w-fit">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-lg">
        <span className="text-sm font-medium text-slate-700">
          {formatNumber(selectedCount, numberFormat)} {i.common.selected}
        </span>
        <div className="w-px h-5 bg-slate-200" />
        <Button
          variant="danger"
          size="sm"
          disabled={deleting}
          onClick={onDelete}
        >
          {deleting ? i.common.deleting : i.common.deleteSelected}
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          {i.common.cancel}
        </Button>
      </div>
    </div>
  );
}
