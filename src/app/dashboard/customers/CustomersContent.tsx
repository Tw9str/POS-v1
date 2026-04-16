"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLocalCustomers, useLocalOrders } from "@/hooks/useLocalData";
import { CustomerActions } from "./CustomerActions";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { RowActions } from "@/components/ui/RowActions";
import { FloatingActionBar } from "@/components/ui/FloatingActionBar";
import { offlineFetch } from "@/lib/offline-fetch";
import {
  formatCurrency,
  formatNumber,
  formatDateTime,
  type NumberFormat,
  type DateFormat,
} from "@/lib/utils";
import { t, translatePaymentMethod, type Locale } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { StatCard } from "@/components/ui/Card";
import { SearchInput } from "@/components/ui/SearchInput";
import { db, generateLocalId } from "@/lib/offlineDb";

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
  const fc = (v: number) =>
    formatCurrency(v, currency, numberFormat, currencyFormat, language);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
  const [expandedOrderRef, setExpandedOrderRef] = useState<string | null>(null);
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
      setFeedback({
        type: "success",
        text: i.common.deleted.replace("{name}", name),
      });
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

      if (!result.ok) failures.push(result.error || i.common.deleteFailed);
    }

    if (failures.length > 0) {
      setFeedback({ type: "error", text: failures[0] });
    } else {
      setFeedback({
        type: "success",
        text: i.common.deletedCount.replace(
          "{count}",
          formatNumber(selectedIds.length, numberFormat),
        ),
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
      const actualAmount = Math.min(amount, collectCustomer.balance);

      // Offline-first: update IndexedDB immediately
      const customer = await db.customers.get(collectCustomer.id);
      if (customer) {
        await db.customers.update(collectCustomer.id, {
          balance: Math.max(0, customer.balance - actualAmount),
        });
      }
      // Update payment status of credit orders for this customer
      const creditOrders = await db.orders
        .filter(
          (o) =>
            o.customerId === collectCustomer.id &&
            o.status !== "VOIDED" &&
            (o.paymentStatus === "credit" ||
              o.paymentStatus === "partial_credit") &&
            o.creditAmount > 0,
        )
        .toArray();
      let remaining = actualAmount;
      for (const order of creditOrders) {
        if (remaining <= 0) break;
        const applied = Math.min(remaining, order.creditAmount);
        const newCredit = order.creditAmount - applied;
        await db.orders.update(order.localId, {
          creditAmount: Math.max(0, newCredit),
          paymentStatus: newCredit <= 0 ? "settled" : "partial_credit",
        });
        remaining -= applied;
      }

      setFeedback({ type: "success", text: i.customers.paymentCollected });
      setCollectCustomer(null);
      setCollectAmount("");
      setCollectNote("");
      setCollectMethod("CASH");

      // Try to sync to server in background
      const paymentBody = {
        customerId: collectCustomer.id,
        amount,
        method: collectMethod,
        note: collectNote.trim() || null,
      };
      try {
        const res = await fetch("/api/merchant/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(paymentBody),
        });
        if (!res.ok) {
          await db.mutations.put({
            id: generateLocalId(),
            merchantId,
            url: "/api/merchant/payments",
            method: "POST",
            body: JSON.stringify(paymentBody),
            entity: "customer",
            localEntityId: collectCustomer.id,
            createdAt: Date.now(),
            syncStatus: "pending",
            syncError: null,
            retryCount: 0,
          });
        }
      } catch {
        await db.mutations.put({
          id: generateLocalId(),
          merchantId,
          url: "/api/merchant/payments",
          method: "POST",
          body: JSON.stringify(paymentBody),
          entity: "customer",
          localEntityId: collectCustomer.id,
          createdAt: Date.now(),
          syncStatus: "pending",
          syncError: null,
          retryCount: 0,
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

  const customerStats = useMemo(() => {
    const totalOutstanding = customers.reduce((s, c) => s + c.balance, 0);
    const avgSpend =
      customers.length > 0
        ? customers.reduce((s, c) => s + c.totalSpent, 0) / customers.length
        : 0;
    return { totalOutstanding, avgSpend };
  }, [customers]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={i.customers.title}
        subtitle={`${formatNumber(customers.length, numberFormat)} ${i.customers.customers}`}
      >
        <CustomerActions merchantId={merchantId} language={language} />
      </PageHeader>

      {/* Stat cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <StatCard
          title={i.customers.title}
          value={formatNumber(customers.length, numberFormat)}
          subtitle={`${formatNumber(filteredCustomers.filter((c) => c.balance > 0).length, numberFormat)} ${i.customers.owes}`}
        />
        <StatCard
          title={i.customers.totalOutstanding}
          value={fc(customerStats.totalOutstanding)}
        />
        <StatCard
          title={i.customers.avgSpend}
          value={fc(customerStats.avgSpend)}
        />
      </div>

      <div className="w-full max-w-md">
        <SearchInput
          id="customer-search"
          label={i.common.search}
          placeholder={i.customers.searchPlaceholder}
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          resultCount={filteredCustomers.length}
          totalCount={customers.length}
          numberFormat={numberFormat}
          language={language}
        />
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
              <th className="px-4 py-3.5 text-start w-10">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleSelectPage}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
              <th className="px-5 py-3.5 text-start font-semibold">
                {i.common.name}
              </th>
              <th className="px-5 py-3.5 text-start font-semibold">
                {i.common.phone}
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
              <th className="px-4 py-3.5 text-end font-semibold">
                {i.common.actions}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredCustomers.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
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
                  className="group hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(c.id)}
                      onChange={() => toggleSelected(c.id)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
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
                    {c.email && (
                      <p className="text-xs text-slate-400 mt-0.5">{c.email}</p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-500">{c.phone || "·"}</td>
                  <td className="px-5 py-4 font-bold text-slate-900 tabular-nums">
                    {fc(c.totalSpent)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1.5">
                      <span
                        className={`text-sm font-bold tabular-nums ${c.balance > 0 ? "text-amber-700" : "text-slate-300"}`}
                      >
                        {c.balance > 0 ? fc(c.balance) : "—"}
                      </span>
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
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100 active:bg-amber-200 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <line x1="12" y1="1" x2="12" y2="23" />
                              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                            </svg>
                            {i.customers.collect}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openStatement(c.id, c.name)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-50 text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                          </svg>
                          {i.customers.statement}
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-500 tabular-nums">
                    {formatNumber(c.visitCount, numberFormat)}
                  </td>
                  <td className="px-4 py-4">
                    <RowActions
                      actions={[
                        {
                          icon: "edit",
                          label: i.common.edit,
                          onClick: () => setEditCustomer(c),
                        },
                        {
                          icon: "delete",
                          label: i.common.delete,
                          variant: "danger",
                          onClick: () =>
                            setConfirmDelete({ id: c.id, name: c.name }),
                        },
                      ]}
                    />
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

      <FloatingActionBar
        selectedCount={selectedIds.length}
        onDelete={() => setConfirmBulkDelete(true)}
        onCancel={() => setSelectedIds([])}
        deleting={bulkDeleting}
        numberFormat={numberFormat}
        language={language}
      />

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
                  language,
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
                      language,
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
          <div className="space-y-0">
            {/* Summary bar */}
            {(() => {
              const totalDebit = ledgerEntries.reduce((s, e) => s + e.debit, 0);
              const totalCredit = ledgerEntries.reduce(
                (s, e) => s + e.credit,
                0,
              );
              const balance = totalDebit - totalCredit;
              return (
                <div className="flex items-center gap-4 rounded-xl bg-slate-50 px-4 py-3 mb-4 text-sm">
                  <div className="flex-1">
                    <span className="text-slate-500">
                      {i.customers.debit}:{" "}
                    </span>
                    <span className="font-semibold text-amber-700">
                      {formatCurrency(
                        totalDebit,
                        currency,
                        numberFormat,
                        currencyFormat,
                        language,
                      )}
                    </span>
                  </div>
                  <div className="flex-1">
                    <span className="text-slate-500">
                      {i.customers.credit}:{" "}
                    </span>
                    <span className="font-semibold text-emerald-700">
                      {formatCurrency(
                        totalCredit,
                        currency,
                        numberFormat,
                        currencyFormat,
                        language,
                      )}
                    </span>
                  </div>
                  <div className="flex-1 text-end">
                    <span className="text-slate-500">
                      {i.customers.runningBalance}:{" "}
                    </span>
                    <span
                      className={`font-bold ${balance > 0 ? "text-amber-700" : balance < 0 ? "text-emerald-700" : "text-slate-400"}`}
                    >
                      {formatCurrency(
                        Math.abs(balance),
                        currency,
                        numberFormat,
                        currencyFormat,
                        language,
                      )}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Entries */}
            <div className="max-h-[24rem] overflow-y-auto space-y-2">
              {(() => {
                let running = 0;
                return ledgerEntries.map((entry) => {
                  running += entry.debit - entry.credit;
                  const isOrder = entry.type === "order";
                  return (
                    <div
                      key={entry.id}
                      className={`rounded-xl border px-4 py-3 ${isOrder ? "border-amber-100 bg-amber-50/30" : "border-emerald-100 bg-emerald-50/30"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold flex-shrink-0 ${isOrder ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}
                          >
                            {isOrder ? "−" : "+"}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-xs font-semibold ${isOrder ? "text-amber-700" : "text-emerald-700"}`}
                              >
                                {isOrder
                                  ? i.customers.creditOrder
                                  : i.customers.paymentReceived}
                              </span>
                              {entry.ref && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedOrderRef(
                                      expandedOrderRef === entry.ref
                                        ? null
                                        : entry.ref,
                                    )
                                  }
                                  className={`text-xs font-mono cursor-pointer ${expandedOrderRef === entry.ref ? "text-indigo-800 underline" : "text-indigo-600 hover:text-indigo-800 hover:underline"}`}
                                >
                                  {entry.ref}
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                              <span>
                                {formatDateTime(
                                  entry.date,
                                  dateFormat,
                                  numberFormat,
                                )}
                              </span>
                              {entry.method && (
                                <>
                                  <span>·</span>
                                  <span>
                                    {translatePaymentMethod(
                                      entry.method,
                                      language as Locale,
                                    )}
                                  </span>
                                </>
                              )}
                              {entry.note && (
                                <>
                                  <span>·</span>
                                  <span className="truncate max-w-[150px]">
                                    {entry.note}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-end flex-shrink-0">
                          <div
                            className={`text-sm font-bold tabular-nums ${isOrder ? "text-amber-700" : "text-emerald-700"}`}
                          >
                            {isOrder ? "" : "−"}
                            {formatCurrency(
                              isOrder ? entry.debit : entry.credit,
                              currency,
                              numberFormat,
                              currencyFormat,
                              language,
                            )}
                          </div>
                          <div
                            className={`text-[11px] tabular-nums ${running > 0 ? "text-amber-600" : running < 0 ? "text-emerald-600" : "text-slate-400"}`}
                          >
                            {i.customers.runningBalance}:{" "}
                            {formatCurrency(
                              Math.abs(running),
                              currency,
                              numberFormat,
                              currencyFormat,
                              language,
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded order details */}
                      {isOrder &&
                        expandedOrderRef === entry.ref &&
                        (() => {
                          const order = allOrders.find(
                            (o) => o.orderNumber === entry.ref,
                          );
                          if (!order) return null;
                          return (
                            <div className="mt-3 border-t border-amber-100 pt-3 text-xs text-slate-600 space-y-1.5">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between">
                                  <span>
                                    {item.quantity}× {item.name}
                                  </span>
                                  <span className="tabular-nums text-slate-500">
                                    {formatCurrency(
                                      item.price * item.quantity -
                                        item.discount,
                                      currency,
                                      numberFormat,
                                      currencyFormat,
                                      language,
                                    )}
                                  </span>
                                </div>
                              ))}
                              <div className="border-t border-amber-100 pt-1.5 flex justify-between font-semibold text-slate-700">
                                <span>{i.orders.total}</span>
                                <span className="tabular-nums">
                                  {formatCurrency(
                                    order.total,
                                    currency,
                                    numberFormat,
                                    currencyFormat,
                                    language,
                                  )}
                                </span>
                              </div>
                              {order.paidAmount > 0 && (
                                <div className="flex justify-between text-emerald-600">
                                  <span>{i.orders.paid}</span>
                                  <span className="tabular-nums">
                                    {formatCurrency(
                                      order.paidAmount,
                                      currency,
                                      numberFormat,
                                      currencyFormat,
                                      language,
                                    )}
                                  </span>
                                </div>
                              )}
                              {order.staffName && (
                                <div className="text-slate-400 pt-0.5">
                                  {i.orders.cashierCol}: {order.staffName}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Collect payment shortcut from statement */}
            {(() => {
              const totalDebit = ledgerEntries.reduce((s, e) => s + e.debit, 0);
              const totalCredit = ledgerEntries.reduce(
                (s, e) => s + e.credit,
                0,
              );
              const remaining = totalDebit - totalCredit;
              if (remaining <= 0 || !historyCustomer) return null;
              return (
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    {i.customers.balance}:{" "}
                    <span className="font-bold text-amber-700 tabular-nums">
                      {fc(remaining)}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    onClick={() => {
                      setCollectCustomer({
                        id: historyCustomer.id,
                        name: historyCustomer.name,
                        balance: remaining,
                      });
                      setHistoryCustomer(null);
                      setLedgerEntries([]);
                    }}
                  >
                    {i.customers.collectPayment}
                  </Button>
                </div>
              );
            })()}
          </div>
        )}
      </Modal>
    </div>
  );
}
