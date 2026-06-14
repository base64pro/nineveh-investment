"use client";

// م7.9 · مستمع أصوات الواجهة العام: نقرة رقمية لأي زر/تاب/رابط/مدخل اختيار في النظام كله —
// مستمع واحد مفوَّض على المستند (لا تعديل لكل زر)، يعمل بأول إيماءة (سياسة autoplay).

import { useEffect } from "react";
import { sfxBoot, sfxClick, unlockSfx } from "@/lib/sfx";

const CLICKABLE = 'button, [role="button"], [role="tab"], a, input[type="checkbox"], input[type="radio"], select, [role="option"]';

export function SfxEvents() {
  useEffect(() => {
    // **لا نلمس AudioContext قبل الإيماءة** (سياسة autoplay — يمنع تحذير الكونسول).
    // أوّل إيماءة: تفتح السياق (ضمن الإيماءة) ثم تشغّل نغمة الافتتاح مرّة واحدة.
    const boot = (): void => {
      unlockSfx();
      sfxBoot();
      window.removeEventListener("pointerdown", boot, { capture: true });
      window.removeEventListener("keydown", boot, { capture: true });
    };
    window.addEventListener("pointerdown", boot, { capture: true });
    window.addEventListener("keydown", boot, { capture: true });

    const onDown = (e: PointerEvent): void => {
      unlockSfx(); // ضمان فتح السياق ضمن إيماءة النقر
      const el = e.target as Element | null;
      if (el?.closest?.(CLICKABLE)) sfxClick();
    };
    document.addEventListener("pointerdown", onDown, { capture: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", onDown, { capture: true });
      window.removeEventListener("pointerdown", boot, { capture: true });
      window.removeEventListener("keydown", boot, { capture: true });
    };
  }, []);
  return null;
}
