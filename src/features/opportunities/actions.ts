"use server";

// طفرات الفرص عبر Server Action (§ج.4) ← Postgres ← Realtime ← انعكاس فوري.
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveOpportunity(
  values: Record<string, unknown>,
  id?: number,
): Promise<ActionResult> {
  const supabase = await createClient();
  const record_id = id ?? Date.now();
  const { error } = await supabase
    .from("opportunities")
    .upsert({ ...values, record_id, kind: "opportunity" }, { onConflict: "record_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteOpportunity(id: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("opportunities").delete().eq("record_id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
