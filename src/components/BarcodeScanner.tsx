"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { t, type Locale } from "@/lib/i18n";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  language?: string;
}

export function BarcodeScanner({
  onScan,
  onClose,
  language = "en",
}: BarcodeScannerProps) {
  const i = t(language as Locale);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(true);
  const [manualCode, setManualCode] = useState("");
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const stoppedRef = useRef(false);

  // Camera feature states
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1, step: 0.1 });
  const [zoomValue, setZoomValue] = useState(1);
  const [cameras, setCameras] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [activeCameraIndex, setActiveCameraIndex] = useState(0);

  const safeStop = useCallback(
    (scanner: import("html5-qrcode").Html5Qrcode) => {
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
    },
    [],
  );

  const detectCapabilities = useCallback(
    (scanner: import("html5-qrcode").Html5Qrcode) => {
      try {
        const caps = scanner.getRunningTrackCameraCapabilities();

        // Torch
        const torch = caps.torchFeature();
        setTorchSupported(torch.isSupported());

        // Zoom
        const zoom = caps.zoomFeature();
        if (zoom.isSupported()) {
          setZoomSupported(true);
          setZoomRange({
            min: zoom.min(),
            max: zoom.max(),
            step: zoom.step() || 0.1,
          });
          setZoomValue(zoom.min());
        }
      } catch {
        // capabilities not available
      }
    },
    [],
  );

  const startScanner = useCallback(
    async (
      Html5Qrcode: typeof import("html5-qrcode").Html5Qrcode,
      cameraId: string | { facingMode: string },
    ) => {
      const regionId = "barcode-scanner-region";
      const scanner = new Html5Qrcode(regionId);
      scannerRef.current = scanner;
      stoppedRef.current = false;
      setStarting(true);

      try {
        await scanner.start(
          cameraId,
          { fps: 15, qrbox: { width: 280, height: 180 } },
          (decodedText) => {
            safeStop(scanner);
            onScan(decodedText);
          },
          () => {},
        );

        // Apply advanced constraints after start
        try {
          await scanner.applyVideoConstraints({
            advanced: [
              { focusMode: "continuous", exposureMode: "continuous" } as Record<
                string,
                unknown
              >,
            ],
          } as MediaTrackConstraints);
        } catch {
          // constraints not supported on this device
        }

        setStarting(false);
        detectCapabilities(scanner);
      } catch {
        setStarting(false);
        setCameraAvailable(false);
        setError("");
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [safeStop, onScan, detectCapabilities],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        // Get available cameras
        const devices = await Html5Qrcode.getCameras();
        if (cancelled) return;

        if (devices.length > 0) {
          setCameras(devices);
          // Prefer environment-facing camera
          const envIdx = devices.findIndex(
            (d) =>
              d.label.toLowerCase().includes("back") ||
              d.label.toLowerCase().includes("rear") ||
              d.label.toLowerCase().includes("environment"),
          );
          const idx = envIdx >= 0 ? envIdx : 0;
          setActiveCameraIndex(idx);
          await startScanner(Html5Qrcode, devices[idx].id);
        } else {
          await startScanner(Html5Qrcode, { facingMode: "environment" });
        }
      } catch {
        if (!cancelled) {
          setStarting(false);
          setCameraAvailable(false);
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

  const handleTorchToggle = useCallback(async () => {
    try {
      const caps = scannerRef.current?.getRunningTrackCameraCapabilities();
      if (!caps) return;
      const torch = caps.torchFeature();
      if (!torch.isSupported()) return;
      const next = !torchOn;
      await torch.apply(next);
      setTorchOn(next);
    } catch {
      // torch failed
    }
  }, [torchOn]);

  const handleZoomChange = useCallback(
    async (val: number) => {
      try {
        const caps = scannerRef.current?.getRunningTrackCameraCapabilities();
        if (!caps) return;
        const zoom = caps.zoomFeature();
        if (!zoom.isSupported()) return;
        const clamped = Math.min(zoomRange.max, Math.max(zoomRange.min, val));
        await zoom.apply(clamped);
        setZoomValue(clamped);
      } catch {
        // zoom failed
      }
    },
    [zoomRange],
  );

  const handleSwitchCamera = useCallback(async () => {
    if (cameras.length < 2) return;
    const scanner = scannerRef.current;
    if (!scanner) return;

    try {
      stoppedRef.current = false;
      const state = scanner.getState();
      if (state === 2 || state === 3) {
        await scanner.stop();
      }
    } catch {
      // ignore
    }

    // Reset feature states for new camera
    setTorchOn(false);
    setTorchSupported(false);
    setZoomSupported(false);
    setZoomValue(1);

    const nextIdx = (activeCameraIndex + 1) % cameras.length;
    setActiveCameraIndex(nextIdx);

    const { Html5Qrcode } = await import("html5-qrcode");
    await startScanner(Html5Qrcode, cameras[nextIdx].id);
  }, [cameras, activeCameraIndex, startScanner]);

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (code) {
      if (scannerRef.current) safeStop(scannerRef.current);
      onScan(code);
    }
  };

  const hasControls = torchSupported || zoomSupported || cameras.length > 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{i.scanner.title}</h3>
          <button
            onClick={() => {
              if (scannerRef.current) safeStop(scannerRef.current);
              onClose();
            }}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        <div className="p-4">
          {cameraAvailable && starting && (
            <p className="text-sm text-slate-500 text-center mb-2">
              {i.scanner.startingCamera}
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
                {i.scanner.pointCamera}
              </p>
            </>
          )}

          {/* Camera controls */}
          {cameraAvailable && !starting && hasControls && (
            <div className="flex items-center justify-center gap-3 mt-3">
              {/* Torch */}
              {torchSupported && (
                <button
                  onClick={handleTorchToggle}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    torchOn
                      ? "bg-amber-100 text-amber-700 border border-amber-200"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                  }`}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill={torchOn ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18h6" />
                    <path d="M10 22h4" />
                    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14" />
                  </svg>
                  {i.scanner.torch}
                </button>
              )}

              {/* Switch camera */}
              {cameras.length > 1 && (
                <button
                  onClick={handleSwitchCamera}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M11 19H4a2 2 0 01-2-2V7a2 2 0 012-2h5" />
                    <path d="M13 5h7a2 2 0 012 2v10a2 2 0 01-2 2h-5" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="M18 22l4-4-4-4" />
                    <path d="M6 2L2 6l4 4" />
                  </svg>
                  {i.scanner.switchCamera}
                </button>
              )}
            </div>
          )}

          {/* Zoom slider */}
          {cameraAvailable && !starting && zoomSupported && (
            <div className="flex items-center gap-3 mt-3 px-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase">
                {i.scanner.zoomLabel}
              </span>
              <input
                type="range"
                min={zoomRange.min}
                max={zoomRange.max}
                step={zoomRange.step}
                value={zoomValue}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className="flex-1 h-1.5 accent-indigo-500"
              />
              <span className="text-[10px] font-semibold text-slate-500 tabular-nums w-8 text-right">
                {zoomValue.toFixed(1)}x
              </span>
            </div>
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
                {i.scanner.noCamera}
              </p>
              <p className="text-xs text-slate-400">{i.scanner.usbHelp}</p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 text-center mt-2">{error}</p>
          )}

          {/* Manual barcode input · always visible */}
          <div className="mt-4 flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleManualSubmit();
              }}
              placeholder={i.scanner.enterManually}
              className="flex-1 text-sm border-2 border-slate-200 rounded-xl px-4 py-3 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              autoFocus={!cameraAvailable}
            />
            <button
              onClick={handleManualSubmit}
              disabled={!manualCode.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {i.scanner.go}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
