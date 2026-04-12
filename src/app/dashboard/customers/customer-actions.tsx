"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { IconPlus } from "@/components/icons";
import { useRouter } from "next/navigation";
import { offlineFetch } from "@/lib/offline-fetch";

interface EditableCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes?: string | null;
}

interface CustomerActionsProps {
  merchantId: string;
  customer?: EditableCustomer;
  externalOpen?: boolean;
  onExternalClose?: () => void;
  onDelete?: () => void;
}

export function CustomerActions({
  merchantId,
  customer,
  externalOpen,
  onExternalClose,
  onDelete,
}: CustomerActionsProps) {
  const router = useRouter();
  const isEdit = Boolean(customer);
  const [open, setOpen] = useState(false);
  const isModalOpen = externalOpen ?? open;
  const closeModal = () => {
    setOpen(false);
    onExternalClose?.();
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const emptyForm = {
    name: customer?.name ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    address: customer?.address ?? "",
    notes: customer?.notes ?? "",
  };

  const [form, setForm] = useState(emptyForm);

  function openModal() {
    setError("");
    setForm({
      name: customer?.name ?? "",
      phone: customer?.phone ?? "",
      email: customer?.email ?? "",
      address: customer?.address ?? "",
      notes: customer?.notes ?? "",
    });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await offlineFetch({
        url: "/api/merchant/customers",
        method: isEdit ? "PUT" : "POST",
        body: isEdit ? { id: customer?.id, ...form } : form,
        entity: "customer",
        merchantId,
      });

      if (!result.ok) {
        setError(
          result.error || `Failed to ${isEdit ? "update" : "add"} customer`,
        );
        return;
      }

      closeModal();
      setForm({ name: "", phone: "", email: "", address: "", notes: "" });
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
          {isEdit ? "Edit" : "Add Customer"}
        </Button>
      )}

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={isEdit ? "Edit Customer" : "Add Customer"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="name"
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            id="phone"
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            id="email"
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            id="address"
            label="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <Input
            id="notes"
            label="Notes"
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
                Delete
              </Button>
            )}
            <div className="ml-auto flex gap-3">
              <Button variant="secondary" type="button" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                {isEdit ? "Save Changes" : "Add Customer"}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
