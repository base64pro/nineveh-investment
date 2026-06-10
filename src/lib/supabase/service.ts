import { createClient } from "@supabase/supabase-js";

/**
 * عميل Supabase بدور **service** — خادمي فقط (يتجاوز RLS).
 * يُستعمَل لقراءة/كتابة الأسرار (app_secrets) والإعدادات الخادمية. **لا يُستورَد في كود العميل أبداً** (القاعدة #6).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("متغيّرات الخدمة (URL / SERVICE_ROLE_KEY) مفقودة.");
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
