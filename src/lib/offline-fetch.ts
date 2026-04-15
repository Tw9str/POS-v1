import {
  db,
  generateLocalId,
  type PendingMutation,
  type LocalCategory,
  type LocalProduct,
  type LocalCustomer,
  type LocalStaff,
  type LocalSupplier,
  type LocalOrder,
} from "./offlineDb";

// ─────────────────────────────────────────────
// offlineFetch universal offline-aware fetch
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

      // Server returned an error · don't queue, return the error
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
      // Network error · fall through to offline path
    }
  }

  // Offline path: queue mutation + apply locally
  const localId = generateLocalId();

  if (entity === "settings") {
    await db.mutations
      .where("merchantId")
      .equals(merchantId)
      .filter((mutation) => mutation.entity === "settings")
      .delete();
  }

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
      const variantName =
        "variantName" in body
          ? (body.variantName as string | null | undefined)?.trim() || null
          : ((serverData.variantName as string | null | undefined) ??
            existing?.variantName ??
            null);

      const product: LocalProduct = {
        id,
        merchantId,
        name: (body.name as string) ?? existing?.name ?? "",
        variantName,
        sku: (body.sku as string) ?? existing?.sku ?? null,
        barcode: (body.barcode as string) ?? existing?.barcode ?? null,
        price: Number(body.price ?? existing?.price ?? 0),
        costPrice: Number(body.costPrice ?? existing?.costPrice ?? 0),
        stock: Number(body.stock ?? existing?.stock ?? 0),
        lowStockAt: Number(body.lowStockAt ?? existing?.lowStockAt ?? 5),
        unit: (body.unit as string) ?? existing?.unit ?? "piece",
        trackStock:
          (body.trackStock as boolean) ?? existing?.trackStock ?? true,
        image: existing?.image ?? null,
        categoryId: categoryId ?? "",
        categoryName: categoryId
          ? (category?.name ?? existing?.categoryName ?? null)
          : null,
        categoryColor: categoryId
          ? (category?.color ?? existing?.categoryColor ?? null)
          : null,
        createdAt: existing?.createdAt ?? Date.now(),
      };
      await db.products.put(product);
      return product as unknown as Record<string, unknown>;
    }

    case "category": {
      if (method === "DELETE") {
        // Prevent deleting the "Other" fallback category
        const catToDelete = await db.categories.get(id);
        if (catToDelete?.name === "Other") {
          throw new Error("The 'Other' category cannot be deleted");
        }

        // Find the "Other" fallback category
        const allCats = await db.categories
          .where("merchantId")
          .equals(merchantId)
          .toArray();
        const otherCat = allCats.find((c) => c.name === "Other" && c.id !== id);

        await db.categories.delete(id);

        if (otherCat) {
          await db.products.where("categoryId").equals(id).modify({
            categoryId: otherCat.id,
            categoryName: otherCat.name,
            categoryColor: otherCat.color,
          });
        }
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
        balance: existing?.balance ?? 0,
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
        maxDiscountPercent: Number(
          body.maxDiscountPercent ?? existing?.maxDiscountPercent ?? 100,
        ),
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

    case "inventory": {
      const productId = (body.productId as string) || id;
      const existing = await db.products.get(productId);

      if (!existing) {
        return { id: productId };
      }

      const quantityChange = Number(body.quantity ?? 0);
      const nextStock = Number(
        serverData.stock ?? existing.stock + quantityChange,
      );

      await db.products.update(productId, { stock: nextStock });
      return { id: productId, stock: nextStock };
    }

    case "order": {
      const orderId = (body.id as string) || (body.localId as string) || id;
      const existing = await db.orders.get(orderId);

      if (!existing) {
        return { id: orderId, status: body.action ?? serverData.status };
      }

      const action = body.action as string;
      const nextStatus =
        (serverData.status as string) ??
        (action === "REFUND"
          ? "REFUNDED"
          : action === "VOID"
            ? "VOIDED"
            : action === "PARTIAL_REFUND"
              ? "PARTIALLY_REFUNDED"
              : (existing.status ?? "COMPLETED"));

      if (
        (nextStatus === "REFUNDED" || nextStatus === "VOIDED") &&
        existing.status !== "REFUNDED" &&
        existing.status !== "VOIDED"
      ) {
        await db.transaction("rw", db.orders, db.products, async () => {
          const updatedOrder: LocalOrder = {
            ...existing,
            status: nextStatus,
          };
          await db.orders.put(updatedOrder);

          for (const item of existing.items) {
            const product = await db.products.get(item.productId);
            if (product?.trackStock) {
              await db.products.update(item.productId, {
                stock: product.stock + item.quantity,
              });
            }
          }
        });
      } else {
        await db.orders.update(orderId, {
          status: nextStatus,
          notes: [
            existing.notes,
            body.reason,
            action === "PARTIAL_REFUND" && body.amount
              ? `Partial refund amount: ${body.amount}`
              : null,
          ]
            .filter(Boolean)
            .join(" • "),
        });
      }

      return { id: orderId, status: nextStatus };
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
