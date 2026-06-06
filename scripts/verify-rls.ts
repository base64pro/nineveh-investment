/**
 * تأكيد أنّ anon محجوب عن كل الجداول (RLS مفعّل بلا سياسة anon).
 * يستخدم anon key — يجب أن يعيد 0 صفوف من كل جدول مبذور.
 */
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./lib/env";

const TABLES = ["opportunities", "licenses", "companies", "legal", "legal_documents"] as const;

async function main(): Promise<void> {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const sb = createClient(url, anonKey, { auth: { persistSession: false } });

  let allBlocked = true;
  for (const t of TABLES) {
    const { data, error } = await sb.from(t).select("*").limit(1);
    const rows = data?.length ?? 0;
    const blocked = rows === 0; // RLS يحجب → 0 صفوف (أو خطأ)
    if (!blocked) allBlocked = false;
    console.log(`${blocked ? "✓" : "✗"} anon ${t}: صفوف=${rows}${error ? " (محجوب بخطأ)" : ""}`);
  }

  console.log(
    allBlocked ? "✓ anon محجوب عن كل الجداول (RLS سليم)." : "✗ anon وصل لبيانات — خلل RLS.",
  );
  if (!allBlocked) process.exitCode = 1;
}

void main();
