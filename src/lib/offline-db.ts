import Dexie, { type Table } from "dexie";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface LocalProduct {
  id: string;
  merchantId: string;
  name: string;
  variantName: string | null;
  sku: string | null;
  barcode: string | null;
  price: number;
  costPrice: number;
  stock: number;
  lowStockAt: number;
  unit: string;
  trackStock: boolean;
  image: string | null;
  categoryId: string;
  categoryName: string | null;
  categoryColor: string | null;
  createdAt: number;
}

export interface LocalCategory {
  id: string;
  merchantId: string;
  name: string;
  color: string | null;
  sortOrder: number;
}

export interface LocalCustomer {
  id: string;
  merchantId: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  totalSpent: number;
  visitCount: number;
  createdAt: string | null;
}

export interface LocalStaff {
  id: string;
  merchantId: string;
  name: string;
  pin: string;
  role: string;
  isActive: boolean;
  maxDiscountPercent: number;
}

export interface LocalPromotion {
  id: string;
  merchantId: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  scope: "ORDER" | "PRODUCT" | "CATEGORY";
  scopeTargetId: string | null;
  minSubtotal: number;
  maxDiscount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  maxUses: number | null;
  usedCount: number;
  maxUsesPerCustomer: number | null;
  stackable: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface LocalSupplier {
  id: string;
  merchantId: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  _orderCount?: number;
}

export interface LocalOrderItem {
  productId: string;
  name: string;
  sku: string | null;
  price: number;
  costPrice: number;
  quantity: number;
  discount: number;
}

export interface LocalOrder {
  localId: string;
  merchantId: string;
  orderNumber: string;
  items: LocalOrderItem[];
  customerId: string | null;
  customerName?: string | null;
  staffId: string | null;
  staffName?: string | null;
  paymentMethod: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  status?: string;
  notes: string | null;
  createdAt: number;
  syncStatus: "pending" | "synced" | "failed";
  syncError: string | null;
  retryCount: number;
}

export interface LocalMeta {
  key: string;
  value: string;
  updatedAt: number;
}

export interface PendingMutation {
  id: string;
  merchantId: string;
  url: string;
  method: string;
  body: string;
  entity:
    | "product"
    | "category"
    | "staff"
    | "customer"
    | "supplier"
    | "settings"
    | "inventory"
    | "order";
  localEntityId: string | null;
  createdAt: number;
  syncStatus: "pending" | "synced" | "failed";
  syncError: string | null;
  retryCount: number;
}

// ─────────────────────────────────────────────
// Database
// ─────────────────────────────────────────────

class ShampayDB extends Dexie {
  products!: Table<LocalProduct, string>;
  categories!: Table<LocalCategory, string>;
  customers!: Table<LocalCustomer, string>;
  staff!: Table<LocalStaff, string>;
  suppliers!: Table<LocalSupplier, string>;
  promotions!: Table<LocalPromotion, string>;
  orders!: Table<LocalOrder, string>;
  mutations!: Table<PendingMutation, string>;
  meta!: Table<LocalMeta, string>;

  constructor() {
    super("shampay-pos");

    this.version(1).stores({
      products: "id, merchantId, barcode, categoryId, [merchantId+barcode]",
      categories: "id, merchantId, sortOrder",
      customers: "id, merchantId",
      staff: "id, merchantId",
      orders:
        "localId, merchantId, syncStatus, createdAt, [merchantId+syncStatus]",
      meta: "key",
    });

    this.version(2).stores({
      products: "id, merchantId, barcode, categoryId, [merchantId+barcode]",
      categories: "id, merchantId, sortOrder",
      customers: "id, merchantId",
      staff: "id, merchantId",
      suppliers: "id, merchantId",
      orders:
        "localId, merchantId, syncStatus, createdAt, [merchantId+syncStatus]",
      mutations:
        "id, merchantId, syncStatus, createdAt, [merchantId+syncStatus]",
      meta: "key",
    });

    this.version(3).stores({
      products: "id, merchantId, barcode, categoryId, [merchantId+barcode]",
      categories: "id, merchantId, sortOrder",
      customers: "id, merchantId",
      staff: "id, merchantId",
      suppliers: "id, merchantId",
      promotions: "id, merchantId, code, [merchantId+code]",
      orders:
        "localId, merchantId, syncStatus, createdAt, [merchantId+syncStatus]",
      mutations:
        "id, merchantId, syncStatus, createdAt, [merchantId+syncStatus]",
      meta: "key",
    });
  }
}

export const db = new ShampayDB();

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

export function generateLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateOrderNumber(): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `ORD-${date}-${rand}`;
}

// ─────────────────────────────────────────────
// Request persistent storage
// ─────────────────────────────────────────────

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  if (!navigator.storage?.persist) return false;

  try {
    const persisted = await navigator.storage.persisted();
    if (persisted) return true;
    return navigator.storage.persist();
  } catch {
    return false;
  }
}
