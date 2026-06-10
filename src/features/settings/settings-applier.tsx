"use client";

// يطبّق إعدادات العرض (حجم الخطّ) عند التحميل — مركَّب مرّة في الصفحة المحميّة.
import { useEffect } from "react";
import { useSettings } from "./use-settings";
import { applyFont } from "./apply";

export function SettingsApplier() {
  const { data } = useSettings();
  useEffect(() => {
    if (data?.settings.font_scale) applyFont(data.settings.font_scale);
  }, [data?.settings.font_scale]);
  return null;
}
