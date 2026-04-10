import {
  db,
  generateLocalId,
  type PendingMutation,
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
        await applyToLocalDB(entity, merchantId, body, data);
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
  const localData = await applyToLocalDB(entity, merchantId, body, {
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
  body: Record<string, unknown>,
  serverData: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const id = (serverData.id as string) || generateLocalId();

  switch (entity) {
    case "product": {
      const product: LocalProduct = {
        id,
        merchantId,
        name: (body.name as string) || "",
        sku: (body.sku as string) || null,
        barcode: (body.barcode as string) || null,
        price: (body.price as number) || 0,
        costPrice: (body.costPrice as number) || 0,
        stock: (body.stock as number) || 0,
        trackStock: (body.trackStock as boolean) ?? true,
        image: null,
        categoryId: (body.categoryId as string) || null,
        categoryName: null,
        categoryColor: null,
      };
      await db.products.put(product);
      return product as unknown as Record<string, unknown>;
    }

    case "customer": {
      const customer: LocalCustomer = {
        id,
        merchantId,
        name: (body.name as string) || "",
        phone: (body.phone as string) || null,
        email: (body.email as string) || null,
        address: (body.address as string) || null,
        notes: (body.notes as string) || null,
        totalSpent: 0,
        visitCount: 0,
        createdAt: new Date().toISOString(),
      };
      await db.customers.put(customer);
      return customer as unknown as Record<string, unknown>;
    }

    case "staff": {
      const staff: LocalStaff = {
        id,
        merchantId,
        name: (body.name as string) || "",
        pin: (body.pin as string) || "",
        role: (body.role as string) || "CASHIER",
        isActive: true,
      };
      await db.staff.put(staff);
      return staff as unknown as Record<string, unknown>;
    }

    case "supplier": {
      const supplier: LocalSupplier = {
        id,
        merchantId,
        name: (body.name as string) || "",
        phone: (body.phone as string) || null,
        email: (body.email as string) || null,
        address: (body.address as string) || null,
        notes: (body.notes as string) || null,
        _orderCount: 0,
      };
      await db.suppliers.put(supplier);
      return supplier as unknown as Record<string, unknown>;
    }

    case "settings": {
      // Settings don't go into a separate table; store in meta
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
