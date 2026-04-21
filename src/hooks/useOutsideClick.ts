"use client";

import { useEffect, type RefObject } from "react";

/**
 * Closes/dismisses UI when a pointerdown occurs outside the referenced element.
 * Pass `enabled` (usually the "open" state) so the listener only runs when needed.
 */
export function useOutsideClick(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutside();
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [ref, onOutside, enabled]);
}
