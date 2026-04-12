"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline-db";
import type {
  LocalProduct,
  LocalCategory,
  LocalCustomer,
  LocalStaff,
  LocalSupplier,
  LocalPromotion,
  LocalOrder,
} from "@/lib/offline-db";

// ─────────────────────────────────────────────
// Individual entity hooks · read from IndexedDB
// ─────────────────────────────────────────────

export function useLocalProducts(merchantId: string): LocalProduct[] {
  return (
    useLiveQuery(
      () => db.products.where("merchantId").equals(merchantId).toArray(),
      [merchantId],
    ) ?? []
  );
}

export function useLocalCategories(merchantId: string): LocalCategory[] {
  return (
    useLiveQuery(
      () =>
        db.categories
          .where("merchantId")
          .equals(merchantId)
          .sortBy("sortOrder"),
      [merchantId],
    ) ?? []
  );
}

export function useLocalCustomers(merchantId: string): LocalCustomer[] {
  return (
    useLiveQuery(
      () => db.customers.where("merchantId").equals(merchantId).toArray(),
      [merchantId],
    ) ?? []
  );
}

export function useLocalStaff(merchantId: string): LocalStaff[] {
  return (
    useLiveQuery(
      () => db.staff.where("merchantId").equals(merchantId).toArray(),
      [merchantId],
    ) ?? []
  );
}

export function useLocalSuppliers(merchantId: string): LocalSupplier[] {
  return (
    useLiveQuery(
      () => db.suppliers.where("merchantId").equals(merchantId).toArray(),
      [merchantId],
    ) ?? []
  );
}

export function useLocalPromotions(merchantId: string): LocalPromotion[] {
  return (
    useLiveQuery(
      () => db.promotions.where("merchantId").equals(merchantId).toArray(),
      [merchantId],
    ) ?? []
  );
}

export function useLocalOrders(merchantId: string, limit = 100): LocalOrder[] {
  return (
    useLiveQuery(
      () =>
        db.orders
          .where("merchantId")
          .equals(merchantId)
          .reverse()
          .sortBy("createdAt")
          .then((orders) => orders.slice(0, limit)),
      [merchantId, limit],
    ) ?? []
  );
}
