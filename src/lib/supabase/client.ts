import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

/** عميل المتصفّح (مكوّنات العميل). الجلسة بالكوكيز. */
export function createClient() {
  const { url, anonKey } = supabaseEnv();
  return createBrowserClient(url, anonKey);
}
