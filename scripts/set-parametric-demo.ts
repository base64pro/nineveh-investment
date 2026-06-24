/** م9.7.1ب (تحقّق) · يضبط إعداد النموذج البارامتري لقطع مفترضة بالاسم لاختبار المنسدلة/التوزيع.
 * موول → مول ×4 شبكة · ليث → فندق ×1 · مبنى تجاري تسوقي → برج ×1. service-role (تجاوز RLS للاختبار). */
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./lib/env";

const PLAN: { name: string; model_kind: string; count: number; distribution: string }[] = [
  { name: "موول", model_kind: "mall", count: 1, distribution: "grid" },
  { name: "ليث", model_kind: "hotel", count: 1, distribution: "grid" },
  { name: "مبنى تجاري تسوقي", model_kind: "tower", count: 1, distribution: "grid" },
];

async function main(): Promise<void> {
  const sb = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: parcels, error } = await sb.from("assumed_parcels").select("id, name");
  if (error) throw error;
  for (const p of PLAN) {
    const row = (parcels ?? []).find((x) => (x.name as string) === p.name);
    if (!row) {
      console.log(`… لم تُوجد القطعة «${p.name}»`);
      continue;
    }
    const { error: e2 } = await sb
      .from("parcel_parametric_models")
      .upsert({ kind: "assumed", ref_id: row.id, model_kind: p.model_kind, count: p.count, distribution: p.distribution, updated_at: new Date().toISOString() }, { onConflict: "kind,ref_id" });
    if (e2) throw e2;
    console.log(`✓ «${p.name}» → ${p.model_kind} ×${p.count} (${p.distribution})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
