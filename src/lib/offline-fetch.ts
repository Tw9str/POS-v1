import {
  db,
  generateLocalId,
  type PendingMutation,
  type LocalCategory,
  type LocalProduct,
  type LocalCustomer,
  type LocalStaff,
  type LocalSupplier,
} from "./offline-db";

// ─────────────────────────────────────────────
// offlineFetch — universal offline-aware fetch
// ─────────────────────────────────────────────

interface OfflineFetchOptions {
  url: string;
  method: string;
  body: Record<string, unknown>;
  /** Which entity table this mutation affects */
  entity: PendingMutation["entity"];
  /** merchantId for scoping */
  merchantId: string;
}

interface OfflineFetchResult {
  ok: boolean;
  data: Record<string, unknown> | null;
  offline: boolean;
  error: string | null;
}

/**
 * Try to send to server. If offline or server unreachable,
 * queue the mutation and apply optimistically to local DB.
 * Returns { ok, data, offline, error }.
 */
export async function offlineFetch(
  opts: OfflineFetchOptions,
): Promise<OfflineFetchResult> {
  const { url, method, body, entity, merchantId } = opts;

  // Try server first if online
  if (navigator.onLine) {
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        // Also update local DB with server response
        await applyToLocalDB(entity, merchantId, method, body, data);
        return { ok: true, data, offline: false, error: null };
      }

      // Server returned an error — don't queue, return the error
      const errorData = await res
        .json()
        .catch(() => ({ error: "Server error" }));
      return {
        ok: false,
        data: null,
        offline: false,
        error:
          (errorData as Record<string, string>).error || `HTTP ${res.status}`,
      };
    } catch {
      // Network error — fall through to offline path
    }
  }

  // Offline path: queue mutation + apply locally
  const localId = generateLocalId();

  const mutation: PendingMutation = {
    id: localId,
    merchantId,
    url,
    method,
    body: JSON.stringify(body),
    entity,
    localEntityId: localId,
    createdAt: Date.now(),
    syncStatus: "pending",
    syncError: null,
    retryCount: 0,
  };

  await db.mutations.put(mutation);

  // Apply optimistically to local DB
  const localData = await applyToLocalDB(entity, merchantId, method, body, {
    id: localId,
  });

  return {
    ok: true,
    data: localData,
    offline: true,
    error: null,
  };
}

// ─────────────────────────────────────────────
// Apply mutation to local IndexedDB
// ─────────────────────────────────────────────

async function applyToLocalDB(
  entity: PendingMutation["entity"],
  merchantId: string,
  method: string,
  body: Record<string, unknown>,
  serverData: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const id =
    (body.id as string) || (serverData.id as string) || generateLocalId();

  switch (entity) {
    case "product": {
      if (method === "DELETE") {
        await db.products.delete(id);
        return { id };
      }

      const existing = await db.products.get(id);
      const categoryId = (body.categoryId as string) || null;
      const category = categoryId ? await db.categories.get(categoryId) : null;

      const product: LocalProduct = {
        id,
        merchantId,
        name: (body.name as string) ?? existing?.name ?? "",
        sku: (body.sku as string) ?? existing?.sku ?? null,
        barcode: (body.barcode as string) ?? existing?.barcode ?? null,
        price: Number(body.price ?? existing?.price ?? 0),
        costPrice: Number(body.costPrice ?? existing?.costPrice ?? 0),
        stock: Number(body.stock ?? existing?.stock ?? 0),
        lowStockAt: Number(body.lowStockAt ?? existing?.lowStockAt ?? 5),
        unit: (body.unit as string) ?? existing?.unit ?? "piece",
        trackStock: (body.trackStock as boolean) ?? existing?.trackStock ?? true,
        image: existing?.image ?? null,
        categoryId,
        categoryName: categoryId ? (category?.name ?? existing?.categoryName ?? null) : null,
        categoryColor: categoryId ? (category?.color ?? existing?.categoryColor ?? null) : null,
      };
      await db.products.put(product);
      return product as unknown as Record<string, unknown>;
    }

    case "category": {
      if (method === "DELETE") {
        await db.categories.delete(id);
        await db.products
          .where("categoryId")
          .equals(id)
          .modify({ categoryId: null, categoryName: null, categoryColor: null });
        return { id };
      }

      const existing = await db.categories.get(id);
      const category: LocalCategory = {
        id,
        merchantId,
        name: (body.name as string) ?? existing?.name ?? "",
        color: (body.color as string) ?? existing?.color ?? null,
        sortOrder: Number(body.sortOrder ?? existing?.sortOrder ?? 0),
      };
      await db.categories.put(category);
      await db.products
        .where("categoryId")
        .equals(id)
        .modify({ categoryName: category.name, categoryColor: category.color });
      return category as unknown as Record<string, unknown>;
    }

    case "customer": {
      if (method === "DELETE") {
        await db.customers.delete(id);
        return { id };
      }

      const existing = await db.customers.get(id);
      const customer: LocalCustomer = {
        id,
        merchantId,
        name: (body.name as string) ?? existing?.name ?? "",
        phone: (body.phone as string) ?? existing?.phone ?? null,
        email: (body.email as string) ?? existing?.email ?? null,
        address: (body.address as string) ?? existing?.address ?? null,
        notes: (body.notes as string) ?? existing?.notes ?? null,
        totalSpent: existing?.totalSpent ?? 0,
        visitCount: existing?.visitCount ?? 0,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
      await db.customers.put(customer);
      return customer as unknown as Record<string, unknown>;
    }

    case "staff": {
      if (method === "DELETE") {
        await db.staff.delete(id);
        return { id };
      }

      const existing = await db.staff.get(id);
      const staff: LocalStaff = {
        id,
        merchantId,
        name: (body.name as string) ?? existing?.name ?? "",
        pin: (body.pin as string) ?? existing?.pin ?? "",
        role: (body.role as string) ?? existing?.role ?? "CASHIER",
        isActive: (body.isActive as boolean) ?? existing?.isActive ?? true,
      };
      await db.staff.put(staff);
      return staff as unknown as Record<string, unknown>;
    }

    case "supplier": {
      if (method === "DELETE") {
        await db.suppliers.delete(id);
        return { id };
      }

      const existing = await db.suppliers.get(id);
      const supplier: LocalSupplier = {
        id,
        merchantId,
        name: (body.name as string) ?? existing?.name ?? "",
        phone: (body.phone as string) ?? existing?.phone ?? null,
        email: (body.email as string) ?? existing?.email ?? null,
        address: (body.address as string) ?? existing?.address ?? null,
        notes: (body.notes as string) ?? existing?.notes ?? null,
        _orderCount: existing?._orderCount ?? 0,
      };
      await db.suppliers.put(supplier);
      return supplier as unknown as Record<string, unknown>;
    }

    case "settings": {
      await db.meta.put({
        key: "merchantSettings",
        value: JSON.stringify({ ...body, id: merchantId }),
        updatedAt: Date.now(),
      });
      return { id: merchantId, ...body };
    }

    default:
      return serverData;
  }
}

// ─────────────────────────────────────────────
// Count pending mutations
// ─────────────────────────────────────────────

export async function getPendingMutationCount(
  merchantId: string,
): Promise<number> {
  return db.mutations.where({ merchantId, syncStatus: "pending" }).count();
}
