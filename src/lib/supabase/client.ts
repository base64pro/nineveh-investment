import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

// عميل متصفّح مفرد (يُشارَك بين الاستعلامات والاشتراك اللحظي). الجلسة بالكوكيز.
let client: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  if (!client) {
    const { url, anonKey } = supabaseEnv();
    client = createBrowserClient(url, anonKey);
  }
  return client;
}
