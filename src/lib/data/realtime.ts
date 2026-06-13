"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

// المصدر الواحد (§ج.4 · §ز.6): أيّ تغيير في الجداول ← إبطال الذاكرة ← انعكاس فوري في كل الأقسام والخريطة.
const TABLES = [
  "opportunities",
  "licenses",
  "companies",
  "criteria",
  "consultations",
  "visits",
  "map_elements",
  "assumed_parcels",
  "parcel_geometry",
  "field_options",
  "parcel_insights",
  "parcel_photos",
] as const;

// جداول تؤثّر في طبقة قطع الخريطة (view map_parcels) ← إبطالها أيضاً.
const PARCEL_TABLES = new Set<string>(["opportunities", "licenses", "assumed_parcels", "parcel_geometry"]);
// إبطال مضيَّق: العدّادات لجداولها المعدودة فقط · إحصاءات الهيدبار لجداولها الأربعة فقط (لا ضجيج).
const COUNTED_TABLES = new Set<string>(["opportunities", "licenses", "companies", "criteria", "consultations", "assumed_parcels"]);
const STATS_TABLES = new Set<string>(["opportunities", "licenses", "companies", "assumed_parcels"]);

export function useRealtimeSync(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("nineveh-db-changes");

    for (const table of TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        void queryClient.invalidateQueries({ queryKey: ["table", table] });
        if (COUNTED_TABLES.has(table)) void queryClient.invalidateQueries({ queryKey: ["counts"] });
        if (STATS_TABLES.has(table)) void queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });
        if (table === "parcel_insights") void queryClient.invalidateQueries({ queryKey: ["insights"] });
        if (table === "map_elements") void queryClient.invalidateQueries({ queryKey: ["map_elements_geo"] });
        if (table === "parcel_photos") void queryClient.invalidateQueries({ queryKey: ["parcel_photos"] });
        if (PARCEL_TABLES.has(table)) {
          void queryClient.invalidateQueries({ queryKey: ["map_parcels"] });
          // القاموس الموحّد (view م7.7) يستمدّ من هذه الجداول ← قيمة جديدة تظهر فوراً في كل المنسدلات
          void queryClient.invalidateQueries({ queryKey: ["table", "field_options"] });
        }
      });
    }
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
