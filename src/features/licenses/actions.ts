"use server";

// طفرات الرخص عبر Server Action (§ج.4) ← Postgres ← Realtime ← انعكاس فوري.
import { createClient } from "@/lib/supabase/server";
import { sectorCode } from "@/lib/sectors";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveLicense(
  values: Record<string, unknown>,
  id?: number,
): Promise<ActionResult> {
  const supabase = await createClient();
  const record_id = id ?? Date.now();
  const normalized: Record<string, unknown> = { ...values, record_id, kind: "license" };
  // توحيد القطاع: التسمية العربية ← رمز ثابت للتخزين (لا تنقسم القيم).
  if ("sector" in values) normalized.sector = sectorCode(values.sector as string | null);
  // الحالة إلزامية (not null): الافتراضي «قيد الإنجاز».
  if (!normalized.status) normalized.status = "in-progress";
  const { error } = await supabase
    .from("licenses")
    .upsert(normalized, { onConflict: "record_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteLicense(id: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("licenses").delete().eq("record_id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
