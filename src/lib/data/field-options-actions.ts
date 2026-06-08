"use server";

// إضافة خيار معرّف لحقل (قائمة منسدلة قابلة للتوسعة) عبر Server Action.
import { createClient } from "@/lib/supabase/server";

export async function addFieldOption(
  fieldKey: string,
  value: string,
): Promise<{ ok: boolean; error?: string }> {
  const v = value.trim();
  if (!v) return { ok: false, error: "قيمة فارغة" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("field_options")
    .upsert({ field_key: fieldKey, value: v }, { onConflict: "field_key,value" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
