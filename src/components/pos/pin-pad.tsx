"use client";

import { useState, useCallback, useEffect } from "react";
import { getLocalStaff } from "@/lib/offline-sync";

interface PinPadProps {
  merchantId?: string;
  onSuccess: (staff: { id: string; name: string; role: string }) => void;
  merchantName?: string;
}

async function verifyPinOffline(
  merchantId: string,
  pin: string,
): Promise<{ id: string; name: string; role: string } | null> {
  const staffList = await getLocalStaff(merchantId);
  const match = staffList.find((s) => s.pin === pin && s.isActive);
  if (!match) return null;
  return { id: match.id, name: match.name, role: match.role };
}

export function PinPad({ merchantId, onSuccess, merchantName }: PinPadProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const maxLength = 6;

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length < maxLength) {
        setPin((prev) => prev + digit);
        setError("");
      }
    },
    [pin.length],
  );

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setError("");
  }, []);

  const handleClear = useCallback(() => {
    setPin("");
    setError("");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (pin.length < 4) {
      setError("PIN must be at least 4 digits");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/staff/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess(data.staff);
        return;
      }

      // If server is offline (503), try verifying PIN locally
      if (res.status === 503 && merchantId) {
        const localMatch = await verifyPinOffline(merchantId, pin);
        if (localMatch) {
          // Set the session cookie via API with offline-verified data
          const offlineRes = await fetch("/api/staff/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pin,
              offlineVerified: true,
              staffId: localMatch.id,
              staffName: localMatch.name,
              staffRole: localMatch.role,
            }),
          }).catch(() => null);

          if (offlineRes?.ok) {
            const offlineData = await offlineRes.json();
            onSuccess(offlineData.staff);
          } else {
            // Cookie couldn't be set but still let them in
            onSuccess(localMatch);
          }
          return;
        }
      }

      setError(data.error || "Invalid PIN");
      setPin("");
    } catch {
      // Network completely down — try offline verification
      if (merchantId) {
        try {
          const localMatch = await verifyPinOffline(merchantId, pin);
          if (localMatch) {
            onSuccess(localMatch);
            return;
          }
        } catch {
          // IndexedDB also failed
        }
      }
      setError("Connection error. Please try again.");
      setPin("");
    } finally {
      setLoading(false);
    }
  }, [pin, onSuccess, merchantId]);

  // Auto-submit when PIN reaches max length
  useEffect(() => {
    if (pin.length === maxLength) {
      handleSubmit();
    }
  }, [pin.length, handleSubmit]);

  // Keyboard support
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key >= "0" && e.key <= "9") {
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Enter" && pin.length >= 4) {
        handleSubmit();
      } else if (e.key === "Escape") {
        handleClear();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDigit, handleBackspace, handleSubmit, handleClear, pin.length]);

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <span className="text-2xl font-bold text-white">S</span>
          </div>
          <h1 className="text-xl font-bold text-white">
            {merchantName || "Shampay POS"}
          </h1>
          <p className="text-sm text-indigo-200/70 mt-1">
            Enter your PIN to start
          </p>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-3 mb-6">
          {Array.from({ length: maxLength }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all duration-150 ${
                i < pin.length
                  ? "bg-indigo-400 shadow-lg shadow-indigo-400/50 scale-110"
                  : "bg-white/10 border border-white/20"
              }`}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="text-center mb-4">
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2 inline-block">
              {error}
            </p>
          </div>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {digits.map((digit) => (
            <button
              key={digit}
              onClick={() => handleDigit(digit)}
              disabled={loading || pin.length >= maxLength}
              className="h-16 rounded-xl bg-white/5 border border-white/10 text-white text-2xl font-semibold hover:bg-white/10 active:bg-white/15 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {digit}
            </button>
          ))}
          {/* Bottom row: Clear, 0, Backspace */}
          <button
            onClick={handleClear}
            disabled={loading}
            className="h-16 rounded-xl bg-white/5 border border-white/10 text-red-400 text-sm font-semibold hover:bg-red-500/10 active:scale-95 transition-all disabled:opacity-50"
          >
            Clear
          </button>
          <button
            onClick={() => handleDigit("0")}
            disabled={loading || pin.length >= maxLength}
            className="h-16 rounded-xl bg-white/5 border border-white/10 text-white text-2xl font-semibold hover:bg-white/10 active:bg-white/15 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={loading || pin.length === 0}
            className="h-16 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
              <line x1="18" y1="9" x2="12" y2="15" />
              <line x1="12" y1="9" x2="18" y2="15" />
            </svg>
          </button>
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={loading || pin.length < 4}
          className="w-full h-14 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-lg transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/30"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Verifying…
            </span>
          ) : (
            "Sign In"
          )}
        </button>

        <p className="text-center text-xs text-white/30 mt-6">
          Use your assigned PIN to access the terminal
        </p>
      </div>
    </div>
  );
}
