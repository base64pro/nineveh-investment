import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";

/** عميل خادمي بصلاحية service_role (يتجاوز RLS) — للاستيراد فقط. */
export function adminClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
