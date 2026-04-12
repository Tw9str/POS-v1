import {
  db,
  generateLocalId,
  generateOrderNumber,
  requestPersistentStorage,
  type LocalProduct,
  type LocalCategory,
  type LocalCustomer,
  type LocalStaff,
  type LocalSupplier,
  type LocalPromotion,
  type LocalOrder,
  type LocalOrderItem,
} from "./offline-db";

// ─────────────────────────────────────────────
// Hydrate local DB from server data
// ─────────────────────────────────────────────

export async function hydrateProducts(
  merchantId: string,
  products: LocalProduct[],
): Promise<void> {
  await db.transaction("rw", db.products, async () => {
    await db.products.where("merchantId").equals(merchantId).delete();
    await db.products.bulkPut(products);
  });
  await setMeta("lastProductSync", merchantId);
}

export async function hydrateCategories(
  merchantId: string,
  categories: LocalCategory[],
): Promise<void> {
  await db.transaction("rw", db.categories, async () => {
    await db.categories.where("merchantId").equals(merchantId).delete();
    await db.categories.bulkPut(categories);
  });
}

export async function hydrateCustomers(
  merchantId: string,
  customers: LocalCustomer[],
): Promise<void> {
  await db.transaction("rw", db.customers, async () => {
    await db.customers.where("merchantId").equals(merchantId).delete();
    await db.customers.bulkPut(customers);
  });
}

export async function hydrateStaff(
  merchantId: string,
  staff: LocalStaff[],
): Promise<void> {
  await db.transaction("rw", db.staff, async () => {
    await db.staff.where("merchantId").equals(merchantId).delete();
    await db.staff.bulkPut(staff);
  });
}

export async function hydrateSuppliers(
  merchantId: string,
  suppliers: LocalSupplier[],
): Promise<void> {
  await db.transaction("rw", db.suppliers, async () => {
    await db.suppliers.where("merchantId").equals(merchantId).delete();
    await db.suppliers.bulkPut(suppliers);
  });
}

export async function hydratePromotions(
  merchantId: string,
  promotions: LocalPromotion[],
): Promise<void> {
  await db.transaction("rw", db.promotions, async () => {
    await db.promotions.where("merchantId").equals(merchantId).delete();
    await db.promotions.bulkPut(promotions);
  });
}

/** Hydrate orders from server - merge with local pending orders */
export async function hydrateOrders(
  merchantId: string,
  serverOrders: Record<string, unknown>[],
): Promise<void> {
  await db.transaction("rw", db.orders, async () => {
    // Keep local pending/failed orders, replace synced ones
    await db.orders.where({ merchantId, syncStatus: "synced" }).delete();

    const orders: LocalOrder[] = serverOrders.map((o) => ({
      localId: (o.localId as string) || (o.id as string),
      merchantId,
      orderNumber: o.orderNumber as string,
      items: ((o.items as Record<string, unknown>[]) ?? []).map((i) => ({
        productId: i.productId as string,
        name: i.name as string,
        sku: (i.sku as string) ?? null,
        price: i.price as number,
        costPrice: i.costPrice as number,
        quantity: i.quantity as number,
        discount: (i.discount as number) ?? 0,
      })),
      customerId: (o.customerId as string) ?? null,
      customerName:
        ((o.customer as Record<string, unknown>)?.name as string) ?? null,
      staffId: (o.staffId as string) ?? null,
      staffName: ((o.staff as Record<string, unknown>)?.name as string) ?? null,
      paymentMethod: o.paymentMethod as string,
      subtotal: o.subtotal as number,
      taxAmount: o.taxAmount as number,
      total: o.total as number,
      paidAmount: o.paidAmount as number,
      changeAmount: o.changeAmount as number,
      status: (o.status as string) ?? "COMPLETED",
      notes: (o.notes as string) ?? null,
      createdAt: new Date(o.createdAt as string).getTime(),
      syncStatus: "synced" as const,
      syncError: null,
      retryCount: 0,
    }));

    if (orders.length > 0) {
      await db.orders.bulkPut(orders);
    }
  });
}

/** Hydrate all data at once (called when dashboard loads while online) */
export async function hydrateAll(
  merchantId: string,
  data: {
    products: LocalProduct[];
    categories: LocalCategory[];
    customers: LocalCustomer[];
    staff: LocalStaff[];
    suppliers?: LocalSupplier[];
  },
): Promise<void> {
  const tasks = [
    hydrateProducts(merchantId, data.products),
    hydrateCategories(merchantId, data.categories),
    hydrateCustomers(merchantId, data.customers),
    hydrateStaff(merchantId, data.staff),
  ];
  if (data.suppliers) {
    tasks.push(hydrateSuppliers(merchantId, data.suppliers));
  }
  await Promise.all(tasks);
  await requestPersistentStorage();
}

