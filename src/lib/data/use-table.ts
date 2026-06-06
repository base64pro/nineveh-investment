"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/** قراءة عامّة لجدول (مفتاح ذاكرة ["table", name]) — يُبطلها التزامن اللحظي. */
export function useTable<T>(table: string) {
  return useQuery({
    queryKey: ["table", table],
    queryFn: async (): Promise<T[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.from(table).select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as T[];
    },
  });
}
