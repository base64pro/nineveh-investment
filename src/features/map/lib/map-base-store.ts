"use client";

// م8.10 · مخزن خارجي بسيط للقاعدة المرئية للخريطة (داكن/فاتح/قمر صناعي) — تكتبه الخريطة عند التبديل،
// وتقرأه عناصر خارج الخريطة (مؤشّرات KPI) لتكييف ألوانها (قرص كحلي فوق الخريطة الفاتحة). يُصفَّر بإعادة التحميل.
import { useSyncExternalStore } from "react";
import { DEFAULT_BASE, type BaseStyle } from "./map-config";

let current: BaseStyle = DEFAULT_BASE;
const listeners = new Set<() => void>();

export function setMapBase(base: BaseStyle): void {
  if (base === current) return;
  current = base;
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useMapBase(): BaseStyle {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => DEFAULT_BASE,
  );
}
