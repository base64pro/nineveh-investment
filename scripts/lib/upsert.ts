import type { SupabaseClient } from "@supabase/supabase-js";

/** upsert idempotent على دفعات (إعادة التشغيل آمنة). يتوقّف عند أي خطأ. */
export async function upsertAll(
  sb: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  batchSize = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await sb.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`فشل upsert في ${table}: ${error.message}`);
  }
}
