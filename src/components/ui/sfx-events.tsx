"use client";

// م7.9/م8.7 · مستمع أصوات الواجهة العام: نقرة رقمية لأي زر/تاب/رابط/مدخل اختيار في النظام كله —
// مستمع واحد مفوَّض على المستند، يعمل بأول إيماءة (سياسة autoplay).
// م8.7: الصوت عند **نقر فعلي فقط** — يُفتَح السياق على pointerdown (ضروري لسياسة autoplay) لكن النغمة
// تُطلَق على pointerup إن كانت الحركة أقلّ من عتبة (نقرة لا تمرير/سحب)، فلا صوت عند تمرير قائمة البطاقات.

import { useEffect } from "react";
import { sfxBoot, sfxClick, unlockSfx } from "@/lib/sfx";

const CLICKABLE = 'button, [role="button"], [role="tab"], a, input[type="checkbox"], input[type="radio"], select, [role="option"]';
const TAP_SLOP = 10; // px — إن تجاوزتها الحركة بين النزول والرفع فهي تمرير/سحب لا نقر

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

    // بوّابة النقر: نسجّل بداية المؤشّر؛ ولا نُطلق الصوت إلا عند الرفع بحركة ضئيلة فوق عنصر تفاعلي.
    let startId = -1;
    let startX = 0;
    let startY = 0;
    let armed = false; // النزول وقع فوق عنصر تفاعلي

    const onDown = (e: PointerEvent): void => {
      unlockSfx(); // ضمان فتح السياق ضمن إيماءة المستخدم (لا صوت هنا)
      const el = e.target as Element | null;
      armed = !!el?.closest?.(CLICKABLE);
      startId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
    };
    const onUp = (e: PointerEvent): void => {
      if (!armed || e.pointerId !== startId) return;
      armed = false;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > TAP_SLOP) return; // تمرير/سحب — لا صوت
      const el = e.target as Element | null;
      if (el?.closest?.('[data-sfx="off"]')) return; // أزرار الطيران: يُسمَع صوت الطيران فقط بلا نقرة
      if (el?.closest?.(CLICKABLE)) sfxClick();
    };
    const onCancel = (): void => {
      armed = false;
    };

    document.addEventListener("pointerdown", onDown, { capture: true, passive: true });
    document.addEventListener("pointerup", onUp, { capture: true, passive: true });
    document.addEventListener("pointercancel", onCancel, { capture: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", onDown, { capture: true });
      document.removeEventListener("pointerup", onUp, { capture: true });
      document.removeEventListener("pointercancel", onCancel, { capture: true });
      window.removeEventListener("pointerdown", boot, { capture: true });
      window.removeEventListener("keydown", boot, { capture: true });
    };
  }, []);
  return null;
}
