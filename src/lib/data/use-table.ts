"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

const PAGE = 1000; // سقف PostgREST لكل طلب — نجلب صفحات حتى النهاية (لا اقتطاع صامت عند نموّ البيانات)

/** قراءة عامّة لجدول (مفتاح ذاكرة ["table", name]) — يُبطلها التزامن اللحظي. تجلب كل الصفوف مهما كبر الجدول. */
export function useTable<T>(table: string) {
  return useQuery({
    queryKey: ["table", table],
    queryFn: async (): Promise<T[]> => {
      const supabase = createClient();
      const all: T[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase.from(table).select("*").range(from, from + PAGE - 1);
        if (error) throw new Error(error.message);
        const page = (data ?? []) as T[];
        all.push(...page);
        if (page.length < PAGE) break;
      }
      return all;
    },
  });
}
