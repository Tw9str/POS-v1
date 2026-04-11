"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalOrders } from "@/hooks/use-local-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import type { LocalOrder } from "@/lib/offline-db";
import { offlineFetch } from "@/lib/offline-fetch";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  getPaymentMethodLabel,
  type DateFormat,
  type NumberFormat,
} from "@/lib/utils";

const PAGE_SIZE = 12;

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
  currency,
  numberFormat = "western",
  dateFormat = "long",
}: {
  merchantId: string;
  currency: string;
  numberFormat?: NumberFormat;
  dateFormat?: DateFormat;
}) {
  const router = useRouter();
  const orders = useLocalOrders(merchantId, 200);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<LocalOrder | null>(null);
  const [processingAction, setProcessingAction] = useState<
    "REFUND" | "VOID" | "PARTIAL_REFUND" | null
  >(null);
  const [actionReason, setActionReason] = useState("");
  const [partialRefundAmount, setPartialRefundAmount] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
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

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPayment &&
        matchesDateRange(order.createdAt, dateRange)
      );
    });
  }, [orders, search, statusFilter, paymentFilter, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedOrders = filteredOrders.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
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
          text: "Enter a valid partial refund amount.",
        });
        return;
      }

      if (amount >= selectedOrder.total) {
        setFeedback({
          type: "error",
          text: "Use full refund for the whole order amount.",
        });
        return;
      }
    }

    if (!window.confirm(`Are you sure you want to ${label} this order?`)) {
      return;
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
        text: result.error || `Failed to ${label} order`,
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
                  ? `Partial refund amount: ${amount}`
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
          ? `Order ${label} was saved offline and will sync automatically.`
          : action === "PARTIAL_REFUND"
            ? `Partial refund recorded successfully.`
            : `Order ${label}ed successfully.`,
      });
      setActionReason("");
      setPartialRefundAmount("");
      router.refresh();
    }

    setProcessingAction(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        subtitle={`${formatNumber(orders.length, numberFormat)} orders`}
      />

      <div className="grid gap-3 xl:grid-cols-4">
        <Input
          id="orders-search"
          label="Search orders"
          placeholder="Order #, customer, cashier, item..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Select
          id="orders-status-filter"
          label="Status"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All statuses" },
            { value: "completed", label: "Completed" },
            { value: "pending_sync", label: "Pending sync" },
            { value: "sync_failed", label: "Sync failed" },
            { value: "refunded", label: "Refunded" },
            { value: "partial", label: "Partially refunded" },
            { value: "voided", label: "Voided" },
          ]}
        />
        <Select
          id="orders-payment-filter"
          label="Payment"
          value={paymentFilter}
          onChange={(e) => {
            setPaymentFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All methods" },
            { value: "CASH", label: "Cash" },
            { value: "CARD", label: "Card" },
            { value: "TRANSFER", label: "Transfer" },
            { value: "MOBILE_MONEY", label: "Mobile money" },
            { value: "SPLIT", label: "Split" },
            { value: "OTHER", label: "Other" },
          ]}
        />
        <Select
          id="orders-date-filter"
          label="Date range"
          value={dateRange}
          onChange={(e) => {
            setDateRange(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All time" },
            { value: "today", label: "Today" },
            { value: "7d", label: "Last 7 days" },
            { value: "30d", label: "Last 30 days" },
          ]}
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
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
            Order History
          </h2>
          <p className="text-sm text-slate-500">
            {formatNumber(filteredOrders.length, numberFormat)} matching orders
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3.5 text-left font-semibold">Order #</th>
              <th className="px-5 py-3.5 text-left font-semibold">Cashier</th>
              <th className="px-5 py-3.5 text-left font-semibold">Customer</th>
              <th className="px-5 py-3.5 text-left font-semibold">Items</th>
              <th className="px-5 py-3.5 text-left font-semibold">Total</th>
              <th className="px-5 py-3.5 text-left font-semibold">Payment</th>
              <th className="px-5 py-3.5 text-left font-semibold">Status</th>
              <th className="px-5 py-3.5 text-left font-semibold">Date</th>
              <th className="px-5 py-3.5 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredOrders.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-5 py-12 text-center text-slate-400"
                >
                  {orders.length === 0
                    ? "No orders yet"
                    : "No orders match your current filters"}
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
                    <td className="px-5 py-4 font-semibold text-slate-800">
                      {o.orderNumber}
                    </td>
                    <td className="px-5 py-4 text-slate-500 uppercase">
                      {o.staffName || "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-500 capitalize">
                      {o.customerName || "Walk-in"}
                    </td>
                    <td className="px-5 py-4 text-slate-500 tabular-nums">
                      {formatNumber(o.items.length, numberFormat)}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-900 tabular-nums">
                      {formatCurrency(o.total, currency, numberFormat)}
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {getPaymentMethodLabel(o.paymentMethod)}
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
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedOrder(o);
                          setActionReason("");
                          setPartialRefundAmount("");
                        }}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {filteredOrders.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Showing{" "}
            {formatNumber((currentPage - 1) * PAGE_SIZE + 1, numberFormat)}-
            {formatNumber(
              Math.min(currentPage * PAGE_SIZE, filteredOrders.length),
              numberFormat,
            )}{" "}
            of {formatNumber(filteredOrders.length, numberFormat)}
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

      <Modal
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title={
          selectedOrder ? `Order ${selectedOrder.orderNumber}` : "Order details"
        }
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Customer
                </p>
                <p className="mt-1 font-semibold text-slate-900 capitalize">
                  {selectedOrder.customerName || "Walk-in"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Cashier
                </p>
                <p className="mt-1 font-semibold text-slate-900 uppercase">
                  {selectedOrder.staffName || "—"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Payment
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {getPaymentMethodLabel(selectedOrder.paymentMethod)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Status
                </p>
                <div className="mt-1">
                  <Badge variant={statusVariant(displayStatus(selectedOrder))}>
                    {displayStatus(selectedOrder)}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <h3 className="font-semibold text-slate-900">Items</h3>
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
                        {formatCurrency(item.price, currency, numberFormat)}
                      </p>
                    </div>
                    <p className="font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(
                        item.price * item.quantity - item.discount,
                        currency,
                        numberFormat,
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(
                      selectedOrder.subtotal,
                      currency,
                      numberFormat,
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Tax</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(
                      selectedOrder.taxAmount,
                      currency,
                      numberFormat,
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Paid</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(
                      selectedOrder.paidAmount,
                      currency,
                      numberFormat,
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Change</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(
                      selectedOrder.changeAmount,
                      currency,
                      numberFormat,
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-sm">
                  <span className="font-semibold text-slate-700">Total</span>
                  <span className="text-base font-bold text-slate-900">
                    {formatCurrency(
                      selectedOrder.total,
                      currency,
                      numberFormat,
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Date
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
                    Notes
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

            {displayStatus(selectedOrder) === "COMPLETED" ? (
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    id="order-action-reason"
                    label="Reason (optional)"
                    placeholder="Why are you changing this order?"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                  />
                  <Input
                    id="partial-refund-amount"
                    label="Partial refund amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Enter amount to refund"
                    value={partialRefundAmount}
                    onChange={(e) => setPartialRefundAmount(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => handleOrderAction("PARTIAL_REFUND")}
                    disabled={processingAction !== null}
                  >
                    {processingAction === "PARTIAL_REFUND"
                      ? "Saving..."
                      : "Partial Refund"}
                  </Button>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => handleOrderAction("REFUND")}
                    disabled={processingAction !== null}
                  >
                    {processingAction === "REFUND"
                      ? "Refunding..."
                      : "Refund Order"}
                  </Button>
                  <Button
                    variant="danger"
                    type="button"
                    onClick={() => handleOrderAction("VOID")}
                    disabled={processingAction !== null}
                  >
                    {processingAction === "VOID" ? "Voiding..." : "Void Order"}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                This order is {displayStatus(selectedOrder).toLowerCase()} and
                cannot be changed here.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
