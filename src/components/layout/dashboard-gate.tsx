"use client";

import { PinPad } from "@/components/pos/pin-pad";
import { useRouter } from "next/navigation";

interface DashboardGateProps {
  merchantId: string;
  merchantName: string;
}

export function DashboardGate({
  merchantId,
  merchantName,
}: DashboardGateProps) {
  const router = useRouter();

  return (
    <PinPad
      merchantId={merchantId}
      merchantName={merchantName}
      onSuccess={() => {
        // Staff auth API sets the cookie · just reload to re-render layout
        router.refresh();
      }}
    />
  );
}
