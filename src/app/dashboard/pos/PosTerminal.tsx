"use client";

import {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  useOptimistic,
  useTransition,
} from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
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
  IconPromo,
  IconClock,
} from "@/components/Icons";
import { BackButton } from "@/components/layout/PageHeader";
import { switchUser } from "@/lib/staffActions";
import { BarcodeScanner } from "@/components/features/BarcodeScanner";
import { QRCodeDisplay } from "@/components/features/QrCode";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  getProductDisplayName,
  type DateFormat,
  type NumberFormat,
  type SupportedPaymentMethod,
} from "@/lib/utils";
import { t, translatePaymentMethod, type Locale } from "@/lib/i18n";
import {
  createCustomer,
  createOrder,
  validatePromoCode,
} from "@/app/actions/merchant";
import type { ActionResult } from "@/app/actions/merchant";
import { useOutsideClick } from "@/hooks/useOutsideClick";

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
  balance: number;
}

interface POSStaff {
  id: string;
  name: string;
  role: string;
  maxDiscountPercent: number;
}

interface CartItem {
  product: POSProduct;
  quantity: number;
  discount: number;
  unitPrice: number | null; // price override (null = use product.price)
  discountType: "PERCENT" | "FIXED" | null;
  discountValue: number;
}

interface POSTerminalProps {
  currentStaffId: string | null;
  staffRole: string;
  posOnly: boolean;
  language: string;
  merchant: {
    id: string;
    name: string;
    currency: string;
    taxRate: number;
    phone: string | null;
    address: string | null;
    numberFormat?: NumberFormat;
    currencyFormat?: "symbol" | "code" | "none";
    dateFormat?: DateFormat;
    shamcashId?: string | null;
  };
  products: POSProduct[];
  categories: POSCategory[];
  customers: POSCustomer[];
  staff: POSStaff[];
}

// ─────────────────────────────────────────────
// Currency format helper
// ─────────────────────────────────────────────

function formatMoney(
  amount: number,
  currency: string,
  numberFormat: NumberFormat = "western",
  currencyFormat: "symbol" | "code" | "none" = "symbol",
  language?: string,
) {
  return formatCurrency(
    amount,
    currency,
    numberFormat,
    currencyFormat,
    language,
  );
}

const PAYMENT_METHOD_OPTIONS: Array<{
  value: SupportedPaymentMethod;
  labelKey: "cash" | "shamcash" | "card" | "credit";
  icon: React.ComponentType<{ size?: number; className?: string }>;
  activeRing: string;
  activeBg: string;
  idleIconBg: string;
}> = [
  {
    value: "CASH",
    labelKey: "cash",
    icon: IconCashBanknote,
    activeRing: "ring-emerald-500",
    activeBg: "bg-emerald-50",
    idleIconBg: "bg-slate-100 text-slate-500",
  },
  {
    value: "MOBILE_MONEY",
    labelKey: "shamcash",
    icon: IconWallet,
    activeRing: "ring-indigo-500",
    activeBg: "bg-indigo-50",
    idleIconBg: "bg-slate-100 text-slate-500",
  },
  {
    value: "CARD",
    labelKey: "card",
    icon: IconCardPayment,
    activeRing: "ring-sky-500",
    activeBg: "bg-sky-50",
    idleIconBg: "bg-slate-100 text-slate-500",
  },
  {
    value: "CREDIT",
    labelKey: "credit",
    icon: IconClock,
    activeRing: "ring-amber-500",
    activeBg: "bg-amber-50",
    idleIconBg: "bg-slate-100 text-slate-500",
  },
];

// ─────────────────────────────────────────────
// POS Terminal Component
// ─────────────────────────────────────────────

