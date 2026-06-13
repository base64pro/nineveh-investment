"use server";

// م7.3 · أفعال الطبقة المحرَّرة (§ج.8/8): إنشاء (RPC للهندسة) · إعادة تسمية · حذف.
import { createClient } from "@/lib/supabase/server";
import type { Geometry } from "geojson";

type Result = { ok: true } | { ok: false; error: string };

export async function createMapElement(name: string, elementType: string, geometry: Geometry): Promise<Result> {
  const n = name.trim();
  if (!n) return { ok: false, error: "الاسم مطلوب" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_map_element", { p_name: n, p_type: elementType, p_geom: geometry });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function renameMapElement(id: string, name: string, elementType: string): Promise<Result> {
  const n = name.trim();
  if (!n) return { ok: false, error: "الاسم مطلوب" };
  const supabase = await createClient();
  const { error } = await supabase.from("map_elements").update({ name: n, label: n, element_type: elementType }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteMapElement(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("map_elements").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
