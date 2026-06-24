"use client";

// م9.1 · مجسّمات القطع ثلاثية الأبعاد (الخارطة الاستثمارية): رفع لدلو parcel-models الخاص (الرفع/الحذف للمدير عبر RLS)
// + روابط موقّعة للعرض + حذف. النموذج «تصوّر تصميمي» (is_conceptual) — صفر تأليف. الصيغ: glb (أساسي) · gltf · stl (سكتشب ويب).
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { ParcelKind } from "@/features/map/lib/map-nav-store";
import type { ModelKind } from "@/features/map/lib/parametric-tower";

export const BUCKET = "parcel-models";
export const MAX_PARCEL_MODELS = 4; // عدّة بدائل تصميمية للقطعة (يُعرَض الأحدث افتراضياً)
const MAX_MB = 40; // glb/stl أثقل من الصور
const ALLOWED = ["glb", "gltf", "stl"] as const;
export type ModelFormat = (typeof ALLOWED)[number];

// تحويل فضائي للمجسّم فوق القطعة (المرساة الافتراضية = مركز القطعة المحسوب)
export interface ModelTransform {
  scale?: number; // معامل حجم موحّد
  rotationDeg?: number; // دوران حول المحور الرأسي (yaw)
  elevationM?: number; // إزاحة رأسية بالمتر
  anchorOverride?: [number, number]; // [lng,lat] إن لزم تجاوز المركز
}

export interface ParcelModel {
  id: string;
  refId: string;
  path: string;
  format: ModelFormat;
  title: string | null;
  isConceptual: boolean;
  transform: ModelTransform;
  url: string;
}

const ext = (f: File): string => (f.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** صيغة النموذج من الامتداد (للعارض) — null إن غير مدعومة. */
export function modelFormatOf(f: File): ModelFormat | null {
  const e = ext(f);
  return (ALLOWED as readonly string[]).includes(e) ? (e as ModelFormat) : null;
}

/** رفع مجسّم 3D لقطعة (تحقّق صيغة/حجم) — يعيد المعرّف الجديد أو أول خطأ. التحقّق بالامتداد (MIME الـ3D غير موثوق). */
export async function uploadParcelModel(
  kind: ParcelKind,
  refId: string,
  file: File,
  transform: ModelTransform,
  opts?: { title?: string; isConceptual?: boolean; existingCount?: number },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = createClient();
  if ((opts?.existingCount ?? 0) >= MAX_PARCEL_MODELS) return { ok: false, error: `الحدّ ${MAX_PARCEL_MODELS} نماذج للقطعة` };
  const fmt = modelFormatOf(file);
  if (!fmt) return { ok: false, error: "صيغة غير مدعومة (glb · gltf · stl)" };
  if (file.size > MAX_MB * 1024 * 1024) return { ok: false, error: `حجم الملف يتجاوز ${MAX_MB}MB` };
  const path = `${kind}/${refId}/${crypto.randomUUID()}.${fmt}`;
  const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (up.error) return { ok: false, error: up.error.message };
  const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
  const ins = await supabase
    .from("parcel_models")
    .insert({ kind, ref_id: refId, storage_path: path, format: fmt, transform, title: opts?.title ?? null, is_conceptual: opts?.isConceptual ?? true, uploaded_by: uid })
    .select("id")
    .single();
  if (ins.error || !ins.data) {
    await supabase.storage.from(BUCKET).remove([path]); // لا صفوف يتيمة
    return { ok: false, error: ins.error?.message ?? "تعذّر الحفظ" };
  }
  return { ok: true, id: (ins.data as { id: string }).id };
}

/** تحديث تحويل/عنوان مجسّم قائم (للمحرّر). */
export async function updateParcelModel(id: string, patch: { transform?: ModelTransform; title?: string | null }): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.transform !== undefined) row.transform = patch.transform;
  if (patch.title !== undefined) row.title = patch.title;
  const { error } = await supabase.from("parcel_models").update(row).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteParcelModel(id: string, path: string): Promise<{ ok: boolean }> {
  const supabase = createClient();
  const { error } = await supabase.from("parcel_models").delete().eq("id", id);
  if (error) return { ok: false };
  await supabase.storage.from(BUCKET).remove([path]); // الملف بعد السجل (فشله لا يكسر الواجهة)
  return { ok: true };
}

