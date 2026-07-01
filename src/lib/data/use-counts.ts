"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

const COUNT_TABLES = [
  "opportunities",
  "licenses",
  "companies",
  "criteria",
  "consultations",
  "assumed_parcels",
] as const;

/** عدّادات لحظية لكل قسم (تتحدّث آلياً عبر Realtime). */
export function useCounts() {
  return useQuery({
    queryKey: ["counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const supabase = createClient();
      const entries = await Promise.all(
        COUNT_TABLES.map(async (table) => {
          const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
          if (error) throw error; // م9.12 · خطأ supabase الأصليّ (code/status) للتصنيف المركزيّ
          return [table, count ?? 0] as const;
        }),
      );
      return Object.fromEntries(entries);
    },
  });
}
