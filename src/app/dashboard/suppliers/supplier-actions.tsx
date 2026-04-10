"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { IconPlus } from "@/components/icons";
import { useRouter } from "next/navigation";
import { offlineFetch } from "@/lib/offline-fetch";

interface SupplierActionsProps {
  merchantId: string;
}

export function SupplierActions({ merchantId }: SupplierActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await offlineFetch({
        url: "/api/merchant/suppliers",
        method: "POST",
        body: form,
        entity: "supplier",
        merchantId,
      });

      if (!result.ok) {
        setError(result.error || "Failed to add supplier");
        return;
      }

      setOpen(false);
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
      <Button onClick={() => setOpen(true)}>
        <IconPlus size={18} />
        Add Supplier
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Supplier">
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

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Add Supplier
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
