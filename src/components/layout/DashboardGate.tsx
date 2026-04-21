"use client";

import { PinPad } from "@/components/pos/PinPad";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

interface DashboardGateProps {
  merchantName: string;
  language?: string;
}

export function DashboardGate({ merchantName, language }: DashboardGateProps) {
  const router = useRouter();

  const handleSuccess = useCallback(() => {
    // Force server layout to re-run so it detects the new staff session cookie
    router.refresh();
  }, [router]);

  return (
    <PinPad
      merchantName={merchantName}
      language={language}
      onSuccess={handleSuccess}
    />
  );
}
