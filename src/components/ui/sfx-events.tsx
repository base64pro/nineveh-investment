"use client";

// م7.9 · مستمع أصوات الواجهة العام: نقرة رقمية لأي زر/تاب/رابط/مدخل اختيار في النظام كله —
// مستمع واحد مفوَّض على المستند (لا تعديل لكل زر)، يعمل بأول إيماءة (سياسة autoplay).

import { useEffect } from "react";
import { sfxClick } from "@/lib/sfx";

const CLICKABLE = 'button, [role="button"], [role="tab"], a, input[type="checkbox"], input[type="radio"], select, [role="option"]';

export function SfxEvents() {
  useEffect(() => {
    const onDown = (e: PointerEvent): void => {
      const el = e.target as Element | null;
      if (el?.closest?.(CLICKABLE)) sfxClick();
    };
    document.addEventListener("pointerdown", onDown, { capture: true, passive: true });
    return () => document.removeEventListener("pointerdown", onDown, { capture: true });
  }, []);
  return null;
}
