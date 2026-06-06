/**
 * تأكيد وجود مستخدم المصادقة (دون كلمة مرور) عبر admin API.
 * الاستخدام: npm run verify:user [email]
 */
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./lib/env";

const EMAIL = process.argv[2] ?? "admin@nineveh-investment.com";

async function main(): Promise<void> {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data, error } = await sb.auth.admin.listUsers();
  if (error) throw new Error(error.message);

  const user = data.users.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase());
  if (!user) {
    console.log(`✗ المستخدم ${EMAIL} غير موجود — أنشئه في لوحة Supabase Auth (Add user + Auto Confirm).`);
    process.exitCode = 1;
    return;
  }
  console.log(`✓ المستخدم ${EMAIL} موجود · مؤكَّد البريد: ${user.email_confirmed_at ? "نعم" : "لا"}`);
}

void main();