/** روابط موقّعة لمسارات (ساعة) — للعرض من الدلو الخاص. */
export async function signedUrlsForModels(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const supabase = createClient();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

/** مجسّمات قطعة (سجلات + روابط موقّعة) — مفتاح ["parcel_models", kind, refId]. */
export function useParcelModels(kind: ParcelKind, refId: string) {
  return useQuery({
    queryKey: ["parcel_models", kind, refId],
    enabled: refId !== "",
    queryFn: async (): Promise<ParcelModel[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("parcel_models")
        .select("id, storage_path, format, title, is_conceptual, transform")
        .eq("kind", kind)
        .eq("ref_id", refId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as { id: string; storage_path: string; format: ModelFormat; title: string | null; is_conceptual: boolean; transform: ModelTransform | null }[];
      const urls = await signedUrlsForModels(rows.map((r) => r.storage_path));
      return rows
        .map((r) => ({ id: r.id, refId, path: r.storage_path, format: r.format, title: r.title, isConceptual: r.is_conceptual, transform: r.transform ?? {}, url: urls[r.storage_path] ?? "" }))
        .filter((m) => m.url);
    },
  });
}

/** كل مجسّمات القطع المفترضة (للعرض على الخريطة) — صفوف + روابط موقّعة · مفتاح ["parcel_models","assumed-all"]. */
export function useAssumedModels() {
  return useQuery({
    queryKey: ["parcel_models", "assumed-all"],
    queryFn: async (): Promise<ParcelModel[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("parcel_models")
        .select("id, ref_id, storage_path, format, title, is_conceptual, transform")
        .eq("kind", "assumed")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as { id: string; ref_id: string; storage_path: string; format: ModelFormat; title: string | null; is_conceptual: boolean; transform: ModelTransform | null }[];
      // أحدث نموذج لكل قطعة (refId) — نموذج واحد فعّال للعرض
      const seen = new Set<string>();
      const latest = rows.filter((r) => (seen.has(r.ref_id) ? false : (seen.add(r.ref_id), true)));
      const urls = await signedUrlsForModels(latest.map((r) => r.storage_path));
      return latest
        .map((r) => ({ id: r.id, refId: r.ref_id, path: r.storage_path, format: r.format, title: r.title, isConceptual: r.is_conceptual, transform: r.transform ?? {}, url: urls[r.storage_path] ?? "" }))
        .filter((m) => m.url);
    },
  });
}

// م9.7.1ب · إعداد النموذج البارامتري للقطعة (يُختار من المنسدلة) — يُعرَض حين لا مجسّم مرفوع.
export type ParametricDistribution = "grid" | "row" | "scatter";
export interface ParcelParametric {
  modelKind: ModelKind;
  count: number;
  distribution: ParametricDistribution;
  rotationDeg: number; // م9.7.8 · توجيه المجسّم 360°
  widthM: number | null; // م9.7.8 · أبعاد يدويّة (فارغ = اشتقاق تلقائيّ)
  depthM: number | null;
  heightM: number | null;
}

/** حفظ/تحديث إعداد النموذج البارامتري لقطعة (upsert على kind+ref_id) — للمدير. */
export async function upsertParcelParametric(kind: ParcelKind, refId: string, cfg: ParcelParametric): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
  const { error } = await supabase.from("parcel_parametric_models").upsert(
    {
      kind,
      ref_id: refId,
      model_kind: cfg.modelKind,
      count: cfg.count,
      distribution: cfg.distribution,
      rotation_deg: Math.round(cfg.rotationDeg) % 360,
      width_m: cfg.widthM,
      depth_m: cfg.depthM,
      height_m: cfg.heightM,
      created_by: uid,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "kind,ref_id" },
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** حذف إعداد النموذج البارامتري (عودة للسلوك الافتراضي). */
export async function clearParcelParametric(kind: ParcelKind, refId: string): Promise<{ ok: boolean }> {
  const supabase = createClient();
  const { error } = await supabase.from("parcel_parametric_models").delete().eq("kind", kind).eq("ref_id", refId);
  return { ok: !error };
}

type PRow = { ref_id: string; model_kind: ModelKind; count: number; distribution: ParametricDistribution; rotation_deg: number; width_m: number | null; depth_m: number | null; height_m: number | null };
const SEL = "ref_id, model_kind, count, distribution, rotation_deg, width_m, depth_m, height_m";
const toCfg = (r: Omit<PRow, "ref_id">): ParcelParametric => ({ modelKind: r.model_kind, count: r.count, distribution: r.distribution, rotationDeg: r.rotation_deg ?? 0, widthM: r.width_m, depthM: r.depth_m, heightM: r.height_m });

/** إعداد قطعة واحدة — مفتاح ["parcel_parametric", kind, refId]. */
export function useParcelParametric(kind: ParcelKind, refId: string) {
  return useQuery({
    queryKey: ["parcel_parametric", kind, refId],
    enabled: refId !== "",
    queryFn: async (): Promise<ParcelParametric | null> => {
      const supabase = createClient();
      const { data, error } = await supabase.from("parcel_parametric_models").select(SEL).eq("kind", kind).eq("ref_id", refId).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return toCfg(data as Omit<PRow, "ref_id">);
    },
  });
}

/** كل إعدادات القطع المفترضة (للخريطة) — Map<refId, إعداد> · مفتاح ["parcel_parametric","assumed-all"]. */
export function useAssumedParametric() {
  return useQuery({
    queryKey: ["parcel_parametric", "assumed-all"],
    queryFn: async (): Promise<Map<string, ParcelParametric>> => {
      const supabase = createClient();
      const { data, error } = await supabase.from("parcel_parametric_models").select(SEL).eq("kind", "assumed");
      if (error) throw new Error(error.message);
      const out = new Map<string, ParcelParametric>();
      for (const r of (data ?? []) as PRow[]) out.set(r.ref_id, toCfg(r));
      return out;
    },
  });
}
