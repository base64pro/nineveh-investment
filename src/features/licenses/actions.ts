"use server";

// طفرات الرخص عبر Server Action (§ج.4) ← Postgres ← Realtime ← انعكاس فوري.
import { createClient } from "@/lib/supabase/server";
import { sectorCode } from "@/lib/sectors";
import { normalizeLicenseStatusForSave } from "./fields";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveLicense(
  values: Record<string, unknown>,
  id?: number,
): Promise<ActionResult> {
  const supabase = await createClient();
  // الحالة: افتراضي «قيد الإنجاز» عند الإنشاء فقط؛ التحديث بلا حالة لا يمسّها (إصلاح انقلاب الحالة).
  const normalized: Record<string, unknown> = normalizeLicenseStatusForSave(values, id !== undefined);
  // توحيد القطاع: التسمية العربية ← رمز ثابت للتخزين (لا تنقسم القيم).
  if ("sector" in values) normalized.sector = sectorCode(values.sector as string | null);
  // فصل صريح: تحديث يضبط الأعمدة المرسلة فقط (upsert كان يفجّر NOT NULL للأعمدة الغائبة — 23502)،
  // وإنشاء يفشل بصوت عند تصادم معرّف بدل الدمج الصامت.
  if (id !== undefined) {
    const { error } = await supabase.from("licenses").update(normalized).eq("record_id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("licenses").insert({ ...normalized, record_id: Date.now(), kind: "license" });
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteLicense(id: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("licenses").delete().eq("record_id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
