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
  IconCamera,
} from "@/components/icons";
import { useRouter } from "next/navigation";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { useOffline } from "@/hooks/use-offline";
import { createOfflineOrder } from "@/lib/offline-sync";
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
  merchant: {
    id: string;
    name: string;
    currency: string;
    taxRate: number;
    phone: string | null;
    address: string | null;
  };
}

// ─────────────────────────────────────────────
// Currency format helper
// ─────────────────────────────────────────────

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("ar-SY", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ─────────────────────────────────────────────
// POS Terminal Component
// ─────────────────────────────────────────────

export function POSTerminal({ currentStaffId, merchant }: POSTerminalProps) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

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
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
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
      name: item.product.name,
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
          const order = await res.json();
          finishOrder(order.orderNumber);
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
    <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row gap-0 -m-6">
      {/* ─── Left: Product Grid ─── */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        {/* Search & Offline Status */}
        <div className="p-4 bg-white border-b border-gray-200 space-y-3">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <IconSearch
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search products or scan barcode... (F2)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <IconX size={16} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="shrink-0 p-2.5 rounded-lg border border-gray-300 text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              title="Scan barcode with camera"
            >
              <IconCamera size={18} />
            </button>
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeCategory === null
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeCategory === cat.id
                    ? "text-white"
                    : "text-gray-600 hover:bg-gray-200"
                }`}
                style={
                  activeCategory === cat.id
                    ? { backgroundColor: cat.color || "#2563eb" }
                    : {
                        backgroundColor: cat.color
                          ? `${cat.color}20`
                          : "#f3f4f6",
                      }
                }
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredProducts.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <IconBarcode size={48} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">No products found</p>
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
                    className={`relative bg-white rounded-xl border p-3 text-left transition-all ${
                      outOfStock
                        ? "opacity-50 cursor-not-allowed border-gray-200"
                        : "border-gray-200 hover:border-blue-300 hover:shadow-md active:scale-95"
                    } ${inCart ? "ring-2 ring-blue-500 border-blue-300" : ""}`}
                  >
                    {/* Category dot */}
                    {product.categoryColor && (
                      <div
                        className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: product.categoryColor }}
                      />
                    )}

                    {/* Cart badge */}
                    {inCart && (
                      <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                        {inCart.quantity}
                      </div>
                    )}

                    {/* Product info */}
                    <div className="mb-2">
                      <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight">
                        {product.name}
                      </p>
                      {product.sku && (
                        <p className="text-[10px] text-gray-400 mt-0.5 font-mono">
                          {product.sku}
                        </p>
                      )}
                    </div>

                    <div className="flex items-end justify-between">
                      <span className="text-sm font-bold text-blue-600">
                        {formatMoney(product.price, merchant.currency)}
                      </span>
                      {product.trackStock && (
                        <span
                          className={`text-[10px] font-medium ${
                            product.stock <= 0
                              ? "text-red-500"
                              : product.stock <= 5
                                ? "text-yellow-500"
                                : "text-gray-400"
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
      <div className="w-full lg:w-96 xl:w-[420px] flex flex-col bg-white border-l border-gray-200 shrink-0">
        {/* Cart header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Cart</h2>
            {cart.length > 0 && (
              <Badge variant="info">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </Badge>
            )}
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-red-500 hover:text-red-700 font-medium"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Staff & Customer Selection */}
        <div className="px-4 py-2 border-b border-gray-100 flex gap-2 items-center">
          <div className="flex-1 flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1.5 rounded-lg font-medium">
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
            className="flex-1 text-xs rounded-lg border border-gray-200 px-2 py-1.5 text-gray-600 focus:ring-1 focus:ring-blue-500 outline-none"
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
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <IconMoney size={40} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Cart is empty</p>
                <p className="text-xs mt-1">Add products to start</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {cart.map((item) => (
                <div key={item.product.id} className="px-4 py-3 flex gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.product.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatMoney(item.product.price, merchant.currency)} each
                    </p>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                    >
                      <IconMinus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-gray-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
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
                    <span className="text-sm font-semibold text-gray-900">
                      {formatMoney(
                        item.product.price * item.quantity,
                        merchant.currency,
                      )}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-red-400 hover:text-red-600 transition-colors"
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
        <div className="border-t border-gray-200 p-4 space-y-3">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>{formatMoney(subtotal, merchant.currency)}</span>
            </div>
            {merchant.taxRate > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Tax ({merchant.taxRate}%)</span>
                <span>{formatMoney(taxAmount, merchant.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-1 border-t border-gray-200">
              <span>Total</span>
              <span>{formatMoney(total, merchant.currency)}</span>
            </div>
          </div>

          {/* Payment method quickselect */}
          <div className="flex gap-2">
            {(["CASH", "CARD", "TRANSFER"] as const).map((method) => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  paymentMethod === method
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {method === "CASH"
                  ? "Cash"
                  : method === "CARD"
                    ? "Card"
                    : "Transfer"}
              </button>
            ))}
          </div>

          <Button
            size="lg"
            className="w-full text-base"
            disabled={cart.length === 0}
            onClick={() => setCheckoutOpen(true)}
          >
            <IconMoney size={20} />
            Charge {formatMoney(total, merchant.currency)}
            <span className="text-xs opacity-70 ml-1">(F9)</span>
          </Button>
        </div>
      </div>

      {/* ─── Checkout Modal ─── */}
      <Modal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title="Complete Sale"
        size="md"
      >
        <div className="space-y-4">
          {/* Order summary */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Items</span>
              <span className="font-medium">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium">
                {formatMoney(subtotal, merchant.currency)}
              </span>
            </div>
            {merchant.taxRate > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Tax ({merchant.taxRate}%)</span>
                <span className="font-medium">
                  {formatMoney(taxAmount, merchant.currency)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
              <span>Total</span>
              <span>{formatMoney(total, merchant.currency)}</span>
            </div>
          </div>

          {/* Payment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method
            </label>
            <div className="flex gap-2">
              {(["CASH", "CARD", "TRANSFER", "MOBILE_MONEY"] as const).map(
                (method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                      paymentMethod === method
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {method.replace("_", " ")}
                  </button>
                ),
              )}
            </div>
          </div>

          {paymentMethod === "CASH" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount Received
              </label>
              <input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder={total.toString()}
                min="0"
                step="any"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-lg font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              {parseFloat(paidAmount) > 0 &&
                parseFloat(paidAmount) >= total && (
                  <p className="text-sm text-green-600 mt-1 font-medium">
                    Change:{" "}
                    {formatMoney(
                      parseFloat(paidAmount) - total,
                      merchant.currency,
                    )}
                  </p>
                )}
              {parseFloat(paidAmount) > 0 && parseFloat(paidAmount) < total && (
                <p className="text-sm text-red-600 mt-1 font-medium">
                  Insufficient:{" "}
                  {formatMoney(
                    total - parseFloat(paidAmount),
                    merchant.currency,
                  )}{" "}
                  remaining
                </p>
              )}
              {/* Quick amount buttons */}
              <div className="flex gap-2 mt-2">
                {[
                  total,
                  Math.ceil(total / 1000) * 1000,
                  Math.ceil(total / 5000) * 5000,
                ].map((amount, i) => (
                  <button
                    key={i}
                    onClick={() => setPaidAmount(amount.toString())}
                    className="flex-1 py-1.5 rounded-lg bg-gray-100 text-xs font-medium text-gray-600 hover:bg-gray-200"
                  >
                    {formatMoney(amount, merchant.currency)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          {/* Customer & Staff info */}
          <div className="flex gap-4 text-sm text-gray-500">
            <div>
              <span className="font-medium">Cashier:</span>{" "}
              {selectedStaff?.name || "Not assigned"}
            </div>
            <div>
              <span className="font-medium">Customer:</span>{" "}
              {selectedCustomer?.name || "Walk-in"}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
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
          <div className="space-y-4">
            {/* Success indicator */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-3">
                <svg
                  className="w-8 h-8 text-green-600"
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
              <p className="text-lg font-bold text-gray-900">
                {formatMoney(lastOrder.total, merchant.currency)}
              </p>
              <p className="text-sm text-gray-500">{lastOrder.orderNumber}</p>
            </div>

            {lastOrder.paymentMethod === "CASH" && lastOrder.change > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-center">
                <p className="text-sm text-yellow-800 font-medium">
                  Change: {formatMoney(lastOrder.change, merchant.currency)}
                </p>
              </div>
            )}

            {/* Receipt preview (printable) */}
            <div
              id="receipt"
              className="print-receipt bg-white border border-gray-200 rounded-lg p-4 text-xs font-mono"
            >
              <div className="text-center mb-3">
                <p className="font-bold text-sm">{merchant.name}</p>
                {merchant.address && <p>{merchant.address}</p>}
                {merchant.phone && <p>Tel: {merchant.phone}</p>}
                <p className="mt-1">─────────────────</p>
              </div>

              <p>Order: {lastOrder.orderNumber}</p>
              <p>Date: {lastOrder.date.toLocaleString()}</p>
              {lastOrder.staff && <p>Cashier: {lastOrder.staff.name}</p>}
              {lastOrder.customer && <p>Customer: {lastOrder.customer.name}</p>}
              <p>─────────────────</p>

              {lastOrder.items.map((item, i) => (
                <div key={i} className="flex justify-between py-0.5">
                  <span className="truncate mr-2">
                    {item.quantity}x {item.product.name}
                  </span>
                  <span className="whitespace-nowrap">
                    {formatMoney(
                      item.product.price * item.quantity,
                      merchant.currency,
                    )}
                  </span>
                </div>
              ))}

              <p className="mt-1">─────────────────</p>
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>
                  {formatMoney(lastOrder.subtotal, merchant.currency)}
                </span>
              </div>
              {lastOrder.tax > 0 && (
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>{formatMoney(lastOrder.tax, merchant.currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm mt-1">
                <span>TOTAL</span>
                <span>{formatMoney(lastOrder.total, merchant.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>Paid ({lastOrder.paymentMethod})</span>
                <span>{formatMoney(lastOrder.paid, merchant.currency)}</span>
              </div>
              {lastOrder.change > 0 && (
                <div className="flex justify-between">
                  <span>Change</span>
                  <span>
                    {formatMoney(lastOrder.change, merchant.currency)}
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
