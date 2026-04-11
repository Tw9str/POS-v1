"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import {
  IconSearch,
  IconPlus,
  IconMinus,
  IconTrash,
  IconX,
  IconPrinter,
  IconBarcode,
  IconMoney,
  IconCashBanknote,
  IconCardPayment,
  IconWallet,
  IconCamera,
  IconKey,
} from "@/components/icons";
import { BackButton } from "@/components/layout/page-header";
import { useRouter } from "next/navigation";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { useOffline } from "@/hooks/use-offline";
import { createOfflineOrder, saveOrderLocally } from "@/lib/offline-sync";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  getPaymentMethodLabel,
  getProductDisplayName,
  type DateFormat,
  type NumberFormat,
  type SupportedPaymentMethod,
} from "@/lib/utils";
import {
  useLocalProducts,
  useLocalCategories,
  useLocalCustomers,
  useLocalStaff,
} from "@/hooks/use-local-data";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface POSProduct {
  id: string;
  name: string;
  variantName: string | null;
  sku: string | null;
  barcode: string | null;
  price: number;
  costPrice: number;
  stock: number;
  trackStock: boolean;
  image: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
}

interface POSCategory {
  id: string;
  name: string;
  color: string | null;
}

interface POSCustomer {
  id: string;
  name: string;
  phone: string | null;
}

interface POSStaff {
  id: string;
  name: string;
  role: string;
}

interface CartItem {
  product: POSProduct;
  quantity: number;
  discount: number;
}

interface POSTerminalProps {
  currentStaffId: string | null;
  staffRole: string;
  merchant: {
    id: string;
    name: string;
    currency: string;
    taxRate: number;
    phone: string | null;
    address: string | null;
    numberFormat?: NumberFormat;
    dateFormat?: DateFormat;
  };
}

// ─────────────────────────────────────────────
// Currency format helper
// ─────────────────────────────────────────────

function formatMoney(
  amount: number,
  currency: string,
  numberFormat: NumberFormat = "western",
) {
  return formatCurrency(amount, currency, numberFormat);
}

const PAYMENT_METHOD_OPTIONS: Array<{
  value: SupportedPaymentMethod;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  activeRing: string;
  activeBg: string;
  idleIconBg: string;
}> = [
  {
    value: "CASH",
    label: "Cash",
    icon: IconCashBanknote,
    activeRing: "ring-emerald-500",
    activeBg: "bg-emerald-50",
    idleIconBg: "bg-slate-100 text-slate-500",
  },
  {
    value: "MOBILE_MONEY",
    label: "ShamCash",
    icon: IconWallet,
    activeRing: "ring-indigo-500",
    activeBg: "bg-indigo-50",
    idleIconBg: "bg-slate-100 text-slate-500",
  },
  {
    value: "CARD",
    label: "Card",
    icon: IconCardPayment,
    activeRing: "ring-sky-500",
    activeBg: "bg-sky-50",
    idleIconBg: "bg-slate-100 text-slate-500",
  },
];

// ─────────────────────────────────────────────
// POS Terminal Component
// ─────────────────────────────────────────────

