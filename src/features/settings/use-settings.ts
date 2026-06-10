"use client";

import { useQuery } from "@tanstack/react-query";
import { getSettings } from "./actions";

/** إعدادات المستخدم (غير سرّية + وجود المفاتيح مقنّعاً). */
export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: () => getSettings() });
}
