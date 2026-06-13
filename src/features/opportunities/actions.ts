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
  // توحيد القطاع: التسمية العربية ← رمز ثابت للتخزين (لا تنقسم القيم).
  const normalized = "sector" in values ? { ...values, sector: sectorCode(values.sector as string | null) } : values;
  // فصل صريح: تحديث يضبط الأعمدة المرسلة فقط، وإنشاء يفشل بصوت عند تصادم معرّف (لا دمج صامت).
  if (id !== undefined) {
    const { error } = await supabase.from("opportunities").update(normalized).eq("record_id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("opportunities").insert({ ...normalized, record_id: Date.now(), kind: "opportunity" });
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteOpportunity(id: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("opportunities").delete().eq("record_id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
