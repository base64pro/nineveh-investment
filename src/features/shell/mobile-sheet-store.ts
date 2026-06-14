"use client";

// م8.2 · مصدر واحد لارتفاع الورقة السفلية الحيّ على الجوال (px). يستهلكه:
//  - camera padding للخريطة عند الطيران (§5) عبر getSheetHeight()،
//  - قصّ المنطقة المرئية لبطاقة صور القطعة (§9) عبر useSheetHeight()،
//  - إزاحة الدوك العائم ليعلو الورقة (§4).
// كل المستهلكين يقرؤون عبر getSheetHeight()/useSheetHeight() (لا CSS var). صفر = لا ورقة مفتوحة.
import { useEffect, useState } from "react";

let current = 0;
const subs = new Set<(h: number) => void>();

export function setSheetHeight(h: number): void {
  const v = Math.max(0, Math.round(h));
  if (v === current) return;
  current = v;
  for (const s of subs) s(current);
}

export function getSheetHeight(): number {
  return current;
}

export function onSheetHeight(fn: (h: number) => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function useSheetHeight(): number {
  const [h, setH] = useState(current);
  useEffect(() => onSheetHeight(setH), []);
  return h;
}
