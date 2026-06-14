"use client";

// م7.16 · ثبات صارم عند ظهور لوحة المفاتيح (iOS) — طلب معتمد:
// الجذر مثبّت (position:fixed في globals)، وهنا نقيس ارتفاع المنطقة المرئية (VisualViewport) فنحجّم
// التطبيق فوق الكيبورد تماماً — فيبقى الهيدبار وأيقونات السايدبار ثابتين، ولا يصعد التطبيق خارج الشاشة.

import { useEffect } from "react";

export function ViewportFix() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;

    const apply = (): void => {
      const h = vv ? vv.height : window.innerHeight;
      root.style.setProperty("--app-h", `${Math.round(h)}px`);
    };
    apply();

    // أي محاولة من iOS لتمرير الصفحة (لإظهار حقل الإدخال) تُعاد فوراً لأعلى — الهيدبار/السايدبار لا يتحرّكان.
    const lock = (): void => {
      if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
    };

    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("scroll", lock, { passive: true });
    window.addEventListener("orientationchange", apply);
    return () => {
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("scroll", lock);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);
  return null;
}
