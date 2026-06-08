"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/** خيارات الحقول المعرّفة (field_key → قيم) — تتحدّث لحظياً. */
export function useFieldOptions() {
  return useQuery({
    queryKey: ["table", "field_options"],
    queryFn: async (): Promise<Record<string, string[]>> => {
      const supabase = createClient();
      const { data, error } = await supabase.from("field_options").select("field_key,value");
      if (error) throw new Error(error.message);
      const map: Record<string, string[]> = {};
      for (const row of (data ?? []) as { field_key: string; value: string }[]) {
        (map[row.field_key] ??= []).push(row.value);
      }
      return map;
    },
  });
}
