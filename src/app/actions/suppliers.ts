"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "./_shared";
import { requireMerchant, requireStaffAction } from "./_shared";

const supplierSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(30).optional().default(""),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().max(500).optional().default(""),
  notes: z.string().max(1000).optional().default(""),
});

export async function createSupplier(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };
  const { error: sErr } = await requireStaffAction(
    "/api/merchant/suppliers",
    "POST",
  );
  if (sErr) return { error: sErr };

  const raw = Object.fromEntries(formData);
  const parsed = supplierSchema.safeParse(raw);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supplier = await prisma.supplier.create({
    data: {
      merchantId: merchant.id,
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
    },
  });

  await prisma.activityLog
    .create({
      data: {
        merchantId: merchant.id,
        action: "SUPPLIER_CREATED",
        entity: "supplier",
        entityId: supplier.id,
      },
    })
    .catch(() => {});

  revalidatePath("/dashboard/suppliers");
  return { success: true, data: supplier };
}

export async function updateSupplier(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };
  const { error: sErr } = await requireStaffAction(
    "/api/merchant/suppliers",
    "PUT",
  );
  if (sErr) return { error: sErr };

  const raw = Object.fromEntries(formData);
  const id = raw.id as string;
  if (!id) return { error: "Supplier ID required" };

  const parsed = supplierSchema.safeParse(raw);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const existing = await prisma.supplier.findFirst({
    where: { id, merchantId: merchant.id },
  });
  if (!existing) return { error: "Supplier not found" };

  const updated = await prisma.supplier.update({
    where: { id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
    },
  });

  revalidatePath("/dashboard/suppliers");
  return { success: true, data: updated };
}

export async function deleteSupplier(id: string): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };
  const { error: sErr } = await requireStaffAction(
    "/api/merchant/suppliers",
    "DELETE",
  );
  if (sErr) return { error: sErr };

  const existing = await prisma.supplier.findFirst({
    where: { id, merchantId: merchant.id },
  });
  if (!existing) return { error: "Supplier not found" };

  await prisma.supplier.delete({ where: { id } });

  revalidatePath("/dashboard/suppliers");
  return { success: true };
}