export function POSTerminal(props: POSTerminalProps) {
  const {
    currentStaffId,
    staffRole,
    posOnly,
    language,
    merchant,
    categories,
    staff,
  } = props;
  const searchRef = useRef<HTMLInputElement>(null);
  const i = t(language as Locale);
  const isCashier = posOnly;

  // Optimistic customers list — allows instant client-side additions
  const [customers, setCustomers] = useOptimistic(
    props.customers,
    (
      current: POSCustomer[],
      updater: POSCustomer[] | ((prev: POSCustomer[]) => POSCustomer[]),
    ) =>
      typeof updater === "function"
        ? (updater as (prev: POSCustomer[]) => POSCustomer[])(current)
        : updater,
  );

  // Optimistic products list — instant stock updates after checkout
  const [products, setProducts] = useOptimistic(
    props.products,
    (
      current: POSProduct[],
      updater: POSProduct[] | ((prev: POSProduct[]) => POSProduct[]),
    ) =>
      typeof updater === "function"
        ? (updater as (prev: POSProduct[]) => POSProduct[])(current)
        : updater,
  );

  // State
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<POSCustomer | null>(
    null,
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddPhone, setQuickAddPhone] = useState("");
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [isQuickAdding, startQuickAddTransition] = useTransition();
  const customerPickerRef = useRef<HTMLDivElement>(null);
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
  const [isProcessing, startProcessTransition] = useTransition();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<{
    orderNumber: string;
    items: CartItem[];
    subtotal: number;
    tax: number;
    total: number;
    paid: number;
    change: number;
    creditAmount: number;
    paymentMethod: string;
    customer: POSCustomer | null;
    staff: POSStaff | null;
    date: Date;
    promoCode: string | null;
    promoDiscount: number;
  } | null>(null);

  // Promo code state
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState<{
    code: string;
    id: string;
    discountAmount: number;
    type: string;
    value: number;
  } | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  // Line discount editing
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [lineDiscountInput, setLineDiscountInput] = useState("");
  const [lineDiscountType, setLineDiscountType] = useState<"PERCENT" | "FIXED">(
    "PERCENT",
  );
  const [linePriceInput, setLinePriceInput] = useState("");

  // Focus search on mount
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Close customer dropdown on outside click
  useOutsideClick(
    customerPickerRef,
    useCallback(() => setCustomerDropdownOpen(false), []),
    customerDropdownOpen,
  );

  // Filtered customers for picker
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q),
    );
  }, [customers, customerSearch]);

  // Quick-add customer inline
  async function handleQuickAddCustomer() {
    const name = quickAddName.trim();
    if (!name) return;
    setQuickAddError(null);
    startQuickAddTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("name", name);
        if (quickAddPhone.trim()) fd.set("phone", quickAddPhone.trim());
        const result = await createCustomer(
          {
            error: undefined,
            success: undefined,
            data: undefined,
          } as ActionResult,
          fd,
        );
        if (result.success && result.data) {
          const created = result.data as {
            id: string;
            name: string;
            phone: string | null;
          };
          const newCustomer: POSCustomer = {
            id: created.id,
            name: created.name,
            phone: created.phone ?? null,
            balance: 0,
          };
          setCustomers((prev) => [...prev, newCustomer]);
          setSelectedCustomer(newCustomer);
          setQuickAddOpen(false);
          setQuickAddName("");
          setQuickAddPhone("");
          setCustomerSearch("");
          setCustomerDropdownOpen(false);
        } else {
          setQuickAddError(result.error ?? i.common.somethingWentWrong);
        }
      } catch {
        setQuickAddError(i.common.somethingWentWrong);
      }
    });
  }

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
  const subtotal = cart.reduce((sum, item) => {
    const price = item.unitPrice ?? item.product.price;
    let lineTotal = price * item.quantity;
    // Apply line discount
    if (item.discountType === "PERCENT") {
      lineTotal -= lineTotal * (item.discountValue / 100);
    } else if (item.discountType === "FIXED") {
      lineTotal -= item.discountValue;
    }
    // Legacy discount field
    lineTotal -= item.discount;
    return sum + Math.max(0, lineTotal);
  }, 0);
  const promoDiscount = promoApplied?.discountAmount ?? 0;
  const subtotalAfterPromo = Math.max(0, subtotal - promoDiscount);
  const taxAmount = subtotalAfterPromo * (merchant.taxRate / 100);
  const total = subtotalAfterPromo + taxAmount;

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
      return [
        ...prev,
        {
          product,
          quantity: 1,
          discount: 0,
          unitPrice: null,
          discountType: null,
          discountValue: 0,
        },
      ];
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
    setPromoCode("");
    setPromoApplied(null);
    setPromoError("");
    setEditingLineId(null);
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
  // Line discount / price override
  // ─────────────────────────────────────────────

  const maxDiscount = useMemo(() => {
    if (staffRole === "OWNER" || staffRole === "MANAGER") return 100;
    const currentStaffData = staff.find((s) => s.id === currentStaffId) as
      | (POSStaff & { maxDiscountPercent?: number })
      | undefined;
    return currentStaffData?.maxDiscountPercent ?? 0;
  }, [staffRole, staff, currentStaffId]);

  const openLineEdit = (productId: string) => {
    const item = cart.find((c) => c.product.id === productId);
    if (!item) return;
    setEditingLineId(productId);
    setLineDiscountType(item.discountType ?? "PERCENT");
    setLineDiscountInput(
      item.discountValue > 0 ? String(item.discountValue) : "",
    );
    setLinePriceInput(item.unitPrice !== null ? String(item.unitPrice) : "");
  };

  const applyLineDiscount = () => {
    if (!editingLineId) return;
    const discVal = parseFloat(lineDiscountInput) || 0;
    const priceOverride =
      linePriceInput !== "" ? parseFloat(linePriceInput) : null;

    // Enforce max discount for cashiers
    if (lineDiscountType === "PERCENT" && discVal > maxDiscount) {
      return; // blocked
    }
    if (priceOverride !== null && priceOverride >= 0) {
      const item = cart.find((c) => c.product.id === editingLineId);
      if (item) {
        const discountPct =
          ((item.product.price - priceOverride) / item.product.price) * 100;
        if (discountPct > maxDiscount) return; // blocked
      }
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id !== editingLineId) return item;
        return {
          ...item,
          unitPrice: priceOverride,
          discountType: discVal > 0 ? lineDiscountType : null,
          discountValue: discVal,
        };
      }),
    );
    setEditingLineId(null);
    setLineDiscountInput("");
    setLinePriceInput("");
  };

  // ─────────────────────────────────────────────
  // Promo code
  // ─────────────────────────────────────────────

  const validatePromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError("");

    const code = promoCode.trim().toUpperCase();

    try {
      const data = await validatePromoCode({
        code,
        subtotal,
        cartItems: cart.map((item) => ({
          productId: item.product.id,
          categoryId: item.product.categoryId,
          quantity: item.quantity,
          lineTotal: (item.unitPrice ?? item.product.price) * item.quantity,
        })),
      });
      if (data.valid && data.promo) {
        setPromoApplied({
          code: data.promo.code,
          id: data.promo.id,
          discountAmount: data.discountAmount,
          type: data.promo.type,
          value: data.promo.value,
        });
        setPromoCode("");
      } else {
        setPromoError(data.reason || i.pos.invalidPromoCode);
      }
    } catch {
      setPromoError(i.pos.invalidPromoCode);
    } finally {
      setPromoLoading(false);
    }
  };

  const removePromo = () => {
    setPromoApplied(null);
    setPromoError("");
  };

  // ─────────────────────────────────────────────
  // Checkout
  // ─────────────────────────────────────────────

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    // Credit requires a customer
    if (paymentMethod === "CREDIT" && !selectedCustomer) {
      setCheckoutError(i.pos.creditRequiresCustomer);
      return;
    }

    setCheckoutError(null);
    startProcessTransition(async () => {
      const paid =
        paymentMethod === "CREDIT" ? 0 : parseFloat(paidAmount) || total;
      const creditAmt = paymentMethod === "CREDIT" ? total : 0;
      const change = paymentMethod === "CREDIT" ? 0 : Math.max(0, paid - total);

      const orderItems = cart.map((item) => ({
        productId: item.product.id,
        name: getProductDisplayName(
          item.product.name,
          item.product.variantName,
        ),
        sku: item.product.sku,
        price: item.product.price,
        costPrice: item.product.costPrice,
        quantity: item.quantity,
        discount: item.discount,
        originalPrice: item.unitPrice !== null ? item.product.price : undefined,
        unitPrice: item.unitPrice ?? item.product.price,
        discountType: item.discountType ?? undefined,
        discountValue: item.discountValue,
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
          creditAmount: creditAmt,
          paymentMethod,
          customer: selectedCustomer,
          staff: selectedStaff,
          date: new Date(),
          promoCode: promoApplied?.code ?? null,
          promoDiscount,
        });

        setCheckoutOpen(false);
        setReceiptOpen(true);
        clearCart();
        setPaidAmount("");
        setOrderNotes("");
      };

      try {
        const result = await createOrder({
          items: orderItems,
          customerId: selectedCustomer?.id || null,
          staffId: selectedStaff?.id || null,
          paymentMethod,
          paidAmount: paid,
          creditAmount: creditAmt,
          notes: orderNotes || null,
          subtotal,
          taxAmount,
          total,
          promoCode: promoApplied?.code || null,
          promoId: promoApplied?.id || null,
          promoDiscount,
        });

        if (result.success && result.data) {
          const order = result.data as {
            id?: string;
            orderNumber: string;
          };

          setProducts((prev) =>
            prev.map((product) => {
              const purchased = cart.find(
                (item) => item.product.id === product.id,
              );
              if (!purchased || !product.trackStock) return product;
              return {
                ...product,
                stock: Math.max(0, product.stock - purchased.quantity),
              };
            }),
          );

          if (paymentMethod === "CREDIT" && selectedCustomer) {
            const nextBalance = selectedCustomer.balance + creditAmt;
            setCustomers((prev) =>
              prev.map((customer) =>
                customer.id === selectedCustomer.id
                  ? { ...customer, balance: nextBalance }
                  : customer,
              ),
            );
          }

          finishOrder(order.orderNumber);
          return;
        } else {
          setCheckoutError(result.error || i.pos.failedToSaveOrder);
        }
      } catch {
        setCheckoutError(i.pos.failedToSaveOrder);
      }
    });
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
        {/* Search */}
        <div className="p-4 bg-white border-b border-slate-200/80 space-y-3">
          {/* Search */}
          <div className="flex gap-2">
            {isCashier ? (
              <button
                onClick={() => switchUser()}
                className="flex items-center gap-2 px-3 h-11 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-100 active:scale-95 transition-all shrink-0 text-sm font-semibold cursor-pointer"
              >
                <IconKey size={18} />
                <span className="hidden sm:inline">
                  {i.pos.switchUserButton}
                </span>
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
                placeholder={i.pos.searchPlaceholder}
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
              title={i.pos.scanBarcodeCamera}
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
              {i.common.all}
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
                {cat.name === "Other" ? i.products.categoryOther : cat.name}
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
                <p className="text-sm font-medium">{i.pos.noProductsFound}</p>
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
                          merchant.currencyFormat,
                          language,
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
                          {product.stock <= 0 ? i.pos.out : `${product.stock}`}
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
            <h2 className="text-lg font-bold text-slate-900">{i.pos.cart}</h2>
            {cart.length > 0 && (
              <Badge variant="info">
                {cart.reduce((s, ci) => s + ci.quantity, 0)}
              </Badge>
            )}
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
            >
              {i.pos.clearAll}
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
              {selectedStaff?.name || i.pos.staff}
            </span>
          </div>
          <div className="flex-1 relative" ref={customerPickerRef}>
            <div className="flex items-center text-xs rounded-xl border-2 border-slate-200 px-3 py-2 font-medium text-slate-600 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all bg-white">
              {selectedCustomer && !customerDropdownOpen ? (
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => setCustomerDropdownOpen(true)}
                    className="flex items-center gap-1.5 flex-1 min-w-0 text-start cursor-text"
                  >
                    <span className="truncate capitalize">
                      {selectedCustomer.name}
                    </span>
                    {selectedCustomer.balance > 0 && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full tabular-nums shrink-0">
                        {formatMoney(
                          selectedCustomer.balance,
                          merchant.currency,
                          merchant.numberFormat,
                          merchant.currencyFormat,
                          language,
                        )}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerSearch("");
                    }}
                    className="shrink-0 p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                    aria-label={i.common.clear}
                  >
                    <IconX size={12} />
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setCustomerDropdownOpen(true);
                  }}
                  onFocus={() => setCustomerDropdownOpen(true)}
                  placeholder={
                    selectedCustomer
                      ? selectedCustomer.name
                      : i.pos.searchOrAddCustomer
                  }
                  className="flex-1 bg-transparent outline-none text-xs text-slate-600 placeholder-slate-400 min-w-0"
                />
              )}
              <svg
                className={`shrink-0 w-3.5 h-3.5 text-slate-400 transition-transform ${customerDropdownOpen ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>

            {customerDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-52 overflow-auto">
                {/* Walk-in option */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomerSearch("");
                    setCustomerDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-xs text-left hover:bg-slate-50 transition-colors ${
                    !selectedCustomer
                      ? "bg-indigo-50 text-indigo-700 font-medium"
                      : "text-slate-600"
                  }`}
                >
                  {i.pos.walkinCustomer}
                </button>

                {/* Filtered customer list */}
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(c);
                      setCustomerSearch("");
                      setCustomerDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-xs text-left hover:bg-slate-50 transition-colors capitalize ${
                      selectedCustomer?.id === c.id
                        ? "bg-indigo-50 text-indigo-700 font-medium"
                        : "text-slate-700"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-1.5">
                      <span className="truncate">{c.name}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {c.phone && (
                          <span className="text-slate-400">{c.phone}</span>
                        )}
                        {c.balance > 0 && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full tabular-nums">
                            {i.customers.owes}{" "}
                            {formatMoney(
                              c.balance,
                              merchant.currency,
                              merchant.numberFormat,
                              merchant.currencyFormat,
                              language,
                            )}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                ))}

                {filteredCustomers.length === 0 && customerSearch.trim() && (
                  <div className="px-3 py-2 text-xs text-slate-400">
                    {i.customers.noCustomersMatch}
                  </div>
                )}

                {/* Add new customer option */}
                <div className="border-t border-slate-100">
                  {!quickAddOpen ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuickAddOpen(true);
                        setQuickAddName(customerSearch.trim());
                      }}
                      className="w-full flex items-center gap-1.5 px-3 py-2.5 text-xs text-indigo-600 font-semibold hover:bg-indigo-50 transition-colors"
                    >
                      <IconPlus size={14} />
                      {i.pos.addNewCustomer}
                    </button>
                  ) : (
                    <div className="p-3 space-y-2">
                      <p className="text-xs font-semibold text-slate-700">
                        {i.pos.quickAddCustomer}
                      </p>
                      {quickAddError && (
                        <p
                          role="alert"
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700"
                        >
                          {quickAddError}
                        </p>
                      )}
                      <input
                        autoFocus
                        type="text"
                        value={quickAddName}
                        onChange={(e) => setQuickAddName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleQuickAddCustomer();
                          }
                          if (e.key === "Escape") setQuickAddOpen(false);
                        }}
                        placeholder={i.common.name}
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                      <input
                        type="text"
                        value={quickAddPhone}
                        onChange={(e) => setQuickAddPhone(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleQuickAddCustomer();
                          }
                          if (e.key === "Escape") setQuickAddOpen(false);
                        }}
                        placeholder={i.common.phone}
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setQuickAddOpen(false);
                            setQuickAddName("");
                            setQuickAddPhone("");
                            setQuickAddError(null);
                          }}
                          className="px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          {i.common.cancel}
                        </button>
                        <button
                          type="button"
                          onClick={handleQuickAddCustomer}
                          disabled={!quickAddName.trim() || isQuickAdding}
                          className="px-2.5 py-1 text-[11px] font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                          {isQuickAdding ? "..." : i.common.save}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cart items */}
        <div className="order-3 lg:order-0 flex-1 overflow-y-auto border-t border-slate-100 lg:border-t-0">
          {cart.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              <div className="text-center">
                <IconMoney size={40} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">{i.pos.cartEmpty}</p>
                <p className="text-xs mt-1 text-slate-300">
                  {i.pos.addProductsToStart}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {cart.map((item) => {
                const effectivePrice = item.unitPrice ?? item.product.price;
                let lineTotal = effectivePrice * item.quantity;
                let lineDiscountAmt = 0;
                if (item.discountType === "PERCENT") {
                  lineDiscountAmt = lineTotal * (item.discountValue / 100);
                } else if (item.discountType === "FIXED") {
                  lineDiscountAmt = item.discountValue;
                }
                lineDiscountAmt += item.discount;
                lineTotal = Math.max(0, lineTotal - lineDiscountAmt);
                const hasDiscount =
                  item.unitPrice !== null || item.discountValue > 0;

                return (
                  <div key={item.product.id}>
                    <div className="px-5 py-3.5 flex gap-3">
                      <button
                        type="button"
                        onClick={() => openLineEdit(item.product.id)}
                        className="flex-1 min-w-0 text-left cursor-pointer"
                        title={i.pos.editPriceDiscountLower}
                      >
                        <p className="text-sm font-semibold text-slate-800 capitalize truncate">
                          {getProductDisplayName(
                            item.product.name,
                            item.product.variantName,
                          )}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {item.unitPrice !== null ? (
                            <>
                              <span className="text-xs text-slate-400 line-through">
                                {formatMoney(
                                  item.product.price,
                                  merchant.currency,
                                  merchant.numberFormat,
                                  merchant.currencyFormat,
                                  language,
                                )}
                              </span>
                              <span className="text-xs text-indigo-600 font-semibold">
                                {formatMoney(
                                  item.unitPrice,
                                  merchant.currency,
                                  merchant.numberFormat,
                                  merchant.currencyFormat,
                                  language,
                                )}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">
                              {formatMoney(
                                item.product.price,
                                merchant.currency,
                                merchant.numberFormat,
                                merchant.currencyFormat,
                                language,
                              )}{" "}
                              {i.pos.each}
                            </span>
                          )}
                          {item.discountValue > 0 && (
                            <Badge
                              variant="success"
                              className="text-[10px] py-0 px-1.5"
                            >
                              {item.discountType === "PERCENT"
                                ? `-${formatNumber(item.discountValue, merchant.numberFormat)}%`
                                : `-${formatMoney(item.discountValue, merchant.currency, merchant.numberFormat, merchant.currencyFormat, language)}`}
                            </Badge>
                          )}
                        </div>
                      </button>

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
                        <span
                          className={`text-sm font-bold tabular-nums ${hasDiscount ? "text-emerald-600" : "text-slate-900"}`}
                        >
                          {formatMoney(
                            lineTotal,
                            merchant.currency,
                            merchant.numberFormat,
                            merchant.currencyFormat,
                            language,
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

                    {/* Inline line discount editor */}
                    {editingLineId === item.product.id && (
                      <div className="px-5 pb-3 space-y-2 bg-slate-50/80 border-t border-dashed border-slate-200">
                        <p className="text-xs font-semibold text-slate-500 pt-2">
                          {i.pos.editPriceDiscount}
                          {maxDiscount < 100 && (
                            <span className="text-amber-500 ml-1">
                              ({i.pos.max} {maxDiscount}%)
                            </span>
                          )}
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder={i.pos.customPrice}
                            value={linePriceInput}
                            onChange={(e) => setLinePriceInput(e.target.value)}
                            min="0"
                            step="0.01"
                            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                          />
                          <button
                            onClick={() => setLinePriceInput("")}
                            className="text-xs text-slate-400 hover:text-slate-600 px-2 cursor-pointer"
                            title={i.pos.reset}
                          >
                            {i.pos.reset}
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <select
                            value={lineDiscountType}
                            onChange={(e) =>
                              setLineDiscountType(
                                e.target.value as "PERCENT" | "FIXED",
                              )
                            }
                            className="rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                          >
                            <option value="PERCENT">%</option>
                            <option value="FIXED">{merchant.currency}</option>
                          </select>
                          <input
                            type="number"
                            placeholder={i.pos.discount}
                            value={lineDiscountInput}
                            onChange={(e) =>
                              setLineDiscountInput(e.target.value)
                            }
                            min="0"
                            max={
                              lineDiscountType === "PERCENT" ? "100" : undefined
                            }
                            step={lineDiscountType === "PERCENT" ? "1" : "0.01"}
                            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingLineId(null)}
                            className="flex-1 py-2 text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 active:scale-95 cursor-pointer"
                          >
                            {i.pos.cancel}
                          </button>
                          <button
                            onClick={applyLineDiscount}
                            className="flex-1 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 active:scale-95 cursor-pointer"
                          >
                            {i.pos.apply}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart totals & checkout */}
        <div className="order-2 lg:order-0 sticky bottom-(--bottom-nav) lg:bottom-0 z-10 border-t border-slate-200/80 bg-white p-5 lg:pb-5 space-y-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
          {/* Promo code input */}
          {cart.length > 0 && !promoApplied && (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <IconPromo
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder={i.pos.promoCode}
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value.toUpperCase());
                    setPromoError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && validatePromo()}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border-2 border-dashed border-slate-200 text-sm font-mono font-semibold text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <button
                onClick={validatePromo}
                disabled={!promoCode.trim() || promoLoading}
                className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-sm font-semibold hover:bg-indigo-100 active:scale-95 disabled:opacity-40 cursor-pointer transition-all"
              >
                {promoLoading ? "..." : i.pos.apply}
              </button>
            </div>
          )}
          {promoError && (
            <p className="text-xs text-red-500 font-medium">{promoError}</p>
          )}
          {promoApplied && (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2">
                <IconPromo size={16} className="text-emerald-600" />
                <span className="text-sm font-mono font-bold text-emerald-700">
                  {promoApplied.code}
                </span>
                <Badge variant="success" className="text-[10px]">
                  {promoApplied.type === "PERCENT"
                    ? `-${formatNumber(promoApplied.value, merchant.numberFormat)}%`
                    : `-${formatMoney(promoApplied.value, merchant.currency, merchant.numberFormat, merchant.currencyFormat, language)}`}
                </Badge>
              </div>
              <button
                onClick={removePromo}
                className="text-red-400 hover:text-red-600 p-1 cursor-pointer"
              >
                <IconX size={14} />
              </button>
            </div>
          )}

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>{i.pos.subtotal}</span>
              <span className="tabular-nums">
                {formatMoney(
                  subtotal,
                  merchant.currency,
                  merchant.numberFormat,
                  merchant.currencyFormat,
                  language,
                )}
              </span>
            </div>
            {promoDiscount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>
                  {i.pos.promo} ({promoApplied?.code})
                </span>
                <span className="tabular-nums font-semibold">
                  -
                  {formatMoney(
                    promoDiscount,
                    merchant.currency,
                    merchant.numberFormat,
                    merchant.currencyFormat,
                    language,
                  )}
                </span>
              </div>
            )}
            {merchant.taxRate > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>
                  {i.pos.tax} ({merchant.taxRate}%)
                </span>
                <span className="tabular-nums">
                  {formatMoney(
                    taxAmount,
                    merchant.currency,
                    merchant.numberFormat,
                    merchant.currencyFormat,
                    language,
                  )}
                </span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-100">
              <span>{i.pos.total}</span>
              <span className="tabular-nums">
                {formatMoney(
                  total,
                  merchant.currency,
                  merchant.numberFormat,
                  merchant.currencyFormat,
                  language,
                )}
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
                  <span>{i.pos[opt.labelKey]}</span>
                </button>
              );
            })}
          </div>

          <button
            disabled={cart.length === 0}
            onClick={() => setCheckoutOpen(true)}
            className="w-full flex items-center justify-between rounded-xl bg-indigo-600 pl-5 pr-3 py-3 text-white font-bold transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none select-none cursor-pointer shadow-sm shadow-indigo-600/20"
          >
            <span className="text-sm tracking-wide">{i.pos.charge}</span>
            <span className="flex items-center gap-2">
              <span className="bg-white/20 rounded-lg px-3 py-1 text-sm tabular-nums">
                {formatMoney(
                  total,
                  merchant.currency,
                  merchant.numberFormat,
                  merchant.currencyFormat,
                  language,
                )}
              </span>
              <kbd className="text-[10px] font-medium opacity-50">F9</kbd>
            </span>
          </button>
        </div>
      </div>

      {/* ─── Checkout Modal ─── */}
      <Modal
        open={checkoutOpen}
        onClose={() => {
          setCheckoutOpen(false);
          setCheckoutError(null);
        }}
        title={i.pos.completeSale}
        size="md"
      >
        <div className="space-y-5">
          {checkoutError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            >
              {checkoutError}
            </div>
          )}
          {/* Order summary */}
          <div className="bg-slate-50 rounded-2xl p-5 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">{i.pos.items}</span>
              <span className="font-semibold text-slate-800 tabular-nums">
                {cart.reduce((s, ci) => s + ci.quantity, 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{i.pos.subtotal}</span>
              <span className="font-semibold text-slate-800 tabular-nums">
                {formatMoney(
                  subtotal,
                  merchant.currency,
                  merchant.numberFormat,
                  merchant.currencyFormat,
                  language,
                )}
              </span>
            </div>
            {promoDiscount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>
                  {i.pos.promo} ({promoApplied?.code})
                </span>
                <span className="font-semibold tabular-nums">
                  -
                  {formatMoney(
                    promoDiscount,
                    merchant.currency,
                    merchant.numberFormat,
                    merchant.currencyFormat,
                    language,
                  )}
                </span>
              </div>
            )}
            {merchant.taxRate > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">
                  {i.pos.tax} ({merchant.taxRate}%)
                </span>
                <span className="font-semibold text-slate-800 tabular-nums">
                  {formatMoney(
                    taxAmount,
                    merchant.currency,
                    merchant.numberFormat,
                    merchant.currencyFormat,
                    language,
                  )}
                </span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2.5">
              <span className="text-slate-900">{i.pos.total}</span>
              <span className="text-slate-900 tabular-nums">
                {formatMoney(
                  total,
                  merchant.currency,
                  merchant.numberFormat,
                  merchant.currencyFormat,
                  language,
                )}
              </span>
            </div>
          </div>

          {/* Payment */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              {i.pos.paymentMethod}
            </label>
            <div className="grid grid-cols-4 gap-2.5">
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
                    <span>{i.pos[opt.labelKey]}</span>
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
                    {i.pos.change}{" "}
                    {formatMoney(
                      parseFloat(paidAmount) - total,
                      merchant.currency,
                      merchant.numberFormat,
                      merchant.currencyFormat,
                      language,
                    )}
                  </p>
                )}
              {parseFloat(paidAmount) > 0 && parseFloat(paidAmount) < total && (
                <p className="text-sm text-red-600 mt-1.5 font-semibold">
                  {i.pos.insufficient}{" "}
                  {formatMoney(
                    total - parseFloat(paidAmount),
                    merchant.currency,
                    merchant.numberFormat,
                    merchant.currencyFormat,
                    language,
                  )}{" "}
                  {i.pos.remaining}
                </p>
              )}
              {/* Quick amount buttons */}
              <div className="flex gap-2 mt-2.5">
                {[
                  total,
                  Math.ceil(total / 1000) * 1000,
                  Math.ceil(total / 5000) * 5000,
                ].map((amount, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPaidAmount(amount.toString())}
                    className="flex-1 py-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-600 hover:bg-slate-200 active:scale-95 transition-all tabular-nums cursor-pointer"
                  >
                    {formatMoney(
                      amount,
                      merchant.currency,
                      merchant.numberFormat,
                      merchant.currencyFormat,
                      language,
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ShamCash QR */}
          {paymentMethod === "MOBILE_MONEY" && (
            <div className="flex flex-col items-center gap-4 py-2">
              {merchant.shamcashId ? (
                <>
                  <p className="text-sm font-semibold text-slate-600">
                    {i.pos.shamcashScanToPay}
                  </p>
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
                    <QRCodeDisplay
                      value={merchant.shamcashId}
                      size={180}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">
                      {i.pos.shamcashAmountToPay}
                    </p>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">
                      {formatMoney(
                        total,
                        merchant.currency,
                        merchant.numberFormat,
                        merchant.currencyFormat,
                        language,
                      )}
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center space-y-2">
                  <p className="text-sm text-amber-600 bg-amber-50 px-4 py-3 rounded-xl border border-amber-100">
                    {i.pos.shamcashNotConfigured}
                  </p>
                  <a
                    href="/dashboard/settings"
                    className="inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700 underline decoration-indigo-300 hover:decoration-indigo-500 transition-colors"
                  >
                    {i.pos.shamcashGoToSettings} →
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              {i.pos.notesOptional}
            </label>
            <textarea
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              rows={2}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm text-slate-900 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none transition-all"
            />
          </div>

          {/* CREDIT: Pay Later info */}
          {paymentMethod === "CREDIT" && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-2">
              {!selectedCustomer ? (
                <p className="text-sm text-amber-700 font-medium">
                  {i.pos.creditRequiresCustomer}
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <IconClock size={18} className="text-amber-600" />
                    <p className="text-sm font-semibold text-amber-800">
                      {i.pos.creditPayLater}
                    </p>
                  </div>
                  <p className="text-xs text-amber-600">
                    {i.pos.creditAmount}:{" "}
                    <span className="font-bold text-amber-800 tabular-nums">
                      {formatMoney(
                        total,
                        merchant.currency,
                        merchant.numberFormat,
                        merchant.currencyFormat,
                        language,
                      )}
                    </span>
                    {" → "}
                    <span className="capitalize">{selectedCustomer.name}</span>
                  </p>
                </>
              )}
            </div>
          )}

          {/* Customer & Staff info */}
          <div className="flex gap-4 text-sm text-slate-500">
            <div>
              <span className="font-semibold">{i.pos.cashier}</span>{" "}
              {selectedStaff?.name || i.pos.notAssigned}
            </div>
            <div>
              <span className="font-semibold">{i.pos.customer}</span>{" "}
              {selectedCustomer?.name || i.pos.walkin}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setCheckoutOpen(false)}
            >
              {i.common.cancel}
            </Button>
            <Button
              className="flex-1"
              size="lg"
              loading={isProcessing}
              onClick={handleCheckout}
              disabled={
                (paymentMethod === "CASH" &&
                  parseFloat(paidAmount) > 0 &&
                  parseFloat(paidAmount) < total) ||
                (paymentMethod === "CREDIT" && !selectedCustomer)
              }
            >
              {i.pos.completeSale}
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
        title={i.pos.orderComplete}
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
                  merchant.currencyFormat,
                  language,
                )}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">
                {lastOrder.orderNumber}
              </p>
            </div>

            {lastOrder.paymentMethod === "CASH" && lastOrder.change > 0 && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl px-4 py-3 text-center">
                <p className="text-sm text-amber-800 font-bold tabular-nums">
                  {i.pos.change}{" "}
                  {formatMoney(
                    lastOrder.change,
                    merchant.currency,
                    merchant.numberFormat,
                    merchant.currencyFormat,
                    language,
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

              <p>
                {i.pos.order} {lastOrder.orderNumber}
              </p>
              <p>
                {i.pos.date}{" "}
                {formatDateTime(
                  lastOrder.date,
                  merchant.dateFormat,
                  merchant.numberFormat,
                )}
              </p>
              {lastOrder.staff && (
                <p>
                  {i.pos.cashier} {lastOrder.staff.name}
                </p>
              )}
              {lastOrder.customer && (
                <p>
                  {i.pos.customer} {lastOrder.customer.name}
                </p>
              )}
              <p>─────────────────</p>

              {lastOrder.items.map((item, idx) => {
                const effectivePrice = item.unitPrice ?? item.product.price;
                let lineTotal = effectivePrice * item.quantity;
                let lineDisc = 0;
                if (item.discountType === "PERCENT") {
                  lineDisc = lineTotal * (item.discountValue / 100);
                } else if (item.discountType === "FIXED") {
                  lineDisc = item.discountValue;
                }
                lineDisc += item.discount;
                lineTotal = Math.max(0, lineTotal - lineDisc);

                return (
                  <div key={idx}>
                    <div className="flex justify-between py-0.5">
                      <span className="truncate mr-2">
                        {item.quantity}x{" "}
                        {getProductDisplayName(
                          item.product.name,
                          item.product.variantName,
                        )}
                      </span>
                      <span className="whitespace-nowrap tabular-nums">
                        {formatMoney(
                          lineTotal,
                          merchant.currency,
                          merchant.numberFormat,
                          merchant.currencyFormat,
                          language,
                        )}
                      </span>
                    </div>
                    {(item.unitPrice !== null || item.discountValue > 0) && (
                      <div className="text-[10px] text-slate-400 pl-4">
                        {item.unitPrice !== null && (
                          <span>
                            <span className="line-through">
                              {formatMoney(
                                item.product.price,
                                merchant.currency,
                                merchant.numberFormat,
                                merchant.currencyFormat,
                                language,
                              )}
                            </span>
                            {" → "}
                            {formatMoney(
                              item.unitPrice,
                              merchant.currency,
                              merchant.numberFormat,
                              merchant.currencyFormat,
                              language,
                            )}
                          </span>
                        )}
                        {item.discountValue > 0 && (
                          <span>
                            {item.unitPrice !== null ? " · " : ""}
                            {i.pos.disc}{" "}
                            {item.discountType === "PERCENT"
                              ? `${item.discountValue}%`
                              : formatMoney(
                                  item.discountValue,
                                  merchant.currency,
                                  merchant.numberFormat,
                                  merchant.currencyFormat,
                                  language,
                                )}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <p className="mt-1">─────────────────</p>
              <div className="flex justify-between">
                <span>{i.pos.subtotal}</span>
                <span className="tabular-nums">
                  {formatMoney(
                    lastOrder.subtotal,
                    merchant.currency,
                    merchant.numberFormat,
                    merchant.currencyFormat,
                    language,
                  )}
                </span>
              </div>
              {lastOrder.promoDiscount > 0 && (
                <div className="flex justify-between">
                  <span>
                    {i.pos.promo} ({lastOrder.promoCode})
                  </span>
                  <span className="tabular-nums">
                    -
                    {formatMoney(
                      lastOrder.promoDiscount,
                      merchant.currency,
                      merchant.numberFormat,
                      merchant.currencyFormat,
                      language,
                    )}
                  </span>
                </div>
              )}
              {lastOrder.tax > 0 && (
                <div className="flex justify-between">
                  <span>{i.pos.tax}</span>
                  <span className="tabular-nums">
                    {formatMoney(
                      lastOrder.tax,
                      merchant.currency,
                      merchant.numberFormat,
                      merchant.currencyFormat,
                      language,
                    )}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm mt-1">
                <span>{i.pos.total}</span>
                <span className="tabular-nums">
                  {formatMoney(
                    lastOrder.total,
                    merchant.currency,
                    merchant.numberFormat,
                    merchant.currencyFormat,
                    language,
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span>
                  {i.pos.paid} (
                  {translatePaymentMethod(
                    lastOrder.paymentMethod,
                    language as Locale,
                  )}
                  )
                </span>
                <span className="tabular-nums">
                  {formatMoney(
                    lastOrder.paid,
                    merchant.currency,
                    merchant.numberFormat,
                    merchant.currencyFormat,
                    language,
                  )}
                </span>
              </div>
              {lastOrder.change > 0 && (
                <div className="flex justify-between">
                  <span>{i.pos.change}</span>
                  <span className="tabular-nums">
                    {formatMoney(
                      lastOrder.change,
                      merchant.currency,
                      merchant.numberFormat,
                      merchant.currencyFormat,
                      language,
                    )}
                  </span>
                </div>
              )}

              <div className="text-center mt-3">
                <p>─────────────────</p>
                <div className="flex justify-center mt-2">
                  <QRCodeDisplay value={lastOrder.orderNumber} size={80} />
                </div>
                <p className="mt-1">{i.pos.thankYou}</p>
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
                {i.pos.print}
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  setReceiptOpen(false);
                  setLastOrder(null);
                }}
              >
                {i.pos.newSale}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {scannerOpen && (
        <BarcodeScanner
          language={language}
          onScan={handleCameraScan}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
