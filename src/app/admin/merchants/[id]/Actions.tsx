"use client";

import { Button } from "@/components/ui/Button";
import { useState } from "react";

interface MerchantActionsProps {
  merchantId: string;
  isActive: boolean;
}

export function MerchantActions({
  merchantId,
  isActive,
}: MerchantActionsProps) {
  const [loading, setLoading] = useState(false);

  async function toggleStatus() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/merchants/${merchantId}/toggle`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Failed to update status.");
        return;
      }
      window.location.reload();
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function generateLicense() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/merchants/${merchantId}/license`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Failed to generate license.");
        return;
      }
      const data = await res.json();
      if (data.activationCode) {
        alert(
          `Activation Code: ${data.activationCode}\n\nSend this to the merchant via SMS or WhatsApp.`,
        );
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={generateLicense}
        loading={loading}
      >
        Generate License
      </Button>
      <Button
        variant={isActive ? "danger" : "primary"}
        size="sm"
        onClick={toggleStatus}
        loading={loading}
      >
        {isActive ? "Suspend" : "Activate"}
      </Button>
    </div>
  );
}
