"use server";

// طفرات الشركات عبر Server Action (§ج.4) ← Postgres ← Realtime ← انعكاس فوري.
import { createClient } from "@/lib/supabase/server";
import { sectorCode } from "@/lib/sectors";
import { governorateCode } from "@/lib/governorates";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveCompany(
  values: Record<string, unknown>,
  id?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = id ?? crypto.randomUUID();
  const normalized: Record<string, unknown> = { ...values, id: companyId };
  // توحيد القطاع والمحافظة: التسمية العربية ← رمز ثابت للتخزين.
  if ("sector" in values) normalized.sector = sectorCode(values.sector as string | null);
  if ("governorate" in values) normalized.governorate = governorateCode(values.governorate as string | null);
  // is_excluded NOT NULL ← الافتراضي false.
  normalized.is_excluded = values.is_excluded === true;
  const { error } = await supabase.from("companies").upsert(normalized, { onConflict: "id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteCompany(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
