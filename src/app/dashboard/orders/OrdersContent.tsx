"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalOrders } from "@/hooks/useLocalData";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { PageHeader } from "@/components/layout/PageHeader";
import type { LocalOrder } from "@/lib/offlineDb";
import { offlineFetch } from "@/lib/offline-fetch";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { IconCamera, IconPrinter } from "@/components/Icons";
import { QRCodeDisplay } from "@/components/QrCode";
import { SearchInput } from "@/components/ui/SearchInput";
import { db } from "@/lib/offlineDb";
import {
  SortableTh,
  useSortToggle,
  type SortDirection,
} from "@/components/ui/SortableTh";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  type DateFormat,
  type NumberFormat,
} from "@/lib/utils";
import { t, translatePaymentMethod, type Locale } from "@/lib/i18n";

const PAGE_SIZES = [10, 25, 50, 100];

const statusVariant = (status: string) => {
  switch (status) {
    case "COMPLETED":
    case "SYNCED":
      return "success" as const;
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
    case "VOIDED":
    case "SYNC FAILED":
      return "danger" as const;
    default:
      return "warning" as const;
  }
};

const displayStatus = (order: { status?: string; syncStatus: string }) => {
  if (order.syncStatus === "pending") return "PENDING SYNC";
  if (order.syncStatus === "failed") return "SYNC FAILED";
  return order.status ?? "COMPLETED";
};

const paymentStatusVariant = (ps: string) => {
  switch (ps) {
    case "paid":
    case "settled":
      return "success" as const;
    case "credit":
      return "danger" as const;
    case "partial_credit":
      return "warning" as const;
    default:
      return "success" as const;
  }
};

function matchesDateRange(createdAt: number, range: string) {
  if (range === "all") return true;

  const created = new Date(createdAt);
  const now = new Date();

  if (range === "today") {
    return created.toDateString() === now.toDateString();
  }

  const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);

  if (range === "7d") return diffDays <= 7;
  if (range === "30d") return diffDays <= 30;
  return true;
}