// ─────────────────────────────────────────────
// Read from local DB
// ─────────────────────────────────────────────

export async function getLocalProducts(
  merchantId: string,
): Promise<LocalProduct[]> {
  return db.products.where("merchantId").equals(merchantId).toArray();
}

export async function getLocalCategories(
  merchantId: string,
): Promise<LocalCategory[]> {
  return db.categories
    .where("merchantId")
    .equals(merchantId)
    .sortBy("sortOrder");
}

export async function getLocalCustomers(
  merchantId: string,
): Promise<LocalCustomer[]> {
  return db.customers.where("merchantId").equals(merchantId).toArray();
}

export async function getLocalStaff(merchantId: string): Promise<LocalStaff[]> {
  return db.staff.where("merchantId").equals(merchantId).toArray();
}

export async function getLocalSuppliers(
  merchantId: string,
): Promise<LocalSupplier[]> {
  return db.suppliers.where("merchantId").equals(merchantId).toArray();
}

export async function findProductByBarcode(
  merchantId: string,
  barcode: string,
): Promise<LocalProduct | undefined> {
  return db.products.get({ merchantId, barcode });
}

// ─────────────────────────────────────────────
// Offline orders
// ─────────────────────────────────────────────

export interface CreateOfflineOrderInput {
  merchantId: string;
  items: LocalOrderItem[];
  customerId: string | null;
  staffId: string | null;
  paymentMethod: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  notes: string | null;
}

interface SaveLocalOrderInput extends CreateOfflineOrderInput {
  orderNumber: string;
  localId?: string;
  customerName?: string | null;
  staffName?: string | null;
  status?: string;
  createdAt?: number;
  syncStatus?: "pending" | "synced" | "failed";
  syncError?: string | null;
  retryCount?: number;
}

export async function saveOrderLocally(
  input: SaveLocalOrderInput,
): Promise<LocalOrder> {
  const localId = input.localId ?? generateLocalId();
  const changeAmount = Math.max(0, input.paidAmount - input.total);

  const order: LocalOrder = {
    localId,
    merchantId: input.merchantId,
    orderNumber: input.orderNumber,
    items: input.items,
    customerId: input.customerId,
    customerName: input.customerName ?? null,
    staffId: input.staffId,
    staffName: input.staffName ?? null,
    paymentMethod: input.paymentMethod,
    subtotal: input.subtotal,
    taxAmount: input.taxAmount,
    total: input.total,
    paidAmount: input.paidAmount,
    changeAmount,
    status: input.status ?? "COMPLETED",
    notes: input.notes,
    createdAt: input.createdAt ?? Date.now(),
    syncStatus: input.syncStatus ?? "synced",
    syncError: input.syncError ?? null,
    retryCount: input.retryCount ?? 0,
  };

  await db.orders.put(order);

  await db.transaction("rw", db.products, async () => {
    for (const item of input.items) {
      const product = await db.products.get(item.productId);
      if (product && product.trackStock) {
        await db.products.update(item.productId, {
          stock: Math.max(0, product.stock - item.quantity),
        });
      }
    }
  });

  return order;
}

export async function createOfflineOrder(
  input: CreateOfflineOrderInput,
): Promise<LocalOrder> {
  return saveOrderLocally({
    ...input,
    localId: generateLocalId(),
    orderNumber: generateOrderNumber(),
    status: "COMPLETED",
    syncStatus: "pending",
    syncError: null,
    retryCount: 0,
  });
}

export async function getPendingOrders(
  merchantId: string,
): Promise<LocalOrder[]> {
  return db.orders.where({ merchantId, syncStatus: "pending" }).toArray();
}

export async function getFailedOrders(
  merchantId: string,
): Promise<LocalOrder[]> {
  return db.orders.where({ merchantId, syncStatus: "failed" }).toArray();
}

export async function getPendingOrderCount(
  merchantId: string,
): Promise<number> {
  return db.orders.where({ merchantId, syncStatus: "pending" }).count();
}

export async function getLocalOrders(
  merchantId: string,
): Promise<LocalOrder[]> {
  return db.orders.where({ merchantId }).reverse().sortBy("createdAt");
}

