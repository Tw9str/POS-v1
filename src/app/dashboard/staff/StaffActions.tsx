"use client";
import type React from "react";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { IconPlus } from "@/components/Icons";
import { t, type Locale } from "@/lib/i18n";

interface EditableStaff {
  id: string;
  name: string;
  pin: string;
  role: string;
  isActive?: boolean;
}

interface StaffActionsProps {
  merchantId: string;
  staff?: EditableStaff;
  externalOpen?: boolean;
  onExternalClose?: () => void;
  onDelete?: () => void;
  onSaved?: (staff: EditableStaff & { maxDiscountPercent: number }) => void;
  language?: string;
}

export function StaffActions({
  merchantId,
  staff,
  externalOpen,
  onExternalClose,
  onDelete,
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: staff?.name ?? "",
    pin: staff?.pin ?? "",
    role: staff?.role ?? "CASHIER",
  });

  function openModal() {
    setError("");
    setForm({
      name: staff?.name ?? "",
      pin: staff?.pin ?? "",
      role: staff?.role ?? "CASHIER",
    });
    setOpen(true);
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/merchant/staff", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { id: staff?.id, ...form } : form),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(
          err.error || (isEdit ? i.staff.failedToUpdate : i.staff.failedToAdd),
        );
        return;
      }

      const savedStaff = (await res.json()) as EditableStaff & {
        maxDiscountPercent: number;
      };

      closeModal();
      setForm({ name: "", pin: "", role: "CASHIER" });
      onSaved?.(savedStaff);
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
          {isEdit ? i.common.edit : i.staff.addStaff}
        </Button>
      )}

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={isEdit ? i.staff.editStaff : i.staff.addStaffMember}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="name"
            label={i.staff.fullName}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            id="pin"
            label={i.staff.pinCode}
            type="text"
            pattern="[0-9]{4}"
            maxLength={4}
            value={form.pin}
            onChange={(e) =>
              setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })
            }
            required
          />
          <Select
            id="role"
            label={i.staff.roleLabel}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={[
              { value: "CASHIER", label: i.roles.CASHIER },
              { value: "MANAGER", label: i.roles.MANAGER },
              { value: "STOCK_CLERK", label: i.roles.STOCK_CLERK },
              { value: "OWNER", label: i.roles.OWNER },
            ]}
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
                {isEdit ? i.common.save : i.staff.addStaff}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
