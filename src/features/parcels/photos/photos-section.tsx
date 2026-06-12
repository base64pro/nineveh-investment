"use client";

// م7.4 · قسم صور المشروع في نافذة القطعة: شبكة مصغّرات + رفع متعدد + حذف — تظهر في بطاقة الخريطة أيضاً.

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import type { ParcelKind } from "@/features/map/lib/map-nav-store";
import { deleteParcelPhoto, MAX_PARCEL_PHOTOS, uploadParcelPhotos, useParcelPhotos } from "./photo-lib";

export function PhotosSection({ kind, refId, readOnly }: { kind: ParcelKind; refId: string; readOnly: boolean }) {
  const { data: photos = [], isLoading } = useParcelPhotos(kind, refId);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: ["parcel_photos", kind, refId] });
  }

  async function onFiles(list: FileList | null): Promise<void> {
    const files = Array.from(list ?? []);
    if (!files.length || busy) return;
    setBusy(true);
    const res = await uploadParcelPhotos(kind, refId, files, photos.length);
    setBusy(false);
    if (res.uploaded > 0) {
      toast.success(`رُفِعت ${formatNumber(res.uploaded)} صورة`);
      invalidate();
    }
    if (res.error) toast.error(res.error);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onDelete(id: string, path: string): Promise<void> {
    if (!window.confirm("حذف هذه الصورة؟")) return;
    const res = await deleteParcelPhoto(id, path);
    if (res.ok) {
      toast.success("حُذِفت الصورة");
      invalidate();
    } else {
      toast.error("تعذّر الحذف");
    }
  }

  return (
    <section className="rounded-xl border border-border/60 bg-background/40 p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-xs font-bold text-primary/80">
          <Camera className="size-3.5" /> صور المشروع
          <span className="rounded bg-secondary/60 px-1.5 text-[10px] text-secondary-foreground">{formatNumber(photos.length)}</span>
        </h4>
        {!readOnly ? (
          <>
            <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onFiles(e.target.files)} />
            <button
              type="button"
              disabled={busy || photos.length >= MAX_PARCEL_PHOTOS}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1.5 text-[11px] font-semibold transition hover:bg-accent disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
              {busy ? "جارٍ الرفع…" : "إضافة صور"}
            </button>
          </>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">تُحمَّل الصور…</p>
      ) : photos.length === 0 ? (
        <p className="text-xs text-muted-foreground">لا صور بعد{readOnly ? "" : " — أضف صور المشروع لتظهر هنا وفي بطاقة الخريطة"}.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl ring-1 ring-inset ring-border/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="صورة المشروع" loading="lazy" className="size-full object-cover transition duration-300 group-hover:scale-105" />
              {!readOnly ? (
                <button
                  type="button"
                  onClick={() => void onDelete(p.id, p.path)}
                  aria-label="حذف الصورة"
                  title="حذف"
                  className={cn(
                    "absolute end-1 top-1 grid size-7 place-items-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur transition",
                    "group-hover:opacity-100 focus:opacity-100",
                  )}
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
