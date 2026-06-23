"use client";

// م9.1 · مجسّمات القطع ثلاثية الأبعاد (الخارطة الاستثمارية): رفع لدلو parcel-models الخاص (الرفع/الحذف للمدير عبر RLS)
// + روابط موقّعة للعرض + حذف. النموذج «تصوّر تصميمي» (is_conceptual) — صفر تأليف. الصيغ: glb (أساسي) · gltf · stl (سكتشب ويب).
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { ParcelKind } from "@/features/map/lib/map-nav-store";

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
        .map((r) => ({ id: r.id, path: r.storage_path, format: r.format, title: r.title, isConceptual: r.is_conceptual, transform: r.transform ?? {}, url: urls[r.storage_path] ?? "" }))
        .filter((m) => m.url);
    },
  });
}
