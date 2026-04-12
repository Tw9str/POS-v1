"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { IconPlus } from "@/components/icons";
import { useRouter } from "next/navigation";
import { offlineFetch } from "@/lib/offline-fetch";

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
}

export function StaffActions({
  merchantId,
  staff,
  externalOpen,
  onExternalClose,
  onDelete,
}: StaffActionsProps) {
  const router = useRouter();
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await offlineFetch({
        url: "/api/merchant/staff",
        method: isEdit ? "PUT" : "POST",
        body: isEdit ? { id: staff?.id, ...form } : form,
        entity: "staff",
        merchantId,
      });

      if (!result.ok) {
        setError(
          result.error || `Failed to ${isEdit ? "update" : "add"} staff`,
        );
        return;
      }

      closeModal();
      setForm({ name: "", pin: "", role: "CASHIER" });
      router.refresh();
    } catch {
      setError("Something went wrong");
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
          {isEdit ? "Edit" : "Add Staff"}
        </Button>
      )}

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={isEdit ? "Edit Staff Member" : "Add Staff Member"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="name"
            label="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            id="pin"
            label="PIN code (4-6 digits)"
            type="text"
            pattern="[0-9]{4,6}"
            maxLength={6}
            value={form.pin}
            onChange={(e) =>
              setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })
            }
            required
          />
          <Select
            id="role"
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={[
              { value: "CASHIER", label: "Cashier" },
              { value: "MANAGER", label: "Manager" },
              { value: "STOCK_CLERK", label: "Stock Clerk" },
              { value: "OWNER", label: "Owner" },
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
                Delete
              </Button>
            )}
            <div className="ml-auto flex gap-3">
              <Button variant="secondary" type="button" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                {isEdit ? "Save Changes" : "Add Staff"}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
