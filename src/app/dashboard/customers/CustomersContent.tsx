"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLocalCustomers, useLocalOrders } from "@/hooks/useLocalData";
import { CustomerActions } from "./CustomerActions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { offlineFetch } from "@/lib/offline-fetch";
import {
  formatCurrency,
  formatNumber,
  formatDateTime,
  getPaymentMethodLabel,
  type NumberFormat,
  type DateFormat,
} from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { db } from "@/lib/offlineDb";

const PAGE_SIZE = 10;

export function CustomersContent({
  merchantId,
  currency,
  currencyFormat = "symbol",
  numberFormat = "western",
  dateFormat = "long",
  language = "en",
}: {
  merchantId: string;
  currency: string;
  currencyFormat: "symbol" | "code" | "none";
  numberFormat?: NumberFormat;
  dateFormat?: DateFormat;
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
  const [collectCustomer, setCollectCustomer] = useState<{
    id: string;
    name: string;
    balance: number;
  } | null>(null);
  const [collectAmount, setCollectAmount] = useState("");
  const [collectMethod, setCollectMethod] = useState<
    "CASH" | "MOBILE_MONEY" | "CARD"
  >("CASH");
  const [collectNote, setCollectNote] = useState("");
  const [collectLoading, setCollectLoading] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<{
    id: string;
    name: string;
  } | null>(null);
  type LedgerEntry = {
    id: string;
    date: Date;
    type: "order" | "payment";
    ref: string;
    debit: number;
    credit: number;
    method?: string;
    note?: string | null;
  };
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [editCustomer, setEditCustomer] = useState<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes?: string | null;
  } | null>(null);
  const customers = useLocalCustomers(merchantId);
  const allOrders = useLocalOrders(merchantId, 500);

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
        text: result.error || i.customers.failedToDelete,
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

  async function handleCollectPayment() {
    if (!collectCustomer) return;
    const amount = parseFloat(collectAmount);
    if (!amount || amount <= 0) return;

    setCollectLoading(true);
    try {
      const res = await fetch("/api/merchant/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: collectCustomer.id,
          amount,
          method: collectMethod,
          note: collectNote.trim() || null,
        }),
      });

      if (res.ok) {
        const actualAmount = Math.min(amount, collectCustomer.balance);
        // Update IndexedDB immediately
        const customer = await db.customers.get(collectCustomer.id);
        if (customer) {
          await db.customers.update(collectCustomer.id, {
            balance: Math.max(0, customer.balance - actualAmount),
          });
        }
        setFeedback({ type: "success", text: i.customers.paymentCollected });
        setCollectCustomer(null);
        setCollectAmount("");
        setCollectNote("");
        setCollectMethod("CASH");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({ error: "Unknown" }));
        setFeedback({
          type: "error",
          text: data.error || i.customers.failedToCollect,
        });
      }
    } catch {
      setFeedback({ type: "error", text: i.customers.failedToCollect });
    } finally {
      setCollectLoading(false);
    }
  }

  const openStatement = useCallback(
    async (customerId: string, customerName: string) => {
      setHistoryCustomer({ id: customerId, name: customerName });
      setPaymentsLoading(true);
      try {
        // 1. Credit orders from IndexedDB
        const creditOrders = allOrders.filter(
          (o) =>
            o.customerId === customerId &&
            o.status !== "VOIDED" &&
            (o.paymentStatus === "credit" ||
              o.paymentStatus === "partial_credit" ||
              o.paymentStatus === "settled"),
        );

        // Payments from API
        const res = await fetch(
          `/api/merchant/payments?customerId=${encodeURIComponent(customerId)}`,
        );
        let paymentEntries: LedgerEntry[] = [];
        if (res.ok) {
          const apiPayments: Array<{
            id: string;
            amount: number;
            method: string;
            note: string | null;
            createdAt: string;
            order?: { orderNumber: string } | null;
          }> = await res.json();
          paymentEntries = apiPayments.map((p) => ({
            id: `payment-${p.id}`,
            date: new Date(p.createdAt),
            type: "payment" as const,
            ref: p.order?.orderNumber ?? "",
            debit: 0,
            credit: p.amount,
            method: p.method,
            note: p.note,
          }));
        }

        // For orders that are settled, the original debit = creditAmount + sum of payments against that order
        const paymentsByOrder = new Map<string, number>();
        for (const pe of paymentEntries) {
          if (pe.ref) {
            paymentsByOrder.set(
              pe.ref,
              (paymentsByOrder.get(pe.ref) || 0) + pe.credit,
            );
          }
        }

        // Fix order debit amounts: remaining credit + payments already received = original debt
        const fixedOrderEntries = creditOrders.map((o) => ({
          id: `order-${o.localId}`,
          date: new Date(o.createdAt),
          type: "order" as const,
          ref: o.orderNumber,
          debit: o.creditAmount + (paymentsByOrder.get(o.orderNumber) || 0),
          credit: 0,
          note: null,
        }));

        // Combine and sort chronologically
        const combined = [...fixedOrderEntries, ...paymentEntries].sort(
          (a, b) => a.date.getTime() - b.date.getTime(),
        );

        setLedgerEntries(combined);
      } catch {
        setLedgerEntries([]);
      } finally {
        setPaymentsLoading(false);
      }
    },
    [allOrders],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={i.customers.title}
        subtitle={`${formatNumber(customers.length, numberFormat)} ${i.customers.customers}`}
      >
        <CustomerActions merchantId={merchantId} language={language} />
      </PageHeader>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="w-full md:max-w-sm">
          <Input
            id="customer-search"
            label={i.common.search}
            placeholder={i.customers.searchPlaceholder}
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
                {i.customers.totalSpent}
              </th>
              <th className="px-5 py-3.5 text-start font-semibold">
                {i.customers.balance}
              </th>
              <th className="px-5 py-3.5 text-start font-semibold">
                {i.customers.visits}
              </th>
              <th className="px-5 py-3.5 text-start font-semibold">
                {i.common.notes}
              </th>
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
                    ? i.customers.noCustomersYet
                    : i.customers.noCustomersMatch}
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
                      className="text-start cursor-pointer"
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
                    {formatCurrency(
                      c.totalSpent,
                      currency,
                      numberFormat,
                      currencyFormat,
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      {c.balance > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setCollectCustomer({
                              id: c.id,
                              name: c.name,
                              balance: c.balance,
                            })
                          }
                          className="text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-colors tabular-nums cursor-pointer"
                        >
                          {i.customers.owes}{" "}
                          {formatCurrency(
                            c.balance,
                            currency,
                            numberFormat,
                            currencyFormat,
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openStatement(c.id, c.name)}
                        className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      >
                        {i.customers.statement}
                      </button>
                    </div>
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
            {i.common.showing}{" "}
            {formatNumber((currentPage - 1) * PAGE_SIZE + 1, numberFormat)}-
            {formatNumber(
              Math.min(currentPage * PAGE_SIZE, filteredCustomers.length),
              numberFormat,
            )}{" "}
            {i.common.of} {formatNumber(filteredCustomers.length, numberFormat)}
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

      {editCustomer && (
        <CustomerActions
          merchantId={merchantId}
          language={language}
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
        title={i.customers.deleteCustomer}
        message={i.customers.deleteCustomerConfirm.replace(
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
        title={i.customers.deleteSelectedCustomers}
        message={i.customers.deleteSelectedConfirm.replace(
          "{count}",
          formatNumber(selectedIds.length, numberFormat),
        )}
        confirmLabel={i.common.delete}
      />

      {/* Collect Payment Modal */}
      <Modal
        open={Boolean(collectCustomer)}
        onClose={() => {
          setCollectCustomer(null);
          setCollectAmount("");
          setCollectNote("");
          setCollectMethod("CASH");
        }}
        title={i.customers.collectPaymentFrom.replace(
          "{name}",
          collectCustomer?.name ?? "",
        )}
        size="sm"
      >
        {collectCustomer && (
          <div className="space-y-4">
            <div className="bg-amber-50 rounded-xl p-4 text-center">
              <p className="text-xs text-amber-600 mb-1">
                {i.customers.outstandingBalance}
              </p>
              <p className="text-2xl font-bold text-amber-800 tabular-nums">
                {formatCurrency(
                  collectCustomer.balance,
                  currency,
                  numberFormat,
                  currencyFormat,
                )}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                {i.customers.paymentAmount}
              </label>
              <input
                type="number"
                value={collectAmount}
                onChange={(e) => setCollectAmount(e.target.value)}
                placeholder={collectCustomer.balance.toString()}
                min="0"
                max={collectCustomer.balance}
                step="any"
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-lg font-bold text-slate-900 tabular-nums focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
              {/* Quick amount buttons */}
              <div className="flex gap-2 mt-2">
                {[
                  collectCustomer.balance,
                  ...(collectCustomer.balance > 1000
                    ? [Math.ceil(collectCustomer.balance / 2)]
                    : []),
                ].map((amount, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCollectAmount(amount.toString())}
                    className="flex-1 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold text-slate-600 hover:bg-slate-200 active:scale-95 transition-all tabular-nums cursor-pointer"
                  >
                    {formatCurrency(
                      amount,
                      currency,
                      numberFormat,
                      currencyFormat,
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                {i.customers.paymentMethod}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: "CASH" as const, label: i.pos.cash },
                    { value: "MOBILE_MONEY" as const, label: i.pos.shamcash },
                    { value: "CARD" as const, label: i.pos.card },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setCollectMethod(m.value)}
                    className={`py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ring-2 ring-inset ${
                      collectMethod === m.value
                        ? "ring-indigo-500 bg-indigo-50 text-indigo-700"
                        : "ring-transparent bg-slate-50 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                {i.customers.paymentNote}
              </label>
              <input
                type="text"
                value={collectNote}
                onChange={(e) => setCollectNote(e.target.value)}
                className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setCollectCustomer(null);
                  setCollectAmount("");
                  setCollectNote("");
                  setCollectMethod("CASH");
                }}
              >
                {i.common.cancel}
              </Button>
              <Button
                className="flex-1"
                loading={collectLoading}
                onClick={handleCollectPayment}
                disabled={
                  !collectAmount ||
                  parseFloat(collectAmount) <= 0 ||
                  parseFloat(collectAmount) > collectCustomer.balance
                }
              >
                {i.customers.collectPayment}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Customer Statement / Ledger Modal */}
      <Modal
        open={Boolean(historyCustomer)}
        onClose={() => {
          setHistoryCustomer(null);
          setLedgerEntries([]);
        }}
        title={i.customers.statementFor.replace(
          "{name}",
          historyCustomer?.name ?? "",
        )}
        size="lg"
      >
        {paymentsLoading ? (
          <div className="py-10 text-center text-slate-400 text-sm">...</div>
        ) : ledgerEntries.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">
            {i.customers.noActivity}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="px-4 py-2.5 text-start font-semibold">
                    {i.customers.paymentDate}
                  </th>
                  <th className="px-4 py-2.5 text-start font-semibold" />
                  <th className="px-4 py-2.5 text-start font-semibold">#</th>
                  <th className="px-4 py-2.5 text-end font-semibold">
                    {i.customers.debit}
                  </th>
                  <th className="px-4 py-2.5 text-end font-semibold">
                    {i.customers.credit}
                  </th>
                  <th className="px-4 py-2.5 text-end font-semibold">
                    {i.customers.runningBalance}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(() => {
                  let running = 0;
                  return ledgerEntries.map((entry) => {
                    running += entry.debit - entry.credit;
                    return (
                      <tr
                        key={entry.id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap text-xs">
                          {formatDateTime(entry.date, dateFormat, numberFormat)}
                        </td>
                        <td className="px-4 py-2.5">
                          {entry.type === "order" ? (
                            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                              {i.customers.creditOrder}
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              {i.customers.paymentReceived}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">
                          {entry.ref}
                          {entry.method && (
                            <span className="text-slate-400">
                              {" "}
                              · {getPaymentMethodLabel(entry.method)}
                            </span>
                          )}
                          {entry.note && (
                            <span className="text-slate-400">
                              {" "}
                              · {entry.note}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-end tabular-nums font-medium">
                          {entry.debit > 0 ? (
                            <span className="text-amber-700">
                              {formatCurrency(
                                entry.debit,
                                currency,
                                numberFormat,
                                currencyFormat,
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-end tabular-nums font-medium">
                          {entry.credit > 0 ? (
                            <span className="text-emerald-700">
                              {formatCurrency(
                                entry.credit,
                                currency,
                                numberFormat,
                                currencyFormat,
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-end tabular-nums font-bold">
                          <span
                            className={
                              running > 0
                                ? "text-amber-700"
                                : running < 0
                                  ? "text-emerald-700"
                                  : "text-slate-400"
                            }
                          >
                            {formatCurrency(
                              Math.abs(running),
                              currency,
                              numberFormat,
                              currencyFormat,
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
