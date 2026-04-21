"use server";

import { prisma } from "@/lib/db";
import { hashPin, verifyPin } from "@/lib/pinHash";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "./_shared";
import {
  requireMerchant,
  requireMerchantWithLicense,
  requireStaffAction,
} from "./_shared";

const staffSchema = z.object({
  name: z.string().min(1).max(100),
  pin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
  role: z.string().min(1).max(50),
  allowedPages: z.array(z.string()).default([]),
});

export async function createStaff(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { error: mErr, merchant, license } = await requireMerchantWithLicense();
  if (mErr) return { error: mErr };
  const { error: sErr } = await requireStaffAction(
    "/api/merchant/staff",
    "POST",
  );
  if (sErr) return { error: sErr };

  if (license?.maxStaff) {
    const activeCount = await prisma.staff.count({
      where: { merchantId: merchant.id, isActive: true },
    });
    if (activeCount >= license.maxStaff) {
      return {
        error: `Staff limit reached (${license.maxStaff}). Upgrade your plan to add more staff.`,
      };
    }
  }

  const raw = Object.fromEntries(formData);
  const allowedPages = formData.getAll("allowedPages").map(String);
  const parsed = staffSchema.safeParse({ ...raw, allowedPages });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  if (parsed.data.role.toUpperCase() === "OWNER") {
    return { error: "Cannot create an Owner staff member." };
  }

  const existingStaff = await prisma.staff.findMany({
    where: { merchantId: merchant.id, isActive: true },
    select: { pin: true },
  });
  for (const s of existingStaff) {
    if (await verifyPin(parsed.data.pin, s.pin)) {
      return { error: "This PIN is already in use" };
    }
  }

  const hashedPin = await hashPin(parsed.data.pin);
  const staff = await prisma.staff.create({
    data: {
      merchantId: merchant.id,
      name: parsed.data.name,
      pin: hashedPin,
      role: parsed.data.role,
      allowedPages: parsed.data.allowedPages,
      isOwner: false,
    },
  });

  await prisma.activityLog
    .create({
      data: {
        merchantId: merchant.id,
        action: "STAFF_CREATED",
        entity: "staff",
        entityId: staff.id,
      },
    })
    .catch(() => {});

  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/pos");
  return { success: true, data: staff };
}

export async function updateStaff(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };
  const { error: sErr } = await requireStaffAction(
    "/api/merchant/staff",
    "PUT",
  );
  if (sErr) return { error: sErr };

  const raw = Object.fromEntries(formData);
  const id = raw.id as string;
  if (!id) return { error: "Staff ID required" };

  const allowedPages = formData.getAll("allowedPages").map(String);
  const isActive =
    raw.isActive !== undefined ? raw.isActive === "true" : undefined;
  const pin = (raw.pin as string) || undefined;
  const name = (raw.name as string) || undefined;
  const role = (raw.role as string) || undefined;

  const existing = await prisma.staff.findFirst({
    where: { id, merchantId: merchant.id },
  });
  if (!existing) return { error: "Staff not found" };

  if (existing.isOwner) {
    if (role && role.toUpperCase() !== "OWNER")
      return { error: "Cannot change the Owner's role." };
    if (isActive === false) return { error: "Cannot deactivate the Owner." };
  }
  if (!existing.isOwner && role?.toUpperCase() === "OWNER") {
    return { error: "Cannot promote staff to Owner." };
  }

  if (pin) {
    const otherStaff = await prisma.staff.findMany({
      where: { merchantId: merchant.id, isActive: true, id: { not: id } },
      select: { pin: true },
    });
    for (const s of otherStaff) {
      if (await verifyPin(pin, s.pin))
        return { error: "This PIN is already in use" };
    }
  }

  const hashedPin = pin ? await hashPin(pin) : undefined;
  await prisma.staff.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(hashedPin !== undefined && { pin: hashedPin }),
      ...(role !== undefined && !existing.isOwner && { role }),
      ...(isActive !== undefined && { isActive }),
      ...(allowedPages.length > 0 && !existing.isOwner && { allowedPages }),
    },
  });

  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/pos");
  return { success: true };
}

export async function toggleStaffActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };
  const { error: sErr } = await requireStaffAction(
    "/api/merchant/staff",
    "PUT",
  );
  if (sErr) return { error: sErr };

  const existing = await prisma.staff.findFirst({
    where: { id, merchantId: merchant.id },
  });
  if (!existing) return { error: "Staff not found" };
  if (existing.isOwner && !isActive)
    return { error: "Cannot deactivate the Owner." };

  await prisma.staff.update({ where: { id }, data: { isActive } });

  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/pos");
  return { success: true };
}
