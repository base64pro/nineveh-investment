"use server";

// م7.1 · تحديث هندسة قطعة مرسومة (وضع «تحرير الرسم» §هـ.4) عبر RPC update_parcel_geom.
import { createClient } from "@/lib/supabase/server";
import type { Geometry } from "geojson";

export type GeomResult = { ok: true } | { ok: false; error: string };

export async function updateParcelGeometry(kind: string, refId: string, geometry: Geometry): Promise<GeomResult> {
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") {
    return { ok: false, error: "هندسة غير مدعومة" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_parcel_geom", { p_kind: kind, p_ref_id: refId, p_geom: geometry });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** إزالة رسمة قطعة من الخريطة (فكّ الارتباط §هـ.4) — البيانات تبقى سليمة في جدولها. */
export async function deleteParcelGeometry(kind: string, refId: string): Promise<GeomResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_parcel_geom", { p_kind: kind, p_ref_id: refId });
  return error ? { ok: false, error: error.message } : { ok: true };
}
