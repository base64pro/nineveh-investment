/** تنظيف · يحذف نماذج STL التجريبية المزروعة (title='نموذج تجريبي (مكعّب)') من القاعدة والتخزين. */
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./lib/env";

async function main(): Promise<void> {
  const sb = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
  const { data, error } = await sb.from("parcel_models").select("id, storage_path").eq("title", "نموذج تجريبي (مكعّب)");
  if (error) throw error;
  const rows = (data ?? []) as { id: string; storage_path: string }[];
  if (!rows.length) {
    console.log("لا نماذج تجريبية لحذفها.");
    return;
  }
  const paths = rows.map((r) => r.storage_path);
  await sb.storage.from("parcel-models").remove(paths);
  const del = await sb.from("parcel_models").delete().in("id", rows.map((r) => r.id));
  if (del.error) throw del.error;
  console.log(`✓ حُذِف ${rows.length} نموذج تجريبي (قاعدة + تخزين).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
