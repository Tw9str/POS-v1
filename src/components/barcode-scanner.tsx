"use client";

import { useEffect, useRef, useState } from "react";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(true);
  const [manualCode, setManualCode] = useState("");
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const stoppedRef = useRef(false);

  const safeStop = (scanner: import("html5-qrcode").Html5Qrcode) => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    try {
      const state = scanner.getState();
      if (state === 2 || state === 3) {
        scanner.stop().catch(() => {});
      }
    } catch {
      // scanner not initialized
    }
  };

  useEffect(() => {
    let cancelled = false;
    const regionId = "barcode-scanner-region";

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const scanner = new Html5Qrcode(regionId);
        scannerRef.current = scanner;
        stoppedRef.current = false;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            safeStop(scanner);
            onScan(decodedText);
          },
          () => {},
        );
        if (!cancelled) setStarting(false);
      } catch {
        if (!cancelled) {
          setStarting(false);
          setCameraAvailable(false);
          setError("");
          // Focus the manual input when camera isn't available
          setTimeout(() => inputRef.current?.focus(), 100);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (scannerRef.current) safeStop(scannerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (code) {
      if (scannerRef.current) safeStop(scannerRef.current);
      onScan(code);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Scan Barcode</h3>
          <button
            onClick={() => {
              if (scannerRef.current) safeStop(scannerRef.current);
              onClose();
            }}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-4">
          {cameraAvailable && starting && (
            <p className="text-sm text-slate-500 text-center mb-2">
              Starting camera...
            </p>
          )}
          {cameraAvailable && (
            <>
              <div
                id="barcode-scanner-region"
                ref={containerRef}
                className="w-full"
              />
              <p className="text-xs text-slate-400 text-center mt-3">
                Point your camera at a barcode
              </p>
            </>
          )}

          {!cameraAvailable && (
            <div className="text-center py-4">
              <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 rounded-full flex items-center justify-center">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-slate-400"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <line x1="12" y1="4" x2="12" y2="20" />
                </svg>
              </div>
              <p className="text-sm text-slate-600 mb-1 font-semibold">
                No camera detected
              </p>
              <p className="text-xs text-slate-400">
                Type or scan barcode with a USB/Bluetooth scanner
              </p>
            </div>
          )}

          {/* Manual barcode input — always visible */}
          <div className="mt-4 flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleManualSubmit();
              }}
              placeholder="Enter barcode manually..."
              className="flex-1 text-sm border-2 border-slate-200 rounded-xl px-4 py-3 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              autoFocus={!cameraAvailable}
            />
            <button
              onClick={handleManualSubmit}
              disabled={!manualCode.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Go
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
