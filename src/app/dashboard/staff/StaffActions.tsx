"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { IconPlus } from "@/components/Icons";
import { t, type Locale } from "@/lib/i18n";
import { createStaff, updateStaff } from "@/app/actions/merchant";
import type { ActionResult } from "@/app/actions/merchant";
import {
  ALL_PAGE_KEYS,
  ROLE_TEMPLATES,
  type PageKey,
} from "@/lib/staffConstants";

const PAGE_LABEL_KEYS: Record<PageKey, string> = {
  pos: "posShort",
  products: "products",
  inventory: "inventory",
  orders: "orders",
  customers: "customers",
  suppliers: "suppliers",
  promos: "promos",
  reports: "reports",
  analytics: "analytics",
  settings: "settings",
};

interface EditableStaff {
  id: string;
  name: string;
  pin: string;
  role: string;
  allowedPages?: string[];
  isOwner?: boolean;
  isActive?: boolean;
}

interface StaffActionsProps {
  staff?: EditableStaff;
  externalOpen?: boolean;
  onExternalClose?: () => void;
  onSaved?: (staff: EditableStaff & { maxDiscountPercent: number }) => void;
  language?: string;
}

function resolveTemplate(allowedPages: string[]): string {
  for (const [name, pages] of Object.entries(ROLE_TEMPLATES)) {
    if (
      pages.length === allowedPages.length &&
      pages.every((p) => allowedPages.includes(p))
    ) {
      return name;
    }
  }
  return "CUSTOM";
}

export function StaffActions({
  staff,
  externalOpen,
  onExternalClose,
  onSaved,
  language = "en",
}: StaffActionsProps) {
  const i = t(language as Locale);
  const isEdit = Boolean(staff);
  const [open, setOpen] = useState(false);
  const isModalOpen = externalOpen ?? open;
  const closeModal = () => {
    setOpen(false);
    onExternalClose?.();
  };

  const serverAction = isEdit ? updateStaff : createStaff;
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (prev, fd) => {
      const result = await serverAction(prev, fd);
      if (result.success) {
        const saved = (result.data ?? {}) as EditableStaff & {
          maxDiscountPercent: number;
        };
        closeModal();
        onSaved?.(saved);
      }
      return result;
    },
    {},
  );

  const [name, setName] = useState(staff?.name ?? "");
  const [pin, setPin] = useState("");
  const [roleName, setRoleName] = useState(staff?.role ?? "Cashier");
  const [template, setTemplate] = useState(() =>
    staff?.allowedPages
      ? resolveTemplate(staff.allowedPages)
      : (staff?.role ?? "CASHIER"),
  );
  const [allowedPages, setAllowedPages] = useState<string[]>(
    staff?.allowedPages ?? ROLE_TEMPLATES["CASHIER"] ?? [],
  );

  function openModal() {
    setName(staff?.name ?? "");
    setPin("");
    setRoleName(staff?.role ?? "Cashier");
    const pages =
      staff?.allowedPages ?? ROLE_TEMPLATES[staff?.role ?? "CASHIER"] ?? [];
    setAllowedPages(pages);
    setTemplate(
      staff?.allowedPages
        ? resolveTemplate(staff.allowedPages)
        : (staff?.role ?? "CASHIER"),
    );
    setOpen(true);
  }

  const TEMPLATE_NAMES: Record<string, string> = {
    CASHIER: i.staff.roleCashier,
    MANAGER: i.staff.roleManager,
    STOCK_CLERK: i.staff.roleStockClerk,
  };

  function handleTemplateChange(value: string) {
    setTemplate(value);
    if (value !== "CUSTOM" && ROLE_TEMPLATES[value]) {
      setAllowedPages([...ROLE_TEMPLATES[value]]);
      setRoleName(TEMPLATE_NAMES[value] ?? value);
    }
  }

  function togglePage(key: string) {
    setAllowedPages((prev) => {
      const next = prev.includes(key)
        ? prev.filter((p) => p !== key)
        : [...prev, key];
      const matched = resolveTemplate(next);
      setTemplate(matched);
      return next;
    });
  }

  const isOwner = staff?.isOwner === true;

  return (
    <>
      {!externalOpen && (
        <Button
          onClick={openModal}
          variant={isEdit ? "ghost" : "primary"}
          size={isEdit ? "sm" : "md"}
        >
          {!isEdit && <IconPlus size={18} />}
          {isEdit ? i.common.edit : i.staff.addStaff}
        </Button>
      )}

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={isEdit ? i.staff.editStaff : i.staff.addStaffMember}
      >
        <form action={formAction} className="space-y-4">
          {isEdit && staff?.id && (
            <input type="hidden" name="id" value={staff.id} />
          )}
          <input
            type="hidden"
            name="role"
            value={
              roleName.trim() || (template === "CUSTOM" ? "Custom" : template)
            }
          />
          {allowedPages.map((p) => (
            <input key={p} type="hidden" name="allowedPages" value={p} />
          ))}
          <Input
            id="name"
            name="name"
            label={i.staff.fullName}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isOwner}
          />
          <Input
            id="pin"
            name="pin"
            label={isEdit ? i.staff.newPinOptional : i.staff.pinCode}
            type="text"
            pattern={isEdit ? "[0-9]{4}|" : "[0-9]{4}"}
            maxLength={4}
            placeholder={isEdit ? "••••" : ""}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            required={!isEdit}
          />

          {!isOwner && (
            <>
              <Select
                id="template"
                label={i.staff.roleTemplate}
                value={template}
                onChange={(e) => handleTemplateChange(e.target.value)}
                options={[
                  { value: "CASHIER", label: i.staff.roleCashier },
                  { value: "MANAGER", label: i.staff.roleManager },
                  { value: "STOCK_CLERK", label: i.staff.roleStockClerk },
                  { value: "CUSTOM", label: i.staff.custom },
                ]}
              />

              <Input
                id="roleName"
                label={i.staff.roleName}
                value={roleName}
                onChange={(e) => {
                  setRoleName(e.target.value);
                  setTemplate(resolveTemplate(allowedPages));
                }}
                required
              />

              <fieldset>
                <legend className="text-sm font-medium text-slate-700 mb-2">
                  {i.staff.pageAccess}
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_PAGE_KEYS.map((key) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors has-checked:border-indigo-300 has-checked:bg-indigo-50"
                    >
                      <input
                        type="checkbox"
                        checked={allowedPages.includes(key)}
                        onChange={() => togglePage(key)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-700">
                        {
                          (i.nav as Record<string, string>)[
                            PAGE_LABEL_KEYS[key]
                          ]
                        }
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          {isOwner && (
            <p className="text-sm text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
              {i.staff.roleOwner} — full access
            </p>
          )}

          {state.error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {state.error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-4">
            <div className="ml-auto flex gap-3">
              <Button variant="secondary" type="button" onClick={closeModal}>
                {i.common.cancel}
              </Button>
              {!isOwner && (
                <Button type="submit" loading={isPending}>
                  {isEdit ? i.common.save : i.staff.addStaff}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