export function OrdersContent({
  merchantId,
  merchantName,
  merchantAddress,
  merchantPhone,
  currency,
  currencyFormat = "symbol",
  numberFormat = "western",
  dateFormat = "long",
  language = "en",
}: {
  merchantId: string;
  merchantName: string;
  merchantAddress?: string | null;
  merchantPhone?: string | null;
  currency: string;
  currencyFormat: "symbol" | "code" | "none";
  numberFormat?: NumberFormat;
  dateFormat?: DateFormat;
  language?: string;
}) {
  const router = useRouter();
  const i = t(language as Locale);
  const orders = useLocalOrders(merchantId, 200);
  const [search, setSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const toggleSort = useSortToggle();
  const [selectedOrder, setSelectedOrder] = useState<LocalOrder | null>(null);
  const [processingAction, setProcessingAction] = useState<
    "REFUND" | "VOID" | "PARTIAL_REFUND" | null
  >(null);
  const [actionReason, setActionReason] = useState("");
  const [partialRefundAmount, setPartialRefundAmount] = useState("");
  const [collectLoading, setCollectLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    "REFUND" | "VOID" | "PARTIAL_REFUND" | null
  >(null);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = orders.filter((order) => {
      const status = displayStatus(order);
      const matchesSearch =
        !query ||
        order.orderNumber.toLowerCase().includes(query) ||
        order.staffName?.toLowerCase().includes(query) ||
        order.customerName?.toLowerCase().includes(query) ||
        order.paymentMethod.toLowerCase().includes(query) ||
        order.items.some(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            item.sku?.toLowerCase().includes(query),
        );

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "pending_sync" && order.syncStatus === "pending") ||
        (statusFilter === "sync_failed" && order.syncStatus === "failed") ||
        (statusFilter === "completed" && status === "COMPLETED") ||
        (statusFilter === "refunded" && status === "REFUNDED") ||
        (statusFilter === "partial" && status === "PARTIALLY_REFUNDED") ||
        (statusFilter === "voided" && status === "VOIDED");

      const matchesPayment =
        paymentFilter === "all" || order.paymentMethod === paymentFilter;

      const matchesPaymentStatus =
        paymentStatusFilter === "all" ||
        (order.paymentStatus || "paid") === paymentStatusFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPayment &&
        matchesPaymentStatus &&
        matchesDateRange(order.createdAt, dateRange)
      );
    });

    return result.sort((a, b) => {
      if (!sortKey || !sortDir) return b.createdAt - a.createdAt;

      let cmp = 0;
      switch (sortKey) {
        case "orderNumber":
          cmp = a.orderNumber.localeCompare(b.orderNumber);
          break;
        case "cashier":
          cmp = (a.staffName || "").localeCompare(b.staffName || "");
          break;
        case "customer":
          cmp = (a.customerName || "").localeCompare(b.customerName || "");
          break;
        case "items":
          cmp = a.items.length - b.items.length;
          break;
        case "total":
          cmp = a.total - b.total;
          break;
        case "date":
          cmp = a.createdAt - b.createdAt;
          break;
      }

      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [
    orders,
    search,
    statusFilter,
    paymentFilter,
    paymentStatusFilter,
    dateRange,
    sortKey,
    sortDir,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedOrders = filteredOrders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  async function handleOrderAction(
    action: "REFUND" | "VOID" | "PARTIAL_REFUND",
  ) {
    if (!selectedOrder) return;

    const label =
      action === "REFUND"
        ? "refund"
        : action === "PARTIAL_REFUND"
          ? "partial refund"
          : "void";

    const amount =
      action === "PARTIAL_REFUND" ? Number(partialRefundAmount) : undefined;

    if (action === "PARTIAL_REFUND") {
      if (!Number.isFinite(amount) || !amount || amount <= 0) {
        setFeedback({
          type: "error",
          text: i.orders.enterValidAmount,
        });
        return;
      }

      if (amount >= selectedOrder.total) {
        setFeedback({
          type: "error",
          text: i.orders.useFullRefund,
        });
        return;
      }
    }

    setProcessingAction(action);
    setFeedback(null);

    const result = await offlineFetch({
      url: "/api/merchant/orders",
      method: "PUT",
      body: {
        id: selectedOrder.localId,
        action,
        amount,
        reason: actionReason || null,
      },
      entity: "order",
      merchantId,
    });

    if (!result.ok) {
      setFeedback({
        type: "error",
        text:
          result.error || i.orders.failedToProcess.replace("{action}", label),
      });
    } else {
      const nextStatus =
        action === "REFUND"
          ? "REFUNDED"
          : action === "PARTIAL_REFUND"
            ? "PARTIALLY_REFUNDED"
            : "VOIDED";
      setSelectedOrder((prev) =>
        prev
          ? {
              ...prev,
              status: nextStatus,
              notes: [
                prev.notes,
                actionReason || null,
                action === "PARTIAL_REFUND" && amount
                  ? i.orders.partialRefundNote.replace(
                      "{amount}",
                      String(amount),
                    )
                  : null,
              ]
                .filter(Boolean)
                .join(" • "),
            }
          : prev,
      );
      setFeedback({
        type: "success",
        text: result.offline
          ? i.orders.offlineSuccess.replace("{action}", label)
          : action === "PARTIAL_REFUND"
            ? i.orders.partialRefundSuccess
            : i.orders.actionSuccess.replace("{action}", label),
      });
      setActionReason("");
      setPartialRefundAmount("");
      router.refresh();
    }

    setProcessingAction(null);
  }

  async function handleCollectFullPayment() {
    if (
      !selectedOrder ||
      !selectedOrder.customerId ||
      selectedOrder.creditAmount <= 0
    )
      return;
    setCollectLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/merchant/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedOrder.customerId,
          orderId: selectedOrder.localId,
          amount: selectedOrder.creditAmount,
          method: "CASH",
        }),
      });
      if (res.ok) {
        // Update IndexedDB
        const customer = await db.customers.get(selectedOrder.customerId);
        if (customer) {
          await db.customers.update(selectedOrder.customerId, {
            balance: Math.max(0, customer.balance - selectedOrder.creditAmount),
          });
        }
        setSelectedOrder((prev) =>
          prev ? { ...prev, creditAmount: 0, paymentStatus: "settled" } : prev,
        );
        setFeedback({ type: "success", text: i.customers.paymentCollected });
        router.refresh();
      } else {
        const data = await res
          .json()
          .catch(() => ({ error: i.common.unknown }));
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={i.orders.title}
        subtitle={`${formatNumber(orders.length, numberFormat)} ${i.orders.orders}`}
      />

      <div className="grid gap-3 xl:grid-cols-6">
        <SearchInput
          id="orders-search"
          label={i.common.search}
          placeholder={i.orders.searchPlaceholder}
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          resultCount={filteredOrders.length}
          totalCount={orders.length}
          numberFormat={numberFormat}
          onScan={() => setScannerOpen(true)}
          language={language}
        />
        <Select
          id="orders-status-filter"
          label={i.common.status}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "all", label: i.orders.allStatuses },
            { value: "completed", label: i.orders.completed },
            { value: "pending_sync", label: i.orders.pendingSync },
            { value: "sync_failed", label: i.orders.syncFailed },
            { value: "refunded", label: i.orders.refunded },
            { value: "partial", label: i.orders.partiallyRefunded },
            { value: "voided", label: i.orders.voided },
          ]}
        />
        <Select
          id="orders-payment-filter"
          label={i.orders.payment}
          value={paymentFilter}
          onChange={(e) => {
            setPaymentFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "all", label: i.orders.allMethods },
            { value: "CASH", label: i.pos.cash },
            { value: "CARD", label: i.pos.card },
            { value: "CREDIT", label: i.pos.credit },
            { value: "TRANSFER", label: i.pos.transfer },
            { value: "MOBILE_MONEY", label: i.pos.mobileMoney },
            { value: "SPLIT", label: i.pos.split },
            { value: "OTHER", label: i.pos.other },
          ]}
        />
        <Select
          id="orders-payment-status-filter"
          label={i.orders.paymentStatus}
          value={paymentStatusFilter}
          onChange={(e) => {
            setPaymentStatusFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "all", label: i.orders.allPaymentStatuses },
            { value: "paid", label: i.orders.statusPaid },
            { value: "credit", label: i.orders.statusCredit },
            { value: "partial_credit", label: i.orders.statusPartialCredit },
            { value: "settled", label: i.orders.statusSettled },
          ]}
        />
        <Select
          id="orders-date-filter"
          label={i.orders.dateRange}
          value={dateRange}
          onChange={(e) => {
            setDateRange(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "all", label: i.orders.allTime },
            { value: "today", label: i.common.today },
            { value: "7d", label: i.orders.last7d },
            { value: "30d", label: i.orders.last30d },
          ]}
        />
        <Select
          id="orders-page-size"
          label={i.common.perPage}
          value={String(pageSize)}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          options={PAGE_SIZES.map((s) => ({
            value: String(s),
            label: `${s} ${i.common.rows}`,
          }))}
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
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
            {i.orders.orderHistory}
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <SortableTh
                label={i.orders.orderNumber}
                sortKey="orderNumber"
                currentSort={sortKey}
                currentDirection={sortDir}
                onSort={(k) => {
                  const r = toggleSort(k, sortKey, sortDir);
                  setSortKey(r.sort);
                  setSortDir(r.direction);
                  setPage(1);
                }}
              />
              <SortableTh
                label={i.orders.cashierCol}
                sortKey="cashier"
                currentSort={sortKey}
                currentDirection={sortDir}
                onSort={(k) => {
                  const r = toggleSort(k, sortKey, sortDir);
                  setSortKey(r.sort);
                  setSortDir(r.direction);
                  setPage(1);
                }}
              />
              <SortableTh
                label={i.orders.customerCol}
                sortKey="customer"
                currentSort={sortKey}
                currentDirection={sortDir}
                onSort={(k) => {
                  const r = toggleSort(k, sortKey, sortDir);
                  setSortKey(r.sort);
                  setSortDir(r.direction);
                  setPage(1);
                }}
              />
              <SortableTh
                label={i.orders.itemsCol}
                sortKey="items"
                currentSort={sortKey}
                currentDirection={sortDir}
                onSort={(k) => {
                  const r = toggleSort(k, sortKey, sortDir);
                  setSortKey(r.sort);
                  setSortDir(r.direction);
                  setPage(1);
                }}
              />
              <SortableTh
                label={i.orders.totalCol}
                sortKey="total"
                currentSort={sortKey}
                currentDirection={sortDir}
                onSort={(k) => {
                  const r = toggleSort(k, sortKey, sortDir);
                  setSortKey(r.sort);
                  setSortDir(r.direction);
                  setPage(1);
                }}
              />
              <th className="px-5 py-3.5 text-start font-semibold">
                {i.orders.payment}
              </th>
              <th className="px-5 py-3.5 text-start font-semibold">
                {i.orders.paymentStatus}
              </th>
              <th className="px-5 py-3.5 text-start font-semibold">
                {i.common.status}
              </th>
              <SortableTh
                label={i.orders.date}
                sortKey="date"
                currentSort={sortKey}
                currentDirection={sortDir}
                onSort={(k) => {
                  const r = toggleSort(k, sortKey, sortDir);
                  setSortKey(r.sort);
                  setSortDir(r.direction);
                  setPage(1);
                }}
              />
              <th className="px-3 py-3.5 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredOrders.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-5 py-12 text-center text-slate-400"
                >
                  {orders.length === 0
                    ? i.orders.noOrdersYet
                    : i.orders.noOrdersMatch}
                </td>
              </tr>
            ) : (
              pagedOrders.map((o) => {
                const status = displayStatus(o);
                return (
                  <tr
                    key={o.localId}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        className="cursor-pointer"
                        onClick={() => {
                          setSelectedOrder(o);
                          setActionReason("");
                          setPartialRefundAmount("");
                        }}
                      >
                        <span className="font-semibold text-indigo-600 underline decoration-indigo-300/0 hover:decoration-indigo-300 transition-all">
                          {o.orderNumber}
                        </span>
                      </button>
                    </td>
                    <td className="px-5 py-4 text-slate-500 uppercase">
                      {o.staffName || "·"}
                    </td>
                    <td className="px-5 py-4 text-slate-500 capitalize">
                      {o.customerName || i.pos.walkin}
                    </td>
                    <td className="px-5 py-4 text-slate-500 tabular-nums">
                      {formatNumber(o.items.length, numberFormat)}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-900 tabular-nums">
                      {formatCurrency(
                        o.total,
                        currency,
                        numberFormat,
                        currencyFormat,
                        language,
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {translatePaymentMethod(
                        o.paymentMethod,
                        language as Locale,
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        variant={paymentStatusVariant(
                          o.paymentStatus || "paid",
                        )}
                      >
                        {o.paymentStatus === "credit"
                          ? i.orders.statusCredit
                          : o.paymentStatus === "partial_credit"
                            ? i.orders.statusPartialCredit
                            : o.paymentStatus === "settled"
                              ? i.orders.statusSettled
                              : i.orders.statusPaid}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={statusVariant(status)}>{status}</Badge>
                    </td>
                    <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                      {formatDateTime(
                        new Date(o.createdAt),
                        dateFormat,
                        numberFormat,
                      )}
                    </td>
                    <td className="px-3 py-4">
                      <button
                        type="button"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                        title={i.orders.orderDetails}
                        onClick={() => {
                          setSelectedOrder(o);
                          setActionReason("");
                          setPartialRefundAmount("");
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {pagedOrders.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200 font-semibold text-slate-700">
                <td className="px-5 py-3 text-xs uppercase tracking-wider">
                  {i.orders.pageTotal}
                </td>
                <td className="px-5 py-3" />
                <td className="px-5 py-3" />
                <td className="px-5 py-3 tabular-nums">
                  {formatNumber(
                    pagedOrders.reduce((s, o) => s + o.items.length, 0),
                    numberFormat,
                  )}
                </td>
                <td className="px-5 py-3 font-bold text-slate-900 tabular-nums">
                  {formatCurrency(
                    pagedOrders.reduce((s, o) => s + o.total, 0),
                    currency,
                    numberFormat,
                    currencyFormat,
                    language,
                  )}
                </td>
                <td className="px-5 py-3" />
                <td className="px-5 py-3" />
                <td className="px-5 py-3" />
                <td className="px-5 py-3" />
                <td className="px-3 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {filteredOrders.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            {i.common.showing}{" "}
            {formatNumber((currentPage - 1) * pageSize + 1, numberFormat)}-
            {formatNumber(
              Math.min(currentPage * pageSize, filteredOrders.length),
              numberFormat,
            )}{" "}
            {i.common.of} {formatNumber(filteredOrders.length, numberFormat)}
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

      <Modal
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title={
          selectedOrder
            ? `${i.orders.orderDetails} ${selectedOrder.orderNumber}`
            : i.orders.orderDetails
        }
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {i.orders.customerCol}
                </p>
                <p className="mt-1 font-semibold text-slate-900 capitalize">
                  {selectedOrder.customerName || i.pos.walkin}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {i.orders.cashierCol}
                </p>
                <p className="mt-1 font-semibold text-slate-900 uppercase">
                  {selectedOrder.staffName || "·"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {i.orders.payment}
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {translatePaymentMethod(
                    selectedOrder.paymentMethod,
                    language as Locale,
                  )}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {i.common.status}
                </p>
                <div className="mt-1">
                  <Badge variant={statusVariant(displayStatus(selectedOrder))}>
                    {displayStatus(selectedOrder)}
                  </Badge>
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {i.orders.paymentStatus}
                </p>
                <div className="mt-1">
                  <Badge
                    variant={paymentStatusVariant(
                      selectedOrder.paymentStatus || "paid",
                    )}
                  >
                    {selectedOrder.paymentStatus === "credit"
                      ? i.orders.statusCredit
                      : selectedOrder.paymentStatus === "partial_credit"
                        ? i.orders.statusPartialCredit
                        : selectedOrder.paymentStatus === "settled"
                          ? i.orders.statusSettled
                          : i.orders.statusPaid}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <h3 className="font-semibold text-slate-900">{i.pos.items}</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {selectedOrder.items.map((item, index) => (
                  <div
                    key={`${selectedOrder.localId}-${item.productId}-${index}`}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-sm text-slate-500">
                        {formatNumber(item.quantity, numberFormat)} ×{" "}
                        {formatCurrency(
                          item.price,
                          currency,
                          numberFormat,
                          currencyFormat,
                          language,
                        )}
                      </p>
                    </div>
                    <p className="font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(
                        item.price * item.quantity - item.discount,
                        currency,
                        numberFormat,
                        currencyFormat,
                        language,
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{i.orders.subtotal}</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(
                      selectedOrder.subtotal,
                      currency,
                      numberFormat,
                      currencyFormat,
                      language,
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{i.orders.tax}</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(
                      selectedOrder.taxAmount,
                      currency,
                      numberFormat,
                      currencyFormat,
                      language,
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{i.orders.paid}</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(
                      selectedOrder.paidAmount,
                      currency,
                      numberFormat,
                      currencyFormat,
                      language,
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{i.orders.changeDue}</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(
                      selectedOrder.changeAmount,
                      currency,
                      numberFormat,
                      currencyFormat,
                      language,
                    )}
                  </span>
                </div>
                {selectedOrder.creditAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-amber-600 font-medium">
                      {i.orders.remainingCredit}
                    </span>
                    <span className="font-semibold text-amber-700 tabular-nums">
                      {formatCurrency(
                        selectedOrder.creditAmount,
                        currency,
                        numberFormat,
                        currencyFormat,
                        language,
                      )}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-sm">
                  <span className="font-semibold text-slate-700">
                    {i.orders.total}
                  </span>
                  <span className="text-base font-bold text-slate-900">
                    {formatCurrency(
                      selectedOrder.total,
                      currency,
                      numberFormat,
                      currencyFormat,
                      language,
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {i.orders.date}
                  </p>
                  <p className="mt-1 font-medium text-slate-900">
                    {formatDateTime(
                      new Date(selectedOrder.createdAt),
                      dateFormat,
                      numberFormat,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {i.common.notes}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {selectedOrder.notes || "No notes for this order."}
                  </p>
                </div>
                {selectedOrder.syncError && (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                    {selectedOrder.syncError}
                  </p>
                )}
              </div>
            </div>

            {/* Print button */}
            <div className="flex justify-end gap-3">
              {selectedOrder.creditAmount > 0 && selectedOrder.customerId && (
                <Button
                  variant="primary"
                  type="button"
                  loading={collectLoading}
                  onClick={handleCollectFullPayment}
                >
                  {i.orders.collectPayment} (
                  {formatCurrency(
                    selectedOrder.creditAmount,
                    currency,
                    numberFormat,
                    currencyFormat,
                    language,
                  )}
                  )
                </Button>
              )}
              <Button
                variant="outline"
                type="button"
                onClick={() => window.print()}
              >
                <IconPrinter size={16} />
                {i.orders.printReceipt}
              </Button>
            </div>

            {/* Printable receipt (hidden on screen, visible on print) */}
            <div className="print-receipt hidden">
              <div className="text-center mb-3 font-mono text-xs">
                <p className="font-bold text-sm">{merchantName}</p>
                {merchantAddress && <p>{merchantAddress}</p>}
                {merchantPhone && (
                  <p>
                    {i.common.tel} {merchantPhone}
                  </p>
                )}
                <p className="mt-1">─────────────────</p>
              </div>

              <div className="font-mono text-xs">
                <p>
                  {i.orders.receiptOrder} {selectedOrder.orderNumber}
                </p>
                <p>
                  {i.orders.receiptDate}{" "}
                  {formatDateTime(
                    new Date(selectedOrder.createdAt),
                    dateFormat,
                    numberFormat,
                  )}
                </p>
                {selectedOrder.staffName && (
                  <p>
                    {i.orders.receiptCashier} {selectedOrder.staffName}
                  </p>
                )}
                {selectedOrder.customerName && (
                  <p>
                    {i.orders.receiptCustomer} {selectedOrder.customerName}
                  </p>
                )}
                <p>─────────────────</p>

                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-0.5">
                    <span className="truncate mr-2">
                      {item.quantity}x {item.name}
                    </span>
                    <span className="whitespace-nowrap tabular-nums">
                      {formatCurrency(
                        item.price * item.quantity - item.discount,
                        currency,
                        numberFormat,
                        currencyFormat,
                        language,
                      )}
                    </span>
                  </div>
                ))}

                <p className="mt-1">─────────────────</p>
                <div className="flex justify-between">
                  <span>{i.orders.receiptSubtotal}</span>
                  <span className="tabular-nums">
                    {formatCurrency(
                      selectedOrder.subtotal,
                      currency,
                      numberFormat,
                      currencyFormat,
                      language,
                    )}
                  </span>
                </div>
                {selectedOrder.taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span>{i.orders.receiptTax}</span>
                    <span className="tabular-nums">
                      {formatCurrency(
                        selectedOrder.taxAmount,
                        currency,
                        numberFormat,
                        currencyFormat,
                        language,
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm mt-1">
                  <span>{i.orders.receiptTotal}</span>
                  <span className="tabular-nums">
                    {formatCurrency(
                      selectedOrder.total,
                      currency,
                      numberFormat,
                      currencyFormat,
                      language,
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>
                    {i.orders.receiptPaid.replace(
                      "{method}",
                      translatePaymentMethod(
                        selectedOrder.paymentMethod,
                        language as Locale,
                      ),
                    )}
                  </span>
                  <span className="tabular-nums">
                    {formatCurrency(
                      selectedOrder.paidAmount,
                      currency,
                      numberFormat,
                      currencyFormat,
                      language,
                    )}
                  </span>
                </div>
                {selectedOrder.changeAmount > 0 && (
                  <div className="flex justify-between">
                    <span>{i.orders.receiptChange}</span>
                    <span className="tabular-nums">
                      {formatCurrency(
                        selectedOrder.changeAmount,
                        currency,
                        numberFormat,
                        currencyFormat,
                        language,
                      )}
                    </span>
                  </div>
                )}

                <div className="text-center mt-3">
                  <p>─────────────────</p>
                  <div className="flex justify-center mt-2">
                    <QRCodeDisplay
                      value={selectedOrder.orderNumber}
                      size={80}
                    />
                  </div>
                  <p className="mt-1">{i.orders.receiptThankYou}</p>
                </div>
              </div>
            </div>

            {displayStatus(selectedOrder) === "COMPLETED" ? (
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    id="order-action-reason"
                    label={i.orders.reason}
                    placeholder={i.orders.reasonPlaceholder}
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                  />
                  <Input
                    id="partial-refund-amount"
                    label={i.orders.refundAmount}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={i.orders.refundAmountPlaceholder}
                    value={partialRefundAmount}
                    onChange={(e) => setPartialRefundAmount(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setConfirmAction("PARTIAL_REFUND")}
                    disabled={processingAction !== null}
                  >
                    {processingAction === "PARTIAL_REFUND"
                      ? "..."
                      : i.orders.partialRefund}
                  </Button>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setConfirmAction("REFUND")}
                    disabled={processingAction !== null}
                  >
                    {processingAction === "REFUND" ? "..." : i.orders.refund}
                  </Button>
                  <Button
                    variant="danger"
                    type="button"
                    onClick={() => setConfirmAction("VOID")}
                    disabled={processingAction !== null}
                  >
                    {processingAction === "VOID" ? "..." : i.orders.voidOrder}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {i.orders.orderIsStatus.replace(
                  "{status}",
                  displayStatus(selectedOrder).toLowerCase(),
                )}
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction) {
            handleOrderAction(confirmAction);
            setConfirmAction(null);
          }
        }}
        title={
          confirmAction === "REFUND"
            ? i.orders.confirmRefundTitle
            : confirmAction === "PARTIAL_REFUND"
              ? i.orders.confirmPartialRefundTitle
              : i.orders.confirmVoidTitle
        }
        message={i.orders.confirmActionMessage.replace(
          "{action}",
          confirmAction === "REFUND"
            ? i.orders.refund.toLowerCase()
            : confirmAction === "PARTIAL_REFUND"
              ? i.orders.partialRefund.toLowerCase()
              : i.orders.voidOrder.toLowerCase(),
        )}
        confirmLabel={
          confirmAction === "REFUND"
            ? i.orders.refund
            : confirmAction === "PARTIAL_REFUND"
              ? i.orders.partialRefund
              : i.orders.voidOrder
        }
        variant={confirmAction === "VOID" ? "danger" : "primary"}
      />

      {scannerOpen && (
        <BarcodeScanner
          language={language}
          onScan={(barcode) => {
            setScannerOpen(false);
            const found = orders.find(
              (o) =>
                o.orderNumber === barcode || o.orderNumber === barcode.trim(),
            );
            if (found) {
              setSelectedOrder(found);
              setActionReason("");
              setPartialRefundAmount("");
            } else {
              setSearch(barcode);
              setPage(1);
            }
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
