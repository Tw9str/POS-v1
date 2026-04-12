"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCodeDisplay({
  value,
  size = 100,
  className,
}: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      }).catch(() => {});
    }
  }, [value, size]);

  return <canvas ref={canvasRef} className={className} />;
}
