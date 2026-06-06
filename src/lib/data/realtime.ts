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
] as const;

export function useRealtimeSync(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("nineveh-db-changes");

    for (const table of TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        void queryClient.invalidateQueries({ queryKey: ["table", table] });
        void queryClient.invalidateQueries({ queryKey: ["counts"] });
      });
    }
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
