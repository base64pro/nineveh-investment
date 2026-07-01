"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface DashboardStats {
  announced: number;
  licenses: number;
  lic_in_progress: number;
  lic_completed: number;
  lic_withdrawn: number;
  assumed: number;
  companies: number;
  total_area_m2: number;
}

/** إحصاءات الهيدبار اللحظية (حتمية، عبر RPC dashboard_stats). تتحدّث بـRealtime. */
export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard_stats"],
    queryFn: async (): Promise<DashboardStats> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("dashboard_stats");
      if (error) throw error; // م9.12 · نحفظ خطأ supabase الأصليّ (code/status) ليصنّفه معالج الأخطاء المركزيّ (سقوط جلسة ← /login)
      return data as DashboardStats;
    },
  });
}
