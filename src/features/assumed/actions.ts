"use server";

// طفرات القطع المفترضة عبر Server Action (§ج.4) ← Postgres ← Realtime.
import { createClient } from "@/lib/supabase/server";
import { sectorCode } from "@/lib/sectors";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveAssumed(
  values: Record<string, unknown>,
  id?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  // الحالة الافتراضية «مفترضة» (§ج.8/9). الهندسة تُرسَم لاحقاً على الخريطة (م2.4).
  const normalized: Record<string, unknown> = { ...values, state: "assumed" };
  if ("sector" in values) normalized.sector = sectorCode(values.sector as string | null);
  if (id) {
    const { error } = await supabase.from("assumed_parcels").update(normalized).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("assumed_parcels").insert(normalized);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteAssumed(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("assumed_parcels").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
