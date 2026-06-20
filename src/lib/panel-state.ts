"use client";

// م8.9 · تخزين حالة لوحات الفرص/الرخص في ذاكرة الوحدة فقط: تصمد عبر **فتح/إغلاق التاب** (لا تُفقد عند
// تفكيك اللوحة)، وتُصفَّر تلقائياً عند **إعادة تحميل الصفحة = دخول/خروج النظام** (لأن الوحدة تُعاد تهيئتها).
import { useEffect, useRef, useState } from "react";

const store = new Map<string, unknown>();

export function getPanelState<T>(key: string, fallback: T): T {
  return store.has(key) ? (store.get(key) as T) : fallback;
}
export function setPanelState(key: string, value: unknown): void {
  store.set(key, value);
}

/** useState يصمد في مخزن الذاكرة بمفتاح ثابت — بديل مباشر لـuseState (يُصفَّر عند إعادة تحميل الصفحة فقط). */
export function usePersistentState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => getPanelState(key, initial));
  useEffect(() => {
    setPanelState(key, value);
  }, [key, value]);
  return [value, setValue];
}

/** يحفظ/يستعيد موضع تمرير حاوية بمفتاح ثابت — يصمد عبر فتح/إغلاق التاب (الاستعادة مرّة واحدة بعد جاهزية البيانات). */
export function usePersistentScroll(key: string, ref: React.RefObject<HTMLElement | null>, ready: boolean): void {
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !ready) return;
    const el = ref.current;
    if (!el) return;
    restored.current = true;
    const saved = getPanelState<number>(`${key}:scroll`, 0);
    if (saved > 0) requestAnimationFrame(() => {
      if (ref.current) ref.current.scrollTop = saved;
    });
  }, [key, ref, ready]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = (): void => setPanelState(`${key}:scroll`, el.scrollTop);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [key, ref]);
}