// ─────────────────────────────────────────────
// Sync engine
// ─────────────────────────────────────────────

export interface SyncResult {
  synced: number;
  failed: number;
  total: number;
}

export async function syncOrders(merchantId: string): Promise<SyncResult> {
  const pending = await db.orders
    .where({ merchantId, syncStatus: "pending" })
    .toArray();

  const failed = await db.orders
    .where({ merchantId, syncStatus: "failed" })
    .filter((o) => o.retryCount < 10)
    .toArray();

  const toSync = [...pending, ...failed];

  let synced = 0;
  let failedCount = 0;

  for (const order of toSync) {
    try {
      const res = await fetch("/api/merchant/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localId: order.localId,
          items: order.items,
          customerId: order.customerId,
          staffId: order.staffId,
          paymentMethod: order.paymentMethod,
          paidAmount: order.paidAmount,
          notes: order.notes,
          subtotal: order.subtotal,
          taxAmount: order.taxAmount,
          total: order.total,
        }),
      });

      if (res.ok) {
        await db.orders.update(order.localId, {
          syncStatus: "synced",
          syncError: null,
        });
        synced++;
      } else if (res.status === 409) {
        // Already exists (duplicate localId) · mark as synced
        await db.orders.update(order.localId, {
          syncStatus: "synced",
          syncError: null,
        });
        synced++;
      } else {
        const data = await res.json().catch(() => ({ error: "Unknown" }));
        await db.orders.update(order.localId, {
          syncStatus: "failed",
          syncError: data.error || `HTTP ${res.status}`,
          retryCount: order.retryCount + 1,
        });
        failedCount++;
      }
    } catch {
      await db.orders.update(order.localId, {
        syncStatus: "failed",
        syncError: "Network error",
        retryCount: order.retryCount + 1,
      });
      failedCount++;
    }
  }

  return { synced, failed: failedCount, total: toSync.length };
}

