"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { IconPlus } from "@/components/Icons";
import { t, type Locale } from "@/lib/i18n";
import { createSupplier, updateSupplier } from "@/app/actions/merchant";
import type { ActionResult } from "@/app/actions/merchant";

interface EditableSupplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes?: string | null;
}

interface SupplierActionsProps {
  merchantId: string;
  supplier?: EditableSupplier;
  externalOpen?: boolean;
  onExternalClose?: () => void;
  onDelete?: () => void;
  onSaved?: (supplier: EditableSupplier & { _orderCount?: number }) => void;
  language?: string;
}

export function SupplierActions({
  merchantId,
  supplier,
  externalOpen,
  onExternalClose,
  onDelete,
  onSaved,
  language = "en",
}: SupplierActionsProps) {
  const i = t(language as Locale);
  const isEdit = Boolean(supplier);
  const [open, setOpen] = useState(false);
  const isModalOpen = externalOpen ?? open;
  const closeModal = () => {
    setOpen(false);
    onExternalClose?.();
  };

  const action = isEdit ? updateSupplier : createSupplier;
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    async (prev, fd) => {
      const result = await action(prev, fd);
      if (result.success) {
        const saved = (result.data ?? {}) as EditableSupplier & {
          _orderCount?: number;
        };
        closeModal();
        onSaved?.(saved);
      }
      return result;
    },
    {},
  );

  const [form, setForm] = useState({
    name: supplier?.name ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    address: supplier?.address ?? "",
    notes: supplier?.notes ?? "",
  });

  function openModal() {
    setForm({
      name: supplier?.name ?? "",
      phone: supplier?.phone ?? "",
      email: supplier?.email ?? "",
      address: supplier?.address ?? "",
      notes: supplier?.notes ?? "",
    });
    setOpen(true);
  }

  return (
    <>
      {!externalOpen && (
        <Button
          onClick={openModal}
          variant={isEdit ? "ghost" : "primary"}
          size={isEdit ? "sm" : "md"}
        >
          {!isEdit && <IconPlus size={18} />}
          {isEdit ? i.common.edit : i.suppliers.addSupplier}
        </Button>
      )}

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={isEdit ? i.suppliers.editSupplier : i.suppliers.addSupplier}
      >
        <form action={formAction} className="space-y-4">
          {isEdit && supplier?.id && (
            <input type="hidden" name="id" value={supplier.id} />
          )}
          <Input
            id="name"
            name="name"
            label={i.common.name}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            id="phone"
            name="phone"
            label={i.common.phone}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            id="email"
            name="email"
            label={i.common.email}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            id="address"
            name="address"
            label={i.common.address}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <Input
            id="notes"
            name="notes"
            label={i.common.notes}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          {state.error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {state.error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-4">
            {isEdit && onDelete && (
              <Button
                variant="danger"
                type="button"
                onClick={() => {
                  closeModal();
                  onDelete();
                }}
              >
                {i.common.delete}
              </Button>
            )}
            <div className="ml-auto flex gap-3">
              <Button variant="secondary" type="button" onClick={closeModal}>
                {i.common.cancel}
              </Button>
              <Button type="submit" loading={isPending}>
                {isEdit ? i.common.save : i.suppliers.addSupplier}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
