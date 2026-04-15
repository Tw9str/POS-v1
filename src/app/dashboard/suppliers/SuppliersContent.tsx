"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalSuppliers } from "@/hooks/useLocalData";
import { SupplierActions } from "./SupplierActions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { offlineFetch } from "@/lib/offline-fetch";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatNumber, type NumberFormat } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

const PAGE_SIZE = 10;

export function SuppliersContent({
  merchantId,
  numberFormat = "western",
  language = "en",
}: {
  merchantId: string;
  numberFormat?: NumberFormat;
  language?: string;
}) {
  const i = t(language as Locale);
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [editSupplier, setEditSupplier] = useState<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes?: string | null;
  } | null>(null);
  const suppliers = useLocalSuppliers(merchantId);

  const filteredSuppliers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return suppliers;

    return suppliers.filter(
      (supplier) =>
        supplier.name.toLowerCase().includes(query) ||
        supplier.phone?.toLowerCase().includes(query) ||
        supplier.email?.toLowerCase().includes(query) ||
        supplier.address?.toLowerCase().includes(query),
    );
  }, [suppliers, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSuppliers.length / PAGE_SIZE),
  );
  const currentPage = Math.min(page, totalPages);
  const pagedSuppliers = filteredSuppliers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const pageIds = pagedSuppliers.map((supplier) => supplier.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function toggleSelectPage() {
    setSelectedIds((prev) =>
      allPageSelected
        ? prev.filter((id) => !pageIds.includes(id))
        : Array.from(new Set([...prev, ...pageIds])),
    );
  }

  async function handleDeleteSupplier(id: string, name: string) {
    setDeletingId(id);
    setFeedback(null);
    const result = await offlineFetch({
      url: "/api/merchant/suppliers",
      method: "DELETE",
      body: { id },
      entity: "supplier",
      merchantId,
    });

    if (!result.ok) {
      setFeedback({
        type: "error",
        text: result.error || i.suppliers.failedToDelete,
      });
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      setFeedback({ type: "success", text: `Deleted "${name}".` });
      router.refresh();
    }
    setDeletingId(null);
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;

    setBulkDeleting(true);
    setFeedback(null);
    const failures: string[] = [];

    for (const id of selectedIds) {
      const result = await offlineFetch({
        url: "/api/merchant/suppliers",
        method: "DELETE",
        body: { id },
        entity: "supplier",
        merchantId,
      });

      if (!result.ok) failures.push(result.error || i.common.deleteFailed);
    }

    if (failures.length > 0) {
      setFeedback({ type: "error", text: failures[0] });
    } else {
      setFeedback({
        type: "success",
        text: `Deleted ${selectedIds.length} suppliers.`,
      });
      setSelectedIds([]);
      router.refresh();
    }

    setBulkDeleting(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={i.suppliers.title}
        subtitle={`${formatNumber(suppliers.length, numberFormat)} ${i.suppliers.suppliers}`}
      >
        <SupplierActions merchantId={merchantId} language={language} />
      </PageHeader>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="w-full md:max-w-sm">
          <Input
            id="supplier-search"
            label={i.common.search}
            placeholder={i.suppliers.searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={editMode ? "primary" : "outline"}
            size="sm"
            onClick={() => {
              setEditMode((prev) => !prev);
              if (editMode) setSelectedIds([]);
            }}
          >
            {editMode ? i.common.done : i.common.edit}
          </Button>
          {editMode && selectedIds.length > 0 && (
            <Button
              variant="danger"
              size="sm"
              disabled={bulkDeleting}
              onClick={() => setConfirmBulkDelete(true)}
            >
              {bulkDeleting
                ? i.common.deleting
                : `${i.common.deleteSelected} (${formatNumber(selectedIds.length, numberFormat)})`}
            </Button>
          )}
        </div>
      </div>

      {feedback && (
        <p
          className={`rounded-xl px-3 py-2 text-sm font-medium ${
            feedback.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {feedback.text}
        </p>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              {editMode && (
                <th className="px-4 py-3.5 text-start">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectPage}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
              )}
              <th className="px-5 py-3.5 text-start font-semibold">
                {i.common.name}
              </th>
              <th className="px-5 py-3.5 text-start font-semibold">
                {i.common.phone}
              </th>
              <th className="px-5 py-3.5 text-start font-semibold">
                {i.common.email}
              </th>
              <th className="px-5 py-3.5 text-start font-semibold">
                {i.common.address}
              </th>
              <th className="px-5 py-3.5 text-start font-semibold">
                {i.common.notes}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredSuppliers.length === 0 ? (
              <tr>
                <td
                  colSpan={editMode ? 7 : 6}
                  className="px-5 py-12 text-center text-slate-400"
                >
                  {suppliers.length === 0
                    ? i.suppliers.noSuppliersYet
                    : i.suppliers.noSuppliersMatch}
                </td>
              </tr>
            ) : (
              pagedSuppliers.map((s) => (
                <tr
                  key={s.id}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  {editMode && (
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(s.id)}
                        onChange={() => toggleSelected(s.id)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                  )}
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      className="text-start cursor-pointer"
                      onClick={() => setEditSupplier(s)}
                    >
                      <span className="font-semibold capitalize text-indigo-600 underline decoration-indigo-300/0 hover:decoration-indigo-300 transition-all">
                        {s.name}
                      </span>
                    </button>
                  </td>
                  <td className="px-5 py-4 text-slate-500">{s.phone || "·"}</td>
                  <td className="px-5 py-4 text-slate-500">{s.email || "·"}</td>
                  <td className="px-5 py-4 text-slate-500">
                    {s.address || "·"}
                  </td>
                  <td className="px-5 py-4 text-slate-400 text-xs max-w-[200px] truncate">
                    {s.notes || "·"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filteredSuppliers.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            {i.common.showing}{" "}
            {formatNumber((currentPage - 1) * PAGE_SIZE + 1, numberFormat)}-
            {formatNumber(
              Math.min(currentPage * PAGE_SIZE, filteredSuppliers.length),
              numberFormat,
            )}{" "}
            {i.common.of} {formatNumber(filteredSuppliers.length, numberFormat)}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              {i.common.previous}
            </Button>
            <span className="text-sm text-slate-500">
              {i.common.page} {formatNumber(currentPage, numberFormat)} /{" "}
              {formatNumber(totalPages, numberFormat)}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              {i.common.next}
            </Button>
          </div>
        </div>
      )}

      {editSupplier && (
        <SupplierActions
          merchantId={merchantId}
          language={language}
          supplier={editSupplier}
          externalOpen
          onExternalClose={() => setEditSupplier(null)}
          onDelete={() => {
            const { id, name } = editSupplier;
            setEditSupplier(null);
            setConfirmDelete({ id, name });
          }}
        />
      )}

      <ConfirmModal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            handleDeleteSupplier(confirmDelete.id, confirmDelete.name);
            setConfirmDelete(null);
          }
        }}
        title={i.suppliers.deleteSupplier}
        message={i.suppliers.deleteSupplierConfirm.replace(
          "{name}",
          confirmDelete?.name ?? "",
        )}
        confirmLabel={i.common.delete}
        loading={Boolean(deletingId)}
      />

      <ConfirmModal
        open={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={() => {
          setConfirmBulkDelete(false);
          handleBulkDelete();
        }}
        title={i.suppliers.deleteSelectedSuppliers}
        message={i.suppliers.deleteSelectedConfirm.replace(
          "{count}",
          formatNumber(selectedIds.length, numberFormat),
        )}
        confirmLabel={i.common.delete}
      />
    </div>
  );
}
