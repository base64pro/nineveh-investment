"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * القاموس الموحّد لخيارات المنسدلات (field_key → قيم) — يتحدّث لحظياً.
 * المصدر view «field_value_options» (م7.7): المعرّف يدوياً ∪ المستعمل فعلاً في الفرص/الرخص/المفترضة،
 * فتظهر أي قيمة عرّفها المستخدم من أي نافذة في كل منسدلات النظام بنفس القيم.
 */
export function useFieldOptions() {
  return useQuery({
    queryKey: ["table", "field_options"],
    queryFn: async (): Promise<Record<string, string[]>> => {
      const supabase = createClient();
      const { data, error } = await supabase.from("field_value_options").select("field_key,value");
      if (error) throw error; // م9.12 · خطأ supabase الأصليّ (code/status) للتصنيف المركزيّ
      const map: Record<string, string[]> = {};
      for (const row of (data ?? []) as { field_key: string; value: string }[]) {
        (map[row.field_key] ??= []).push(row.value);
      }
      return map;
    },
  });
}
