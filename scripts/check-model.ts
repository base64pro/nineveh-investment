/** تشخيص (قراءة فقط) · يتحقّق من نموذج parcel_models: رابط موقّع + جلب + تحليل STL. لا يكتب شيئاً. */
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./lib/env";

async function main(): Promise<void> {
  const sb = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
  const { data, error } = await sb.from("parcel_models").select("id, ref_id, storage_path, format, transform").order("created_at", { ascending: false });
  if (error) throw error;
  console.log(`صفوف parcel_models: ${data?.length ?? 0}`);
  for (const row of data ?? []) {
    console.log(`- ${row.format} · ref_id=${row.ref_id} · path=${row.storage_path} · transform=${JSON.stringify(row.transform)}`);
    const sign = await sb.storage.from("parcel-models").createSignedUrl(row.storage_path as string, 600);
    if (sign.error || !sign.data?.signedUrl) {
      console.log(`  ✗ توقيع الرابط فشل: ${sign.error?.message}`);
      continue;
    }
    try {
      const res = await fetch(sign.data.signedUrl);
      const buf = Buffer.from(await res.arrayBuffer());
      console.log(`  ↳ جلب ${res.status} · ${buf.length} بايت · content-type=${res.headers.get("content-type")}`);
      if (row.format === "stl" && buf.length >= 84) {
        const tri = buf.readUInt32LE(80);
        console.log(`  ↳ STL: ${tri} مثلّث · حجم متوقّع ${84 + tri * 50} بايت`);
      }
    } catch (e) {
      console.log(`  ✗ جلب فشل: ${(e as Error).message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
