"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

const PAGE = 1000; // سقف PostgREST لكل طلب — نجلب صفحات حتى النهاية (لا اقتطاع صامت عند نموّ البيانات)

// مفتاح الترتيب الأساسي لكل جدول — ترقيم بلا order غير مستقر في PostgREST (تكرار/فقدان صفوف بين الصفحات)
const PK: Record<string, string> = {
  opportunities: "record_id",
  licenses: "record_id",
  legal: "record_id",
  companies: "id",
  criteria: "id",
  consultations: "id",
  visits: "id",
  map_elements: "id",
  assumed_parcels: "id",
  parcel_geometry: "id",
  field_options: "value",
  parcel_photos: "id",
};

/** قراءة عامّة لجدول (مفتاح ذاكرة ["table", name]) — يُبطلها التزامن اللحظي. تجلب كل الصفوف مهما كبر الجدول. */
export function useTable<T>(table: string) {
  return useQuery({
    queryKey: ["table", table],
    queryFn: async (): Promise<T[]> => {
      const supabase = createClient();
      const all: T[] = [];
      const orderKey = PK[table] ?? "id";
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase.from(table).select("*").order(orderKey, { ascending: true }).range(from, from + PAGE - 1);
        if (error) throw new Error(error.message);
        const page = (data ?? []) as T[];
        all.push(...page);
        if (page.length < PAGE) break;
      }
      return all;
    },
  });
}
