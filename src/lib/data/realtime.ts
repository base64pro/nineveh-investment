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
] as const;

// جداول تؤثّر في طبقة قطع الخريطة (view map_parcels) ← إبطالها أيضاً.
const PARCEL_TABLES = new Set<string>(["opportunities", "licenses", "assumed_parcels", "parcel_geometry"]);

export function useRealtimeSync(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("nineveh-db-changes");

    for (const table of TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        void queryClient.invalidateQueries({ queryKey: ["table", table] });
        void queryClient.invalidateQueries({ queryKey: ["counts"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });
        if (PARCEL_TABLES.has(table)) void queryClient.invalidateQueries({ queryKey: ["map_parcels"] });
      });
    }
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