export function POSTerminal({
  currentStaffId,
  staffRole,
  merchant,
}: POSTerminalProps) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const isCashier = staffRole === "CASHIER";

  // Offline support
  const offline = useOffline(merchant.id);

  // Read all data from IndexedDB (live — auto-updates)
  const products = useLocalProducts(merchant.id) as POSProduct[];
  const categories = useLocalCategories(merchant.id) as POSCategory[];
  const customers = useLocalCustomers(merchant.id) as POSCustomer[];
  const staff = useLocalStaff(merchant.id) as POSStaff[];

  // State
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<POSCustomer | null>(
    null,
  );
  const selectedStaff = useMemo(
    () => staff.find((s) => s.id === currentStaffId) ?? null,
    [staff, currentStaffId],
  );
  const [paymentMethod, setPaymentMethod] =
    useState<SupportedPaymentMethod>("CASH");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [paidAmount, setPaidAmount] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<{
    orderNumber: string;
    items: CartItem[];
    subtotal: number;
    tax: number;
    total: number;
    paid: number;
    change: number;
    paymentMethod: string;
    customer: POSCustomer | null;
    staff: POSStaff | null;
    date: Date;
  } | null>(null);

  // Focus search on mount
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Keyboard shortcut: F2 = focus search, F9 = checkout
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "F9" && cart.length > 0) {
        e.preventDefault();
        setCheckoutOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart.length]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    let list = products;
    if (activeCategory) {
      list = list.filter((p) => p.categoryId === activeCategory);
    }
    if (search.trim()) {
      const searchQuery = search.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery) ||
          p.variantName?.toLowerCase().includes(searchQuery) ||
          p.sku?.toLowerCase().includes(searchQuery) ||
          p.barcode?.toLowerCase().includes(searchQuery),
      );
    }
    return list;
  }, [products, activeCategory, search]);

  // Cart calculations
  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity - item.discount,
    0,
  );
  const taxAmount = subtotal * (merchant.taxRate / 100);
  const total = subtotal + taxAmount;

  // ─────────────────────────────────────────────
  // Cart actions
  // ─────────────────────────────────────────────

  const addToCart = useCallback((product: POSProduct) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        // Check stock
        if (product.trackStock && existing.quantity >= product.stock)
          return prev;
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      // Check stock for new item
      if (product.trackStock && product.stock <= 0) return prev;
      return [...prev, { product, quantity: 1, discount: 0 }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (item.product.trackStock && newQty > item.product.stock)
            return item;
          return { ...item, quantity: newQty };
        })
        .filter((item): item is CartItem => item !== null),
    );
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setSelectedCustomer(null);
    setOrderNotes("");
  }, []);

  // Barcode scan handler (search field → enter = add first match)
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && filteredProducts.length > 0) {
      addToCart(filteredProducts[0]);
      setSearch("");
    }
  };

  // Camera barcode scan → find product and add to cart
  const handleCameraScan = useCallback(
    (barcode: string) => {
      setScannerOpen(false);
      const found = products.find(
        (p) => p.barcode?.toLowerCase() === barcode.toLowerCase(),
      );
      if (found) {
        addToCart(found);
      } else {
        setSearch(barcode);
      }
    },
    [products, addToCart],
  );

  // ─────────────────────────────────────────────
  // Checkout
  // ─────────────────────────────────────────────

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setProcessing(true);

    const paid = parseFloat(paidAmount) || total;
    const change = Math.max(0, paid - total);

    const orderItems = cart.map((item) => ({
      productId: item.product.id,
      name: getProductDisplayName(item.product.name, item.product.variantName),
      sku: item.product.sku,
      price: item.product.price,
      costPrice: item.product.costPrice,
      quantity: item.quantity,
      discount: item.discount,
    }));

    const finishOrder = (orderNumber: string) => {
      setLastOrder({
        orderNumber,
        items: [...cart],
        subtotal,
        tax: taxAmount,
        total,
        paid,
        change,
        paymentMethod,
        customer: selectedCustomer,
        staff: selectedStaff,
        date: new Date(),
      });

      setCheckoutOpen(false);
      setReceiptOpen(true);
      clearCart();
      setPaidAmount("");
      setOrderNotes("");
    };

    try {
      if (navigator.onLine) {
        // Online: try server first
        const res = await fetch("/api/merchant/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: orderItems,
            customerId: selectedCustomer?.id || null,
            staffId: selectedStaff?.id || null,
            paymentMethod,
            paidAmount: paid,
            notes: orderNotes || null,
            subtotal,
            taxAmount,
            total,
          }),
        });

        if (res.ok) {
          const order = (await res.json()) as {
            id?: string;
            orderNumber: string;
          };

          await saveOrderLocally({
            merchantId: merchant.id,
            localId: order.id,
            orderNumber: order.orderNumber,
            items: orderItems,
            customerId: selectedCustomer?.id || null,
            customerName: selectedCustomer?.name || null,
            staffId: selectedStaff?.id || null,
            staffName: selectedStaff?.name || null,
            paymentMethod,
            subtotal,
            taxAmount,
            total,
            paidAmount: paid,
            notes: orderNotes || null,
            status: "COMPLETED",
            syncStatus: "synced",
          });

          finishOrder(order.orderNumber);
          router.refresh();
          return;
        }
      }

      // Offline or server failed: save locally
      const localOrder = await createOfflineOrder({
        merchantId: merchant.id,
        items: orderItems,
        customerId: selectedCustomer?.id || null,
        staffId: selectedStaff?.id || null,
        paymentMethod,
        subtotal,
        taxAmount,
        total,
        paidAmount: paid,
        notes: orderNotes || null,
      });

      finishOrder(localOrder.orderNumber);
    } catch {
      // Network error: save locally
      try {
        const localOrder = await createOfflineOrder({
          merchantId: merchant.id,
          items: orderItems,
          customerId: selectedCustomer?.id || null,
          staffId: selectedStaff?.id || null,
          paymentMethod,
          subtotal,
          taxAmount,
          total,
          paidAmount: paid,
          notes: orderNotes || null,
        });
        finishOrder(localOrder.orderNumber);
      } catch {
        alert("Failed to save order");
      }
    } finally {
      setProcessing(false);
    }
  };

  // ─────────────────────────────────────────────
  // Print receipt
  // ─────────────────────────────────────────────

  const printReceipt = () => {
    window.print();
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div
      className={`flex flex-col lg:flex-row gap-0 -mx-4 -mt-4 lg:-m-6 ${
        isCashier
          ? "min-h-[calc(100dvh-2rem)] lg:h-[calc(100dvh-3rem)]"
          : "min-h-[calc(100dvh-var(--bottom-nav)-1rem)] lg:h-[calc(100dvh-3rem)]"
      }`}
      style={{
        marginBottom: isCashier ? "-1rem" : "0px",
      }}
    >
      {/* ─── Left: Product Grid ─── */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Search & Offline Status */}
        <div className="p-4 bg-white border-b border-slate-200/80 space-y-3">
          {/* Search */}
          <div className="flex gap-2">
            {isCashier ? (
              <button
                onClick={async () => {
                  await fetch("/api/staff/auth", { method: "DELETE" });
                  router.refresh();
                }}
                className="flex items-center gap-2 px-3 h-11 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-100 active:scale-95 transition-all shrink-0 text-sm font-semibold cursor-pointer"
              >
                <IconKey size={18} />
                <span className="hidden sm:inline">Switch User</span>
              </button>
            ) : (
              <BackButton className="hidden lg:flex" />
            )}
            <div className="relative flex-1">
              <IconSearch
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search products or scan barcode... (F2)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full pl-11 pr-11 py-3 rounded-xl border-2 border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <IconX size={16} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="shrink-0 p-3 rounded-xl border-2 border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 active:scale-95 transition-all cursor-pointer"
              title="Scan barcode with camera"
            >
              <IconCamera size={20} />
            </button>
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all select-none active:scale-95 cursor-pointer ${
                activeCategory === null
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() =>
                  setActiveCategory(activeCategory === cat.id ? null : cat.id)
                }
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all select-none active:scale-95 cursor-pointer ${
                  activeCategory === cat.id
                    ? "text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
                style={
                  activeCategory === cat.id
                    ? { backgroundColor: cat.color || "#4f46e5" }
                    : {
                        backgroundColor: cat.color
                          ? `${cat.color}15`
                          : "#f1f5f9",
                      }
                }
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 pb-[calc(var(--bottom-nav)+1rem)] lg:pb-4">
          {filteredProducts.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              <div className="text-center">
                <IconBarcode size={48} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">No products found</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProducts.map((product) => {
                const inCart = cart.find((c) => c.product.id === product.id);
                const outOfStock = product.trackStock && product.stock <= 0;

                return (
                  <button
                    key={product.id}
                    onClick={() => !outOfStock && addToCart(product)}
                    disabled={outOfStock}
                    className={`relative bg-white rounded-2xl border-2 p-3.5 text-left transition-all select-none ${
                      outOfStock
                        ? "opacity-40 cursor-not-allowed border-slate-200"
                        : "border-slate-200/80 hover:border-indigo-300 hover:shadow-md active:scale-[0.97] cursor-pointer"
                    } ${inCart ? "ring-2 ring-indigo-500 border-indigo-300 shadow-sm shadow-indigo-500/10" : ""}`}
                  >
                    {/* Category dot */}
                    {product.categoryColor && (
                      <div
                        className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: product.categoryColor }}
                      />
                    )}

                    {/* Cart badge */}
                    {inCart && (
                      <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shadow-sm">
                        {inCart.quantity}
                      </div>
                    )}

                    {/* Product info */}
                    <div className="mb-2.5">
                      <p className="text-sm font-semibold text-slate-800 line-clamp-2 leading-tight capitalize">
                        {getProductDisplayName(
                          product.name,
                          product.variantName,
                        )}
                      </p>
                      {product.sku && (
                        <p className="text-[10px] text-slate-400 mt-1 font-mono">
                          {product.sku}
                        </p>
                      )}
                    </div>

                    <div className="flex items-end justify-between">
                      <span className="text-sm font-bold text-indigo-600 tabular-nums">
                        {formatMoney(
                          product.price,
                          merchant.currency,
                          merchant.numberFormat,
                        )}
                      </span>
                      {product.trackStock && (
                        <span
                          className={`text-[10px] font-semibold ${
                            product.stock <= 0
                              ? "text-red-500"
                              : product.stock <= 5
                                ? "text-amber-500"
                                : "text-slate-400"
                          }`}
                        >
                          {product.stock <= 0 ? "Out" : `${product.stock}`}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Right: Cart Panel ─── */}
      <div className="w-full lg:w-96 xl:w-105 flex flex-col bg-white border-l border-slate-200/80 shrink-0">
        {/* Cart header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-slate-900">Cart</h2>
            {cart.length > 0 && (
              <Badge variant="info">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </Badge>
            )}
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Staff & Customer Selection */}
        <div className="px-5 py-2.5 border-b border-slate-100 flex gap-2 items-center">
          <div className="flex-1 flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-2 rounded-xl font-semibold">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              {selectedStaff?.name || "Staff"}
            </span>
          </div>
          <select
            value={selectedCustomer?.id || ""}
            onChange={(e) => {
              const found = customers.find((cu) => cu.id === e.target.value);
              setSelectedCustomer(found || null);
            }}
            className="flex-1 text-xs rounded-xl border-2 border-slate-200 px-3 py-2 font-medium text-slate-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all capitalize"
          >
            <option value="">Walk-in Customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Cart items */}
        <div className="order-3 lg:order-0 flex-1 overflow-y-auto border-t border-slate-100 lg:border-t-0">
          {cart.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              <div className="text-center">
                <IconMoney size={40} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">Cart is empty</p>
                <p className="text-xs mt-1 text-slate-300">
                  Add products to start
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {cart.map((item) => (
                <div key={item.product.id} className="px-5 py-3.5 flex gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 capitalize truncate">
                      {getProductDisplayName(
                        item.product.name,
                        item.product.variantName,
                      )}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatMoney(
                        item.product.price,
                        merchant.currency,
                        merchant.numberFormat,
                      )}{" "}
                      each
                    </p>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
                    >
                      <IconMinus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-slate-900 tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
                      disabled={
                        item.product.trackStock &&
                        item.quantity >= item.product.stock
                      }
                    >
                      <IconPlus size={14} />
                    </button>
                  </div>

                  {/* Line total & remove */}
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-bold text-slate-900 tabular-nums">
                      {formatMoney(
                        item.product.price * item.quantity,
                        merchant.currency,
                        merchant.numberFormat,
                      )}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-red-400 hover:text-red-600 p-0.5 transition-colors active:scale-90 cursor-pointer"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart totals & checkout */}
        <div className="order-2 lg:order-0 sticky bottom-(--bottom-nav) lg:bottom-0 z-10 border-t border-slate-200/80 bg-white p-5 lg:pb-5 space-y-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span className="tabular-nums">
                {formatMoney(
                  subtotal,
                  merchant.currency,
                  merchant.numberFormat,
                )}
              </span>
            </div>
            {merchant.taxRate > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Tax ({merchant.taxRate}%)</span>
                <span className="tabular-nums">
                  {formatMoney(
                    taxAmount,
                    merchant.currency,
                    merchant.numberFormat,
                  )}
                </span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-100">
              <span>Total</span>
              <span className="tabular-nums">
                {formatMoney(total, merchant.currency, merchant.numberFormat)}
              </span>
            </div>
          </div>

          {/* Payment method quickselect */}
          <div className="grid grid-cols-3 gap-2.5">
            {PAYMENT_METHOD_OPTIONS.map((opt) => {
              const selected = paymentMethod === opt.value;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => setPaymentMethod(opt.value)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl py-3 px-2 text-xs font-semibold transition-all select-none active:scale-[0.96] cursor-pointer ring-2 ring-inset ${
                    selected
                      ? `${opt.activeRing} ${opt.activeBg} text-slate-900`
                      : "ring-transparent bg-slate-50 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                      selected ? `${opt.activeBg}` : opt.idleIconBg
                    }`}
                  >
                    <Icon size={22} />
                  </span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          <button
            disabled={cart.length === 0}
            onClick={() => setCheckoutOpen(true)}
            className="w-full flex items-center justify-between rounded-xl bg-indigo-600 pl-5 pr-3 py-3 text-white font-bold transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none select-none cursor-pointer shadow-sm shadow-indigo-600/20"
          >
            <span className="text-sm tracking-wide">Charge</span>
            <span className="flex items-center gap-2">
              <span className="bg-white/20 rounded-lg px-3 py-1 text-sm tabular-nums">
                {formatMoney(total, merchant.currency, merchant.numberFormat)}
              </span>
              <kbd className="text-[10px] font-medium opacity-50">F9</kbd>
            </span>
          </button>
        </div>
      </div>

      {/* ─── Checkout Modal ─── */}
      <Modal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title="Complete Sale"
        size="md"
      >
        <div className="space-y-5">
          {/* Order summary */}
          <div className="bg-slate-50 rounded-2xl p-5 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Items</span>
              <span className="font-semibold text-slate-800 tabular-nums">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-semibold text-slate-800 tabular-nums">
                {formatMoney(
                  subtotal,
                  merchant.currency,
                  merchant.numberFormat,
                )}
              </span>
            </div>
            {merchant.taxRate > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">
                  Tax ({merchant.taxRate}%)
                </span>
                <span className="font-semibold text-slate-800 tabular-nums">
                  {formatMoney(
                    taxAmount,
                    merchant.currency,
                    merchant.numberFormat,
                  )}
                </span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2.5">
              <span className="text-slate-900">Total</span>
              <span className="text-slate-900 tabular-nums">
                {formatMoney(total, merchant.currency, merchant.numberFormat)}
              </span>
            </div>
          </div>

          {/* Payment */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-3">
              {PAYMENT_METHOD_OPTIONS.map((opt) => {
                const selected = paymentMethod === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setPaymentMethod(opt.value)}
                    className={`flex flex-col items-center gap-2 rounded-xl py-3.5 px-2 text-sm font-semibold transition-all select-none active:scale-[0.96] cursor-pointer ring-2 ring-inset ${
                      selected
                        ? `${opt.activeRing} ${opt.activeBg} text-slate-900`
                        : "ring-transparent bg-slate-50 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                        selected ? `${opt.activeBg}` : opt.idleIconBg
                      }`}
                    >
                      <Icon size={24} />
                    </span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {paymentMethod === "CASH" && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Amount Received
              </label>
              <input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder={total.toString()}
                min="0"
                step="any"
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-lg font-bold text-slate-900 tabular-nums focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
              {parseFloat(paidAmount) > 0 &&
                parseFloat(paidAmount) >= total && (
                  <p className="text-sm text-emerald-600 mt-1.5 font-semibold">
                    Change:{" "}
                    {formatMoney(
                      parseFloat(paidAmount) - total,
                      merchant.currency,
                      merchant.numberFormat,
                    )}
                  </p>
                )}
              {parseFloat(paidAmount) > 0 && parseFloat(paidAmount) < total && (
                <p className="text-sm text-red-600 mt-1.5 font-semibold">
                  Insufficient:{" "}
                  {formatMoney(
                    total - parseFloat(paidAmount),
                    merchant.currency,
                    merchant.numberFormat,
                  )}{" "}
                  remaining
                </p>
              )}
              {/* Quick amount buttons */}
              <div className="flex gap-2 mt-2.5">
                {[
                  total,
                  Math.ceil(total / 1000) * 1000,
                  Math.ceil(total / 5000) * 5000,
                ].map((amount, i) => (
                  <button
                    key={i}
                    onClick={() => setPaidAmount(amount.toString())}
                    className="flex-1 py-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-600 hover:bg-slate-200 active:scale-95 transition-all tabular-nums cursor-pointer"
                  >
                    {formatMoney(
                      amount,
                      merchant.currency,
                      merchant.numberFormat,
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              rows={2}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm text-slate-900 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none transition-all"
            />
          </div>

          {/* Customer & Staff info */}
          <div className="flex gap-4 text-sm text-slate-500">
            <div>
              <span className="font-semibold">Cashier:</span>{" "}
              {selectedStaff?.name || "Not assigned"}
            </div>
            <div>
              <span className="font-semibold">Customer:</span>{" "}
              {selectedCustomer?.name || "Walk-in"}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setCheckoutOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              size="lg"
              loading={processing}
              onClick={handleCheckout}
              disabled={
                paymentMethod === "CASH" &&
                parseFloat(paidAmount) > 0 &&
                parseFloat(paidAmount) < total
              }
            >
              Complete Sale
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Receipt Modal ─── */}
      <Modal
        open={receiptOpen}
        onClose={() => {
          setReceiptOpen(false);
          setLastOrder(null);
        }}
        title="Order Complete"
        size="sm"
      >
        {lastOrder && (
          <div className="space-y-5">
            {/* Success indicator */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <svg
                  className="w-8 h-8 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-xl font-bold text-slate-900 tabular-nums">
                {formatMoney(
                  lastOrder.total,
                  merchant.currency,
                  merchant.numberFormat,
                )}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">
                {lastOrder.orderNumber}
              </p>
            </div>

            {lastOrder.paymentMethod === "CASH" && lastOrder.change > 0 && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl px-4 py-3 text-center">
                <p className="text-sm text-amber-800 font-bold tabular-nums">
                  Change:{" "}
                  {formatMoney(
                    lastOrder.change,
                    merchant.currency,
                    merchant.numberFormat,
                  )}
                </p>
              </div>
            )}

            {/* Receipt preview (printable) */}
            <div
              id="receipt"
              className="print-receipt bg-white border-2 border-slate-100 rounded-2xl p-5 text-xs font-mono"
            >
              <div className="text-center mb-3">
                <p className="font-bold text-sm">{merchant.name}</p>
                {merchant.address && <p>{merchant.address}</p>}
                {merchant.phone && <p>Tel: {merchant.phone}</p>}
                <p className="mt-1">─────────────────</p>
              </div>

              <p>Order: {lastOrder.orderNumber}</p>
              <p>
                Date:{" "}
                {formatDateTime(
                  lastOrder.date,
                  merchant.dateFormat,
                  merchant.numberFormat,
                )}
              </p>
              {lastOrder.staff && <p>Cashier: {lastOrder.staff.name}</p>}
              {lastOrder.customer && <p>Customer: {lastOrder.customer.name}</p>}
              <p>─────────────────</p>

              {lastOrder.items.map((item, i) => (
                <div key={i} className="flex justify-between py-0.5">
                  <span className="truncate mr-2">
                    {item.quantity}x{" "}
                    {getProductDisplayName(
                      item.product.name,
                      item.product.variantName,
                    )}
                  </span>
                  <span className="whitespace-nowrap tabular-nums">
                    {formatMoney(
                      item.product.price * item.quantity,
                      merchant.currency,
                      merchant.numberFormat,
                    )}
                  </span>
                </div>
              ))}

              <p className="mt-1">─────────────────</p>
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="tabular-nums">
                  {formatMoney(
                    lastOrder.subtotal,
                    merchant.currency,
                    merchant.numberFormat,
                  )}
                </span>
              </div>
              {lastOrder.tax > 0 && (
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span className="tabular-nums">
                    {formatMoney(
                      lastOrder.tax,
                      merchant.currency,
                      merchant.numberFormat,
                    )}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm mt-1">
                <span>TOTAL</span>
                <span className="tabular-nums">
                  {formatMoney(
                    lastOrder.total,
                    merchant.currency,
                    merchant.numberFormat,
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span>
                  Paid ({getPaymentMethodLabel(lastOrder.paymentMethod)})
                </span>
                <span className="tabular-nums">
                  {formatMoney(
                    lastOrder.paid,
                    merchant.currency,
                    merchant.numberFormat,
                  )}
                </span>
              </div>
              {lastOrder.change > 0 && (
                <div className="flex justify-between">
                  <span>Change</span>
                  <span className="tabular-nums">
                    {formatMoney(
                      lastOrder.change,
                      merchant.currency,
                      merchant.numberFormat,
                    )}
                  </span>
                </div>
              )}

              <div className="text-center mt-3">
                <p>─────────────────</p>
                <p className="mt-1">Thank you!</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={printReceipt}
              >
                <IconPrinter size={16} />
                Print
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  setReceiptOpen(false);
                  setLastOrder(null);
                }}
              >
                New Sale
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {scannerOpen && (
        <BarcodeScanner
          onScan={handleCameraScan}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