/** Pull fresh data from server into local DB */
export async function pullData(merchantId: string): Promise<boolean> {
  try {
    const [
      productsRes,
      categoriesRes,
      customersRes,
      staffRes,
      suppliersRes,
      ordersRes,
      promosRes,
    ] = await Promise.all([
      fetch("/api/merchant/products"),
      fetch("/api/merchant/categories"),
      fetch("/api/merchant/customers"),
      fetch("/api/merchant/staff"),
      fetch("/api/merchant/suppliers"),
      fetch("/api/merchant/orders"),
      fetch("/api/merchant/promotions"),
    ]);

    if (categoriesRes.ok) {
      const categories = await categoriesRes.json();
      await hydrateCategories(
        merchantId,
        categories.map((c: Record<string, unknown>) => ({
          id: c.id as string,
          merchantId,
          name: (c.name as string) ?? "",
          color: (c.color as string) ?? null,
          sortOrder: Number(c.sortOrder ?? 0),
        })),
      );
    }

    if (productsRes.ok) {
      const products = await productsRes.json();
      await hydrateProducts(
        merchantId,
        products.map((p: Record<string, unknown>) => ({
          id: p.id,
          merchantId,
          name: p.name,
          variantName: (p.variantName as string) ?? null,
          sku: p.sku ?? null,
          barcode: p.barcode ?? null,
          price: p.price,
          costPrice: p.costPrice,
          stock: p.stock,
          lowStockAt: p.lowStockAt ?? 5,
          unit: (p.unit as string) ?? "piece",
          trackStock: p.trackStock,
          image: p.image ?? null,
          categoryId: p.categoryId ?? null,
          categoryName: (p.category as Record<string, unknown>)?.name ?? null,
          categoryColor: (p.category as Record<string, unknown>)?.color ?? null,
          createdAt: new Date(p.createdAt as string).getTime(),
        })),
      );
    }

    if (customersRes.ok) {
      const customers = await customersRes.json();
      await hydrateCustomers(
        merchantId,
        customers.map((c: Record<string, unknown>) => ({
          ...c,
          merchantId,
        })),
      );
    }

    if (staffRes.ok) {
      const staff = await staffRes.json();
      await hydrateStaff(
        merchantId,
        staff.map((s: Record<string, unknown>) => ({
          ...s,
          merchantId,
        })),
      );
    }

    if (suppliersRes.ok) {
      const suppliers = await suppliersRes.json();
      await hydrateSuppliers(
        merchantId,
        suppliers.map((s: Record<string, unknown>) => ({
          ...s,
          merchantId,
        })),
      );
    }

    if (ordersRes.ok) {
      const orders = await ordersRes.json();
      await hydrateOrders(merchantId, orders);
    }

    if (promosRes.ok) {
      const promos = await promosRes.json();
      await hydratePromotions(
        merchantId,
        promos.map((p: Record<string, unknown>) => ({
          ...p,
          merchantId,
        })),
      );
    }

    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// Mutation sync (products, staff, customers, suppliers, settings)
// ─────────────────────────────────────────────

export async function syncMutations(merchantId: string): Promise<SyncResult> {
  const pending = await db.mutations
    .where({ merchantId, syncStatus: "pending" })
    .sortBy("createdAt");

  const failed = await db.mutations
    .where({ merchantId, syncStatus: "failed" })
    .filter((m) => m.retryCount < 10)
    .toArray();

  const toSync = [...pending, ...failed];

  let synced = 0;
  let failedCount = 0;

  for (const mutation of toSync) {
    try {
      const res = await fetch(mutation.url, {
        method: mutation.method,
        headers: { "Content-Type": "application/json" },
        body: mutation.body,
      });

      if (res.ok) {
        await db.mutations.update(mutation.id, {
          syncStatus: "synced",
          syncError: null,
        });
        synced++;
      } else {
        const data = await res.json().catch(() => ({ error: "Unknown" }));
        await db.mutations.update(mutation.id, {
          syncStatus: "failed",
          syncError:
            (data as Record<string, string>).error || `HTTP ${res.status}`,
          retryCount: mutation.retryCount + 1,
        });
        failedCount++;
      }
    } catch {
      await db.mutations.update(mutation.id, {
        syncStatus: "failed",
        syncError: "Network error",
        retryCount: mutation.retryCount + 1,
      });
      failedCount++;
    }
  }

  return { synced, failed: failedCount, total: toSync.length };
}

/** Full sync cycle: push orders + mutations, then pull fresh data */
export async function fullSync(merchantId: string): Promise<SyncResult> {
  const orderResult = await syncOrders(merchantId);
  const mutationResult = await syncMutations(merchantId);

  if (navigator.onLine) {
    await pullData(merchantId);
  }

  return {
    synced: orderResult.synced + mutationResult.synced,
    failed: orderResult.failed + mutationResult.failed,
    total: orderResult.total + mutationResult.total,
  };
}

// ─────────────────────────────────────────────
// Background sync interval
// ─────────────────────────────────────────────

let syncInterval: ReturnType<typeof setInterval> | null = null;
let syncListeners: Array<(result: SyncResult) => void> = [];

export function onSyncResult(
  listener: (result: SyncResult) => void,
): () => void {
  syncListeners.push(listener);
  return () => {
    syncListeners = syncListeners.filter((l) => l !== listener);
  };
}

export function startBackgroundSync(
  merchantId: string,
  intervalMs = 30_000,
): void {
  stopBackgroundSync();

  const doSync = async () => {
    if (!navigator.onLine) return;
    const orderCount = await getPendingOrderCount(merchantId);
    const mutationCount = await db.mutations
      .where({ merchantId, syncStatus: "pending" })
      .count();
    if (orderCount === 0 && mutationCount === 0) return;

    const result = await fullSync(merchantId);
    syncListeners.forEach((l) => l(result));
  };

  // Sync immediately on coming online
  window.addEventListener("online", doSync);

  syncInterval = setInterval(doSync, intervalMs);

  // Store cleanup ref
  (window as unknown as Record<string, unknown>).__shampayOnlineHandler =
    doSync;
}

export function stopBackgroundSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }

  const handler = (window as unknown as Record<string, unknown>)
    .__shampayOnlineHandler;
  if (typeof handler === "function") {
    window.removeEventListener("online", handler as EventListener);
    delete (window as unknown as Record<string, unknown>)
      .__shampayOnlineHandler;
  }
}

// ─────────────────────────────────────────────
// Meta helpers
// ─────────────────────────────────────────────

async function setMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value, updatedAt: Date.now() });
}

export async function getLastSyncTime(
  merchantId: string,
): Promise<number | null> {
  const meta = await db.meta.get(`lastProductSync`);
  if (!meta || meta.value !== merchantId) return null;
  return meta.updatedAt;
}

export async function hasLocalData(merchantId: string): Promise<boolean> {
  const count = await db.products
    .where("merchantId")
    .equals(merchantId)
    .count();
  return count > 0;
}
