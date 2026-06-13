"use client";

// م7.4 · صور المشروع: رفع مباشر لدلو parcel-photos (خاص — RLS مصادَقين) + روابط موقّعة للعرض + حذف.
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { ParcelKind } from "@/features/map/lib/map-nav-store";

export const BUCKET = "parcel-photos";
export const MAX_PARCEL_PHOTOS = 12;
const MAX_MB = 8;

export interface ParcelPhoto {
  id: string;
  path: string;
  url: string;
}

const ext = (f: File): string => (f.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";

/** رفع صور مشروع لقطعة (تحقّق نوع/حجم) — يعيد عدد المرفوع وأول خطأ إن وُجد. */
export async function uploadParcelPhotos(kind: ParcelKind, refId: string, files: File[], existingCount: number): Promise<{ uploaded: number; error?: string }> {
  const supabase = createClient();
  let uploaded = 0;
  for (const f of files) {
    if (existingCount + uploaded >= MAX_PARCEL_PHOTOS) return { uploaded, error: `الحدّ ${MAX_PARCEL_PHOTOS} صورة للقطعة` };
    if (!f.type.startsWith("image/")) return { uploaded, error: "صور فقط" };
    if (f.size > MAX_MB * 1024 * 1024) return { uploaded, error: `حجم الصورة يتجاوز ${MAX_MB}MB` };
    const path = `${kind}/${refId}/${crypto.randomUUID()}.${ext(f)}`;
    const up = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type });
    if (up.error) return { uploaded, error: up.error.message };
    const ins = await supabase.from("parcel_photos").insert({ kind, ref_id: refId, path });
    if (ins.error) {
      await supabase.storage.from(BUCKET).remove([path]); // لا صفوف يتيمة
      return { uploaded, error: ins.error.message };
    }
    uploaded++;
  }
  return { uploaded };
}

export async function deleteParcelPhoto(id: string, path: string): Promise<{ ok: boolean }> {
  const supabase = createClient();
  const { error } = await supabase.from("parcel_photos").delete().eq("id", id);
  if (error) return { ok: false };
  await supabase.storage.from(BUCKET).remove([path]); // الملف بعد السجل (فشله لا يكسر الواجهة)
  return { ok: true };
}

/** رفع صور زيارة (حتى 3 §ج.8/7) — يعيد مسارات التخزين الجديدة. */
export async function uploadVisitPhotos(visitId: string, files: File[], existing: string[]): Promise<{ paths: string[]; error?: string }> {
  const supabase = createClient();
  const paths: string[] = [];
  for (const f of files) {
    if (existing.length + paths.length >= 3) return { paths, error: "حتى 3 صور للزيارة" };
    if (!f.type.startsWith("image/")) return { paths, error: "صور فقط" };
    if (f.size > MAX_MB * 1024 * 1024) return { paths, error: `حجم الصورة يتجاوز ${MAX_MB}MB` };
    const path = `visits/${visitId}/${crypto.randomUUID()}.${ext(f)}`;
    const up = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type });
    if (up.error) return { paths, error: up.error.message };
    paths.push(path);
  }
  return { paths };
}

/** روابط موقّعة لمسارات (ساعة) — للعرض من الدلو الخاص. */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const supabase = createClient();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

/** صور المشروع لقطعة (سجلات + روابط موقّعة) — مفتاح ["parcel_photos", kind, refId]. */
export function useParcelPhotos(kind: ParcelKind, refId: string) {
  return useQuery({
    queryKey: ["parcel_photos", kind, refId],
    enabled: refId !== "",
    queryFn: async (): Promise<ParcelPhoto[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("parcel_photos")
        .select("id, path")
        .eq("kind", kind)
        .eq("ref_id", refId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as { id: string; path: string }[];
      const urls = await signedUrls(rows.map((r) => r.path));
      return rows.map((r) => ({ id: r.id, path: r.path, url: urls[r.path] ?? "" })).filter((p) => p.url);
    },
  });
}
