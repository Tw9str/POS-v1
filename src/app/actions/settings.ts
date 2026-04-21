"use server";

import { prisma } from "@/lib/db";
import { setMerchantSession } from "@/lib/merchantAuth";
import { hashPin } from "@/lib/pinHash";
import { normalizeDateFormat } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "./_shared";
import { requireMerchant } from "./_shared";
import { requireStaffAction } from "./_shared";

const settingsSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  currency: z.string().min(3).max(3).optional(),
  currencyFormat: z.enum(["symbol", "code", "none"]).optional(),
  numberFormat: z.enum(["western", "eastern"]).optional(),
  dateFormat: z
    .enum(["long", "numeric", "arabic", "gregorian", "hijri"])
    .optional(),
  language: z.enum(["en", "ar"]).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  shamcashId: z.string().max(100).optional(),
});

export async function updateSettings(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };
  const { error: sErr } = await requireStaffAction(
    "/api/merchant/settings",
    "PUT",
  );
  if (sErr) return { error: sErr };

  const raw = Object.fromEntries(formData);
  const parsed = settingsSchema.safeParse({
    ...raw,
    taxRate: raw.taxRate !== undefined ? Number(raw.taxRate) : undefined,
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.phone !== undefined) data.phone = parsed.data.phone || null;
  if (parsed.data.address !== undefined)
    data.address = parsed.data.address || null;
  if (parsed.data.currency !== undefined) data.currency = parsed.data.currency;
  if (parsed.data.currencyFormat !== undefined)
    data.currencyFormat = parsed.data.currencyFormat;
  if (parsed.data.numberFormat !== undefined)
    data.numberFormat = parsed.data.numberFormat;
  if (parsed.data.dateFormat !== undefined)
    data.dateFormat = normalizeDateFormat(parsed.data.dateFormat);
  if (parsed.data.language !== undefined) data.language = parsed.data.language;
  if (parsed.data.taxRate !== undefined) data.taxRate = parsed.data.taxRate;
  if (parsed.data.shamcashId !== undefined)
    data.shamcashId = parsed.data.shamcashId || null;

  const updated = await prisma.merchant.update({
    where: { id: merchant.id },
    data,
  });

  await setMerchantSession({
    id: updated.id,
    name: updated.name,
    currency: updated.currency,
    currencyFormat: updated.currencyFormat ?? "symbol",
    taxRate: updated.taxRate,
    phone: updated.phone,
    address: updated.address,
    numberFormat: updated.numberFormat ?? "western",
    dateFormat: updated.dateFormat ?? "long",
    language: updated.language ?? "en",
    shamcashId: updated.shamcashId ?? null,
    onboardingDone: updated.onboardingDone ?? false,
  });

  await prisma.activityLog
    .create({
      data: {
        merchantId: merchant.id,
        action: "SETTINGS_UPDATED",
        entity: "merchant",
        entityId: merchant.id,
      },
    })
    .catch(() => {});

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function updateQuickSettings(
  input: Partial<z.infer<typeof settingsSchema>>,
): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const data: Record<string, unknown> = {};
  if (parsed.data.language !== undefined) data.language = parsed.data.language;
  if (parsed.data.numberFormat !== undefined)
    data.numberFormat = parsed.data.numberFormat;
  if (parsed.data.currencyFormat !== undefined)
    data.currencyFormat = parsed.data.currencyFormat;
  if (parsed.data.dateFormat !== undefined)
    data.dateFormat = normalizeDateFormat(parsed.data.dateFormat);

  if (Object.keys(data).length === 0) return { success: true };

  const updated = await prisma.merchant.update({
    where: { id: merchant.id },
    data,
  });

  await setMerchantSession({
    id: updated.id,
    name: updated.name,
    currency: updated.currency,
    currencyFormat: updated.currencyFormat ?? "symbol",
    taxRate: updated.taxRate,
    phone: updated.phone,
    address: updated.address,
    numberFormat: updated.numberFormat ?? "western",
    dateFormat: updated.dateFormat ?? "long",
    language: updated.language ?? "en",
    shamcashId: updated.shamcashId ?? null,
    onboardingDone: updated.onboardingDone ?? false,
  });

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

// ─── Onboarding ───

const onboardingSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(30).optional().default(""),
  address: z.string().max(500).optional().default(""),
  currency: z.string().min(3).max(3),
  language: z.enum(["en", "ar"]).optional().default("en"),
  taxRate: z.number().min(0).max(100),
  shamcashId: z.string().max(100).optional().default(""),
  ownerName: z.string().min(1).max(100),
  ownerPin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/),
});

export async function completeOnboarding(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { error: mErr, merchant } = await requireMerchant();
  if (mErr) return { error: mErr };

  if (merchant.onboardingDone) return { error: "Onboarding already completed" };

  const raw = Object.fromEntries(formData);
  const parsed = onboardingSchema.safeParse({
    ...raw,
    taxRate: Number(raw.taxRate),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { ownerName, ownerPin, ...merchantData } = parsed.data;
  const hashedPin = await hashPin(ownerPin);

  const updated = await prisma.$transaction(async (tx) => {
    const m = await tx.merchant.update({
      where: { id: merchant.id },
      data: {
        name: merchantData.name,
        phone: merchantData.phone || null,
        address: merchantData.address || null,
        currency: merchantData.currency.toUpperCase(),
        language: merchantData.language,
        taxRate: merchantData.taxRate,
        shamcashId: merchantData.shamcashId || null,
        onboardingDone: true,
      },
    });

    const existingOwner = await tx.staff.findFirst({
      where: { merchantId: merchant.id, isOwner: true },
    });
    if (existingOwner) {
      await tx.staff.update({
        where: { id: existingOwner.id },
        data: { name: ownerName, pin: hashedPin },
      });
    } else {
      await tx.staff.create({
        data: {
          merchantId: merchant.id,
          name: ownerName,
          pin: hashedPin,
          role: "OWNER",
          isOwner: true,
        },
      });
    }

    return m;
  });

  await setMerchantSession({
    id: updated.id,
    name: updated.name,
    currency: updated.currency,
    currencyFormat: updated.currencyFormat ?? "symbol",
    taxRate: updated.taxRate,
    phone: updated.phone,
    address: updated.address,
    numberFormat: updated.numberFormat ?? "western",
    dateFormat: updated.dateFormat ?? "long",
    language: updated.language ?? "en",
    shamcashId: updated.shamcashId ?? null,
    onboardingDone: true,
  });

  return { success: true };
}
