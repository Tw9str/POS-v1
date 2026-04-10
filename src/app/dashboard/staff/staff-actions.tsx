"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { IconPlus } from "@/components/icons";
import { useRouter } from "next/navigation";
import { offlineFetch } from "@/lib/offline-fetch";

interface StaffActionsProps {
  merchantId: string;
}

export function StaffActions({ merchantId }: StaffActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", pin: "", role: "CASHIER" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await offlineFetch({
        url: "/api/merchant/staff",
        method: "POST",
        body: form,
        entity: "staff",
        merchantId,
      });

      if (!result.ok) {
        setError(result.error || "Failed to add staff");
        return;
      }

      setOpen(false);
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
      <Button onClick={() => setOpen(true)}>
        <IconPlus size={18} />
        Add Staff
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add Staff Member"
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
            ]}
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
              Add Staff
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
