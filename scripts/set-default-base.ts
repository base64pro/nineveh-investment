/** م9.7 · يضبط أساس الخريطة الافتراضي في الإعدادات إلى القمر الصناعي (صفّ الإعدادات المفرد id=1). */
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./lib/env";

async function main(): Promise<void> {
  const sb = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
  const { error } = await sb.from("settings").update({ default_base: "satellite" }).eq("id", 1);
  if (error) throw error;
  console.log("✓ أساس الخريطة الافتراضي = satellite (الإعدادات).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
