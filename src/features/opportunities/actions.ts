"use server";

// طفرات الفرص عبر Server Action (§ج.4) ← Postgres ← Realtime ← انعكاس فوري.
import { createClient } from "@/lib/supabase/server";
import { sectorCode } from "@/lib/sectors";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveOpportunity(
  values: Record<string, unknown>,
  id?: number,
): Promise<ActionResult> {
  const supabase = await createClient();
  const record_id = id ?? Date.now();
  // توحيد القطاع: التسمية العربية ← رمز ثابت للتخزين (لا تنقسم القيم).
  const normalized = "sector" in values ? { ...values, sector: sectorCode(values.sector as string | null) } : values;
  const { error } = await supabase
    .from("opportunities")
    .upsert({ ...normalized, record_id, kind: "opportunity" }, { onConflict: "record_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteOpportunity(id: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("opportunities").delete().eq("record_id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
