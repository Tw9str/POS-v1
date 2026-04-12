"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalCustomers } from "@/hooks/use-local-data";
import { CustomerActions } from "./customer-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { offlineFetch } from "@/lib/offline-fetch";
import { formatCurrency, formatNumber, type NumberFormat } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { ConfirmModal } from "@/components/ui/confirm-modal";

const PAGE_SIZE = 10;

export function CustomersContent({
  merchantId,
  currency,
  numberFormat = "western",
}: {
  merchantId: string;
  currency: string;
  numberFormat?: NumberFormat;
}) {
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
  const [editCustomer, setEditCustomer] = useState<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes?: string | null;
  } | null>(null);
  const customers = useLocalCustomers(merchantId);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;

    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.phone?.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.address?.toLowerCase().includes(query),
    );
  }, [customers, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCustomers.length / PAGE_SIZE),
  );
  const currentPage = Math.min(page, totalPages);
  const pagedCustomers = filteredCustomers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const pageIds = pagedCustomers.map((c) => c.id);
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

  async function handleDeleteCustomer(id: string, name: string) {
    setDeletingId(id);
    setFeedback(null);
    const result = await offlineFetch({
      url: "/api/merchant/customers",
      method: "DELETE",
      body: { id },
      entity: "customer",
      merchantId,
    });

    if (!result.ok) {
      setFeedback({
        type: "error",
        text: result.error || "Failed to delete customer",
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
        url: "/api/merchant/customers",
        method: "DELETE",
        body: { id },
        entity: "customer",
        merchantId,
      });

      if (!result.ok) failures.push(result.error || "Delete failed");
    }

    if (failures.length > 0) {
      setFeedback({ type: "error", text: failures[0] });
    } else {
      setFeedback({
        type: "success",
        text: `Deleted ${selectedIds.length} customers.`,
      });
      setSelectedIds([]);
      router.refresh();
    }

    setBulkDeleting(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle={`${formatNumber(customers.length, numberFormat)} customers`}
      >
        <CustomerActions merchantId={merchantId} />
      </PageHeader>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="w-full md:max-w-sm">
          <Input
            id="customer-search"
            label="Search customers"
            placeholder="Name, phone, email, address..."
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
            {editMode ? "Done" : "Edit"}
          </Button>
          {editMode && selectedIds.length > 0 && (
            <Button
              variant="danger"
              size="sm"
              disabled={bulkDeleting}
              onClick={() => setConfirmBulkDelete(true)}
            >
              {bulkDeleting
                ? "Deleting..."
                : `Delete Selected (${formatNumber(selectedIds.length, numberFormat)})`}
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
                <th className="px-4 py-3.5 text-left">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectPage}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
              )}
              <th className="px-5 py-3.5 text-left font-semibold">Name</th>
              <th className="px-5 py-3.5 text-left font-semibold">Phone</th>
              <th className="px-5 py-3.5 text-left font-semibold">Email</th>
              <th className="px-5 py-3.5 text-left font-semibold">
                Total Spent
              </th>
              <th className="px-5 py-3.5 text-left font-semibold">Visits</th>
              <th className="px-5 py-3.5 text-left font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredCustomers.length === 0 ? (
              <tr>
                <td
                  colSpan={editMode ? 8 : 7}
                  className="px-5 py-12 text-center text-slate-400"
                >
                  {customers.length === 0
                    ? "No customers yet"
                    : "No customers match your search"}
                </td>
              </tr>
            ) : (
              pagedCustomers.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  {editMode && (
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.id)}
                        onChange={() => toggleSelected(c.id)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                  )}
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      className="text-left cursor-pointer"
                      onClick={() => setEditCustomer(c)}
                    >
                      <span className="font-semibold capitalize text-indigo-600 underline decoration-indigo-300/0 hover:decoration-indigo-300 transition-all">
                        {c.name}
                      </span>
                    </button>
                  </td>
                  <td className="px-5 py-4 text-slate-500">{c.phone || "·"}</td>
                  <td className="px-5 py-4 text-slate-500">{c.email || "·"}</td>
                  <td className="px-5 py-4 font-bold text-slate-900 tabular-nums">
                    {formatCurrency(c.totalSpent, currency, numberFormat)}
                  </td>
                  <td className="px-5 py-4 text-slate-500 tabular-nums">
                    {formatNumber(c.visitCount, numberFormat)}
                  </td>
                  <td className="px-5 py-4 text-slate-400 text-xs max-w-[200px] truncate">
                    {c.notes || "·"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filteredCustomers.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Showing{" "}
            {formatNumber((currentPage - 1) * PAGE_SIZE + 1, numberFormat)}-
            {formatNumber(
              Math.min(currentPage * PAGE_SIZE, filteredCustomers.length),
              numberFormat,
            )}{" "}
            of {formatNumber(filteredCustomers.length, numberFormat)}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-slate-500">
              Page {formatNumber(currentPage, numberFormat)} /{" "}
              {formatNumber(totalPages, numberFormat)}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {editCustomer && (
        <CustomerActions
          merchantId={merchantId}
          customer={editCustomer}
          externalOpen
          onExternalClose={() => setEditCustomer(null)}
          onDelete={() => {
            const { id, name } = editCustomer;
            setEditCustomer(null);
            setConfirmDelete({ id, name });
          }}
        />
      )}

      <ConfirmModal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            handleDeleteCustomer(confirmDelete.id, confirmDelete.name);
            setConfirmDelete(null);
          }
        }}
        title="Delete customer"
        message={`Are you sure you want to delete "${confirmDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={Boolean(deletingId)}
      />

      <ConfirmModal
        open={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={() => {
          setConfirmBulkDelete(false);
          handleBulkDelete();
        }}
        title="Delete selected customers"
        message={`Are you sure you want to delete ${formatNumber(selectedIds.length, numberFormat)} selected customers? This action cannot be undone.`}
        confirmLabel="Delete all"
      />
    </div>
  );
}
