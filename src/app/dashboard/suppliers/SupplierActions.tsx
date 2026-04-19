"use client";
import type React from "react";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { IconPlus } from "@/components/Icons";
import { t, type Locale } from "@/lib/i18n";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: supplier?.name ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    address: supplier?.address ?? "",
    notes: supplier?.notes ?? "",
  });

  function openModal() {
    setError("");
    setForm({
      name: supplier?.name ?? "",
      phone: supplier?.phone ?? "",
      email: supplier?.email ?? "",
      address: supplier?.address ?? "",
      notes: supplier?.notes ?? "",
    });
    setOpen(true);
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/merchant/suppliers", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { id: supplier?.id, ...form } : form),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(
          err.error ||
            (isEdit ? i.suppliers.failedToUpdate : i.suppliers.failedToAdd),
        );
        return;
      }

      const savedSupplier = (await res.json()) as EditableSupplier & {
        _orderCount?: number;
      };

      closeModal();
      setForm({ name: "", phone: "", email: "", address: "", notes: "" });
      onSaved?.(savedSupplier);
    } catch {
      setError(i.common.somethingWentWrong);
    } finally {
      setLoading(false);
    }
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="name"
            label={i.common.name}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            id="phone"
            label={i.common.phone}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            id="email"
            label={i.common.email}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            id="address"
            label={i.common.address}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <Input
            id="notes"
            label={i.common.notes}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
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
              <Button type="submit" loading={loading}>
                {isEdit ? i.common.save : i.suppliers.addSupplier}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
