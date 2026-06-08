"use server";

// نقل القطعة بين الحالات الخمس (§هـ.4 · م3.5) عبر RPC ذرّي move_parcel ← Postgres ← Realtime.
import { createClient } from "@/lib/supabase/server";
import type { ParcelKind } from "@/features/map/lib/map-nav-store";

export type MoveResult = { ok: true; kind: ParcelKind; id: string } | { ok: false; error: string };

export async function moveParcel(kind: ParcelKind, id: string, targetState: string): Promise<MoveResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("move_parcel", {
    p_source_kind: kind,
    p_source_id: id,
    p_target_state: targetState,
  });
  if (error) return { ok: false, error: error.message };
  const ref = data as { kind: ParcelKind; id: string };
  return { ok: true, kind: ref.kind, id: ref.id };
}
