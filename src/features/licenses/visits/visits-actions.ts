"use server";

// طفرات الزيارات (§ج.8/7) عبر Server Action ← Postgres ← Realtime.
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export interface VisitValues {
  parcel_ref: string;
  visit_date: string;
  visit_type: string | null;
  staff: string | null;
  notes: string | null;
  photos?: string[]; // مسارات تخزين (حتى 3 §ج.8/7)
}

export async function saveVisit(values: VisitValues, id?: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("visits").update(values).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("visits").insert(values);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteVisit(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("visits").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
