"use client";

import {
  useCallback,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { CustomerActions } from "./CustomerActions";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { RowActions } from "@/components/ui/RowActions";
import { FloatingActionBar } from "@/components/ui/FloatingActionBar";
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
import {
  SortableTh,
  useSortToggle,
  type SortDirection,
} from "@/components/ui/SortableTh";
import {
  deleteCustomer,
  collectPayment,
  getCustomerPayments,
  getCustomerCreditOrders,
} from "@/app/actions/merchant";

export interface CustomerData {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  totalSpent: number;
  visitCount: number;
  balance: number;
  createdAt: string;
}

const PAGE_SIZE = 10;

export function CustomersContent(props: {
  merchantId: string;
  currency: string;
  currencyFormat: "symbol" | "code" | "none";
  numberFormat?: NumberFormat;
  dateFormat?: DateFormat;
  language?: string;
  customers: CustomerData[];
}) {
  const {
    merchantId,
    currency,
    currencyFormat = "symbol",
    numberFormat = "western",
    dateFormat = "long",
    language = "en",
  } = props;
  const i = t(language as Locale);
  const [customers, setCustomers] = useOptimistic(
    props.customers,
    (
      current: CustomerData[],
      updater: CustomerData[] | ((prev: CustomerData[]) => CustomerData[]),
    ) =>
      typeof updater === "function"
        ? (updater as (prev: CustomerData[]) => CustomerData[])(current)
        : updater,
  );
  const fc = (v: number) =>
    formatCurrency(v, currency, numberFormat, currencyFormat, language);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isBulkDeleting, startBulkDeleteTransition] = useTransition();
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
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const toggleSort = useSortToggle();
  const [collectCustomer, setCollectCustomer] = useState<{
    id: string;
    name: string;
    balance: number;
    orderId?: string | null;
    orderNumber?: string | null;
  } | null>(null);
  const [collectAmount, setCollectAmount] = useState("");
  const [collectMethod, setCollectMethod] = useState<
    "CASH" | "MOBILE_MONEY" | "CARD"
  >("CASH");
  const [collectNote, setCollectNote] = useState("");
  const [isCollecting, startCollectTransition] = useTransition();
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
  type StatementOrder = {
    id: string;
    orderNumber: string;
    creditAmount: number;
    total: number;
    paidAmount: number;
    paymentStatus: string;
    createdAt: string | Date;
    staff?: { name: string } | null;
    items: Array<{
      name: string;
      price: number;
      quantity: number;
      discount: number;
    }>;
  };
  const [statementOrders, setStatementOrders] = useState<StatementOrder[]>([]);
  const [statementReturnTo, setStatementReturnTo] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [editCustomer, setEditCustomer] = useState<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes?: string | null;
  } | null>(null);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    let result = query
      ? customers.filter(
          (c) =>
            c.name.toLowerCase().includes(query) ||
            c.phone?.toLowerCase().includes(query) ||
            c.email?.toLowerCase().includes(query) ||
            c.address?.toLowerCase().includes(query),
        )
      : [...customers];

    return result.sort((a, b) => {
      if (!sortKey || !sortDir) return a.name.localeCompare(b.name);

      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "phone":
          cmp = (a.phone || "").localeCompare(b.phone || "");
          break;
        case "totalSpent":
          cmp = a.totalSpent - b.totalSpent;
          break;
        case "balance":
          cmp = a.balance - b.balance;
          break;
        case "visits":
          cmp = a.visitCount - b.visitCount;
          break;
      }

      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [customers, search, sortKey, sortDir]);

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
    setFeedback(null);
    startDeleteTransition(async () => {
      try {
        const result = await deleteCustomer(id);
        if (result.error) {
          setFeedback({ type: "error", text: result.error });
        } else {
          setCustomers((prev) => prev.filter((customer) => customer.id !== id));
          setSelectedIds((prev) => prev.filter((item) => item !== id));
          setFeedback({
            type: "success",
            text: i.common.deleted.replace("{name}", name),
          });
        }
      } catch {
        setFeedback({ type: "error", text: i.customers.failedToDelete });
      }
    });
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;

    setFeedback(null);
    startBulkDeleteTransition(async () => {
      const failures: string[] = [];

      for (const id of selectedIds) {
        try {
          const result = await deleteCustomer(id);
          if (result.error) {
            failures.push(result.error);
          }
        } catch {
          failures.push(i.common.deleteFailed);
        }
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
        setCustomers((prev) =>
          prev.filter((customer) => !selectedIds.includes(customer.id)),
        );
        setSelectedIds([]);
      }
    });
  }

  async function handleCollectPayment() {
    if (!collectCustomer) return;
    const amount = parseFloat(collectAmount);
    if (!amount || amount <= 0) return;

    startCollectTransition(async () => {
      const method = collectMethod;
      const note = collectNote.trim() || null;

      try {
        const result = await collectPayment({
          customerId: collectCustomer.id,
          orderId: collectCustomer.orderId || null,
          amount,
          method,
          note,
        });

        if (result.success) {
          setFeedback({ type: "success", text: i.customers.paymentCollected });
          const returnTo = statementReturnTo;
          setCollectCustomer(null);
          setCollectAmount("");
          setCollectNote("");
          const appliedAmount = Math.min(amount, collectCustomer.balance);
          setCollectMethod("CASH");
          setStatementReturnTo(null);
          setCustomers((prev) =>
            prev.map((customer) =>
              customer.id === collectCustomer.id
                ? {
                    ...customer,
                    balance: Math.max(0, customer.balance - appliedAmount),
                  }
                : customer,
            ),
          );
          if (returnTo) {
            openStatement(returnTo.id, returnTo.name);
          }
          return;
        }

        setFeedback({
          type: "error",
          text: result.error || i.customers.failedToCollect,
        });
      } catch {
        setFeedback({ type: "error", text: i.customers.failedToCollect });
      }
    });
  }

  const openStatement = useCallback(
    async (customerId: string, customerName: string) => {
      setHistoryCustomer({ id: customerId, name: customerName });
      setPaymentsLoading(true);
      try {
        // Fetch credit orders and payments from server
        const [creditOrders, apiPayments] = await Promise.all([
          getCustomerCreditOrders(customerId),
          getCustomerPayments(customerId),
        ]);

        let paymentEntries: LedgerEntry[] = [];
        if (apiPayments.length > 0) {
          paymentEntries = apiPayments.map(
            (p: {
              id: string;
              amount: number;
              method: string;
              note: string | null;
              createdAt: Date;
              order?: { orderNumber: string } | null;
            }) => ({
              id: `payment-${p.id}`,
              date: new Date(p.createdAt),
              type: "payment" as const,
              ref: p.order?.orderNumber ?? "",
              debit: 0,
              credit: p.amount,
              method: p.method,
              note: p.note,
            }),
          );
        }

        // Parse credit orders
        type ApiOrder = {
          id: string;
          orderNumber: string;
          creditAmount: number;
          total: number;
          paidAmount: number;
          paymentStatus: string;
          createdAt: string | Date;
          staff?: { name: string } | null;
          items: Array<{
            name: string;
            price: number;
            quantity: number;
            discount: number;
          }>;
        };
        let creditOrdersList = creditOrders;

        // Build order entries — debit shows what was originally owed on credit
        // original credit = total - what was paid at POS initially
        // Since paidAmount gets incremented by later payments and creditAmount gets decremented,
        // the original credit portion = creditAmount + sum(later payments applied to this order)
        // For simplicity, we use: total (for full credit) or creditAmount + paidAmount
        // (since paidAmount tracks everything paid including POS and later payments...
        //  but POS payment is also in paidAmount initially)
        // Actually: at creation time creditAmount + paidAmount = total always.
        // After payments: creditAmount decreases, paidAmount increases, total stays.
        // So creditAmount + paidAmount = total always. Original credit = total - (paidAmount at creation).
        // We can't know paidAmount at creation. But we know: current paidAmount - payments from Payment table = original paidAmount at POS.
        const orderEntries: LedgerEntry[] = creditOrdersList.map(
          (o: ApiOrder) => {
            // Sum of payments from Payment table linked to this order
            const laterPayments = paymentEntries
              .filter((pe) => pe.ref === o.orderNumber)
              .reduce((s, pe) => s + pe.credit, 0);
            // Original POS paid = current paidAmount - later payments applied to this order
            const originalPaidAtPOS = Math.max(0, o.paidAmount - laterPayments);
            // Original credit amount = total - what was paid at POS
            const originalCredit = o.total - originalPaidAtPOS;
            return {
              id: `order-${o.id}`,
              date: new Date(o.createdAt),
              type: "order" as const,
              ref: o.orderNumber,
              debit: originalCredit,
              credit: 0,
              note: null,
            };
          },
        );

        const combined = [...orderEntries, ...paymentEntries].sort(
          (a, b) => a.date.getTime() - b.date.getTime(),
        );

        setLedgerEntries(combined);
        setStatementOrders(creditOrdersList);
      } catch {
        setLedgerEntries([]);
        setStatementOrders([]);
        setFeedback({
          type: "error",
          text: i.common.somethingWentWrong,
        });
      } finally {
        setPaymentsLoading(false);
      }
    },
    [i.common.somethingWentWrong],
  );

  const customerStats = useMemo(() => {
    const totalOutstanding = props.customers.reduce((s, c) => s + c.balance, 0);
    const avgSpend =
      props.customers.length > 0
        ? props.customers.reduce((s, c) => s + c.totalSpent, 0) /
          props.customers.length
        : 0;
    return { totalOutstanding, avgSpend };
  }, [props.customers]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={i.customers.title}
        subtitle={`${formatNumber(customers.length, numberFormat)} ${i.customers.customers}`}
      >
        <CustomerActions
          merchantId={merchantId}
          language={language}
          onSaved={(savedCustomer) => {
            const normalized = {
              ...savedCustomer,
              notes: savedCustomer.notes ?? null,
            };
            setCustomers((prev) => {
              const next = prev.some(
                (customer) => customer.id === normalized.id,
              )
                ? prev.map((customer) =>
                    customer.id === normalized.id ? normalized : customer,
                  )
                : [normalized, ...prev];

              return [...next].sort((a, b) => a.name.localeCompare(b.name));
            });
          }}
        />
      </PageHeader>

      {/* Stat cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <StatCard
          title={i.customers.title}
          value={formatNumber(props.customers.length, numberFormat)}
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
              <SortableTh
                label={i.common.name}
                sortKey="name"
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
                label={i.common.phone}
                sortKey="phone"
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
                label={i.customers.totalSpent}
                sortKey="totalSpent"
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
                label={i.customers.balance}
                sortKey="balance"
                currentSort={sortKey}
                currentDirection={sortDir}
                onSort={(k) => {
                  const r = toggleSort(k, sortKey, sortDir);
                  setSortKey(r.sort);
                  setSortDir(r.direction);
                  setPage(1);
                }}
              />
              <th className="px-4 py-3.5 text-center font-semibold">
                {i.customers.statement}
              </th>
              <SortableTh
                label={i.customers.visits}
                sortKey="visits"
                currentSort={sortKey}
                currentDirection={sortDir}
                onSort={(k) => {
                  const r = toggleSort(k, sortKey, sortDir);
                  setSortKey(r.sort);
                  setSortDir(r.direction);
                  setPage(1);
                }}
              />
              <th className="px-4 py-3.5 text-end font-semibold">
                {i.common.actions}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredCustomers.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
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
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-bold tabular-nums ${c.balance > 0 ? "text-amber-700" : "text-slate-300"}`}
                      >
                        {c.balance > 0 ? fc(c.balance) : "—"}
                      </span>
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
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
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
        deleting={isBulkDeleting}
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
          onSaved={(savedCustomer) => {
            const normalized = {
              ...savedCustomer,
              notes: savedCustomer.notes ?? null,
            };
            setCustomers((prev) =>
              prev
                .map((customer) =>
                  customer.id === normalized.id ? normalized : customer,
                )
                .sort((a, b) => a.name.localeCompare(b.name)),
            );
          }}
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
        loading={isDeleting}
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
        title={
          collectCustomer?.orderNumber
            ? `${i.customers.collectPayment} — ${collectCustomer.orderNumber}`
            : i.customers.collectPaymentFrom.replace(
                "{name}",
                collectCustomer?.name ?? "",
              )
        }
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
                loading={isCollecting}
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

      {/* Customer Statement Modal */}
      <Modal
        open={Boolean(historyCustomer)}
        onClose={() => {
          setHistoryCustomer(null);
          setLedgerEntries([]);
          setStatementOrders([]);
          setExpandedOrderRef(null);
        }}
        title={i.customers.statementFor.replace(
          "{name}",
          historyCustomer?.name ?? "",
        )}
        size="lg"
      >
        {paymentsLoading ? (
          <div className="py-10 text-center text-slate-400 text-sm">...</div>
        ) : statementOrders.length === 0 &&
          ledgerEntries.filter((e) => e.type === "payment").length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">
            {i.customers.noActivity}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Summary cards */}
            {(() => {
              const totalDebit = ledgerEntries.reduce((s, e) => s + e.debit, 0);
              const totalPaid = ledgerEntries.reduce((s, e) => s + e.credit, 0);
              const remaining = totalDebit - totalPaid;
              return (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-amber-50 p-3 text-center">
                    <p className="text-[11px] font-medium text-amber-600 uppercase tracking-wider">
                      {i.customers.debit}
                    </p>
                    <p className="text-lg font-bold text-amber-700 tabular-nums">
                      {fc(totalDebit)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3 text-center">
                    <p className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider">
                      {i.customers.credit}
                    </p>
                    <p className="text-lg font-bold text-emerald-700 tabular-nums">
                      {fc(totalPaid)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                      {i.customers.runningBalance}
                    </p>
                    <p
                      className={`text-lg font-bold tabular-nums ${remaining > 0 ? "text-amber-700" : "text-slate-400"}`}
                    >
                      {fc(Math.abs(remaining))}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Invoices (Credit Orders) */}
            {statementOrders.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  {i.customers.invoices}
                </h4>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50/80 text-[11px] text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-3 py-2.5 text-start font-semibold">
                            {i.customers.orderDate}
                          </th>
                          <th className="px-3 py-2.5 text-start font-semibold">
                            {i.customers.orderNo}
                          </th>
                          <th className="px-3 py-2.5 text-end font-semibold">
                            {i.customers.originalAmount}
                          </th>
                          <th className="px-3 py-2.5 text-end font-semibold">
                            {i.customers.paidSoFar}
                          </th>
                          <th className="px-3 py-2.5 text-end font-semibold">
                            {i.customers.remainingAmount}
                          </th>
                          <th className="px-3 py-2.5 w-20" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {statementOrders.map((order) => {
                          const remaining = order.creditAmount;
                          const isSettled = remaining <= 0;
                          const isExpanded =
                            expandedOrderRef === order.orderNumber;
                          return (
                            <tr key={order.id} className="group">
                              <td className="px-3 py-2.5 text-slate-500 text-xs whitespace-nowrap">
                                {formatDateTime(
                                  new Date(order.createdAt),
                                  dateFormat,
                                  numberFormat,
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedOrderRef(
                                      isExpanded ? null : order.orderNumber,
                                    )
                                  }
                                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-mono text-xs cursor-pointer hover:underline"
                                >
                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                  >
                                    <polyline points="9 18 15 12 9 6" />
                                  </svg>
                                  {order.orderNumber}
                                </button>
                              </td>
                              <td className="px-3 py-2.5 text-end tabular-nums font-semibold text-slate-700">
                                {fc(order.total)}
                              </td>
                              <td className="px-3 py-2.5 text-end tabular-nums text-emerald-600">
                                {fc(order.paidAmount)}
                              </td>
                              <td className="px-3 py-2.5 text-end tabular-nums font-bold">
                                {isSettled ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
                                    <svg
                                      width="10"
                                      height="10"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="3"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    {i.customers.settled}
                                  </span>
                                ) : (
                                  <span className="text-amber-700">
                                    {fc(remaining)}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-end">
                                {!isSettled && historyCustomer && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setStatementReturnTo({
                                        id: historyCustomer.id,
                                        name: historyCustomer.name,
                                      });
                                      setHistoryCustomer(null);
                                      setLedgerEntries([]);
                                      setStatementOrders([]);
                                      setCollectCustomer({
                                        id: historyCustomer.id,
                                        name: historyCustomer.name,
                                        balance: remaining,
                                        orderId: order.id,
                                        orderNumber: order.orderNumber,
                                      });
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100 active:bg-amber-200 transition-colors cursor-pointer whitespace-nowrap"
                                  >
                                    <svg
                                      width="10"
                                      height="10"
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
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Expanded order detail panel (below table) */}
                  {expandedOrderRef &&
                    (() => {
                      const order = statementOrders.find(
                        (o) => o.orderNumber === expandedOrderRef,
                      );
                      if (!order) return null;
                      return (
                        <div className="border-t border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-600 space-y-1.5">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span>
                                {item.quantity}× {item.name}
                              </span>
                              <span className="tabular-nums text-slate-500">
                                {fc(item.price * item.quantity - item.discount)}
                              </span>
                            </div>
                          ))}
                          <div className="border-t border-slate-200 pt-1.5 flex justify-between font-semibold text-slate-700">
                            <span>{i.orders.total}</span>
                            <span className="tabular-nums">
                              {fc(order.total)}
                            </span>
                          </div>
                          {order.paidAmount > 0 && (
                            <div className="flex justify-between text-emerald-600">
                              <span>{i.orders.paid}</span>
                              <span className="tabular-nums">
                                {fc(order.paidAmount)}
                              </span>
                            </div>
                          )}
                          {order.staff?.name && (
                            <div className="text-slate-400 pt-0.5">
                              {i.orders.cashierCol}: {order.staff.name}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                </div>
              </div>
            )}

            {/* Payment History */}
            {ledgerEntries.filter((e) => e.type === "payment").length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  {i.customers.payments}
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {ledgerEntries
                    .filter((e) => e.type === "payment")
                    .sort((a, b) => b.date.getTime() - a.date.getTime())
                    .map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-lg bg-emerald-50/40 border border-emerald-100 px-3 py-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-700 shrink-0">
                            +
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-slate-500">
                                {formatDateTime(
                                  entry.date,
                                  dateFormat,
                                  numberFormat,
                                )}
                              </span>
                              {entry.method && (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <span className="text-slate-500">
                                    {translatePaymentMethod(
                                      entry.method,
                                      language as Locale,
                                    )}
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                              {entry.ref && (
                                <span>
                                  {i.customers.forOrder.replace(
                                    "{order}",
                                    entry.ref,
                                  )}
                                </span>
                              )}
                              {entry.note && (
                                <>
                                  {entry.ref && (
                                    <span className="text-slate-300">·</span>
                                  )}
                                  <span className="truncate max-w-50">
                                    {entry.note}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-emerald-700 tabular-nums shrink-0">
                          +{fc(entry.credit)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Collect All button */}
            {(() => {
              const totalDebit = ledgerEntries.reduce((s, e) => s + e.debit, 0);
              const totalCredit = ledgerEntries.reduce(
                (s, e) => s + e.credit,
                0,
              );
              const remaining = totalDebit - totalCredit;
              if (remaining <= 0 || !historyCustomer) return null;
              return (
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    {i.customers.balance}:{" "}
                    <span className="font-bold text-amber-700 tabular-nums">
                      {fc(remaining)}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    onClick={() => {
                      setStatementReturnTo({
                        id: historyCustomer.id,
                        name: historyCustomer.name,
                      });
                      setHistoryCustomer(null);
                      setLedgerEntries([]);
                      setStatementOrders([]);
                      setCollectCustomer({
                        id: historyCustomer.id,
                        name: historyCustomer.name,
                        balance: remaining,
                      });
                    }}
                  >
                    {i.customers.collectAll} — {fc(remaining)}
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
