"use client";

import { useEffect } from "react";

/** إغلاق بمفتاح Escape — موحَّد لنوافذ النظام (لوحة المفاتيح/الوصولية §و.3). */
export function useEscClose(active: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [active, onClose]);
}
