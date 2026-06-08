"use server";

// طفرات المعايير عبر Server Action (§ج.4) ← Postgres ← Realtime.
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveCriterion(
  values: Record<string, unknown>,
  id?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("criteria").update(values).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("criteria").insert(values);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function setCriterionStatus(id: string, status: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("criteria").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteCriterion(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("criteria").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
