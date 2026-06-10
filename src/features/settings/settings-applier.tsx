"use client";

// يطبّق إعدادات العرض المحفوظة عند التحميل (السمة + حجم الخطّ + الكثافة) — عبر الأجهزة، مرّة عند جهوز الإعدادات.
import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useSettings } from "./use-settings";
import { applyDisplay } from "./apply";

export function SettingsApplier() {
  const { data } = useSettings();
  const { setTheme } = useTheme();
  const appliedTheme = useRef(false);

  useEffect(() => {
    const s = data?.settings;
    if (!s) return;
    applyDisplay(s.font_scale, s.density);
    if (!appliedTheme.current) {
      appliedTheme.current = true; // السمة مرّة واحدة عند التحميل (تبديلها الحيّ من اللوحة)
      setTheme(s.theme);
    }
  }, [data?.settings, setTheme]);

  return null;
}
