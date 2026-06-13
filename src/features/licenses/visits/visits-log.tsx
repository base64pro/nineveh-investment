"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Camera, ClipboardList, Loader2, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { useTable } from "@/lib/data/use-table";
import { Button } from "@/components/ui/button";
import { formatDate, orNA } from "@/lib/display";
import { signedUrls, uploadVisitPhotos } from "@/features/parcels/photos/photo-lib";
import { saveVisit, deleteVisit } from "./visits-actions";
import { useRole } from "@/features/auth/role-context";
import type { Visit } from "@/types/entities";

/** مصغّرات صور زيارة (روابط موقّعة من الدلو الخاص). */
function VisitThumbs({ paths }: { paths: string[] }) {
  const { data: urls } = useQuery({
    queryKey: ["visit_thumbs", paths.join("|")],
    enabled: paths.length > 0,
    queryFn: () => signedUrls(paths),
  });
  if (!paths.length) return null;
  return (
    <div className="mt-1.5 flex gap-1.5">
      {paths.map((p) => {
        const u = urls?.[p];
        return u ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p} src={u} alt="صورة زيارة" loading="lazy" className="size-14 rounded-lg object-cover ring-1 ring-inset ring-border/50" />
        ) : (
          <span key={p} className="grid size-14 place-items-center rounded-lg bg-secondary/40 ring-1 ring-inset ring-border/50">
            <Camera className="size-4 text-muted-foreground" />
          </span>
        );
      })}
    </div>
  );
}

const INPUT = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";

// سجلّ الزيارات لرخصة (§هـ.1 · §ج.8/7) — مرتبط عبر parcel_ref = معرّف الرخصة.
export function VisitsLog({ parcelRef }: { parcelRef: string }) {
  const { data } = useTable<Visit>("visits");
  const queryClient = useQueryClient();
  const { isViewer } = useRole(); // الثاني: عرض السجلّ فقط — لا إضافة/تعديل/حذف (م8.1)
  const [editing, setEditing] = useState<Visit | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null); // بديل <form> لتجنّب تداخل النماذج (نافذة القطعة فيها <form>)
  // صور الزيارة (حتى 3 §ج.8/7) — تُرفَع فوراً وتُحفَظ مساراتها مع الزيارة
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const { data: formThumbs } = useQuery({
    queryKey: ["visit_thumbs", photoPaths.join("|")],
    enabled: photoPaths.length > 0,
    queryFn: () => signedUrls(photoPaths),
  });

  async function onPickPhotos(list: FileList | null): Promise<void> {
    const files = Array.from(list ?? []);
    if (!files.length || uploadingPhoto) return;
    setUploadingPhoto(true);
    const res = await uploadVisitPhotos(editing?.id ?? crypto.randomUUID(), files, photoPaths);
    setUploadingPhoto(false);
    if (res.paths.length) setPhotoPaths((p) => [...p, ...res.paths].slice(0, 3));
    if (res.error) toast.error(res.error);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  const visits = useMemo(
    () =>
      (data ?? [])
        .filter((v) => v.parcel_ref === parcelRef)
        .sort((a, b) => (b.visit_date ?? "").localeCompare(a.visit_date ?? "")),
    [data, parcelRef],
  );

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["table", "visits"] });
  }

  async function onSubmit() {
    const root = formRef.current;
    if (!root) return;
    const val = (n: string): string =>
      ((root.querySelector(`[name="${n}"]`) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? "").trim();
    const visit_date = val("visit_date");
    if (!visit_date) {
      toast.error("تاريخ الزيارة مطلوب");
      return;
    }
    const values = {
      parcel_ref: parcelRef,
      visit_date,
      visit_type: val("visit_type") || null,
      staff: val("staff") || null,
      notes: val("notes") || null,
      photos: photoPaths.slice(0, 3),
    };
    setSaving(true);
    const res = await saveVisit(values, editing?.id);
    setSaving(false);
    if (res.ok) {
      toast.success(editing ? "حُدِّثت الزيارة" : "أُضيفت الزيارة");
      invalidate();
      setAdding(false);
      setEditing(null);
    } else {
      toast.error("تعذّر الحفظ");
    }
  }

  async function onDelete(v: Visit) {
    if (!window.confirm("حذف هذه الزيارة؟")) return;
    const res = await deleteVisit(v.id);
    if (res.ok) {
      toast.success("حُذِفت الزيارة");
      invalidate();
    } else {
      toast.error("تعذّر الحذف");
    }
  }

  const showForm = adding || editing !== null;

  return (
    <section className="rounded-xl border border-border/60 bg-background/40 p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-xs font-bold text-primary/80">
          <ClipboardList className="size-3.5" /> سجلّ الزيارات
          <span className="rounded bg-secondary/60 px-1.5 text-[10px] text-secondary-foreground">{visits.length}</span>
        </h4>
        {!showForm && !isViewer ? (
          <Button size="sm" variant="outline" onClick={() => { setEditing(null); setPhotoPaths([]); setAdding(true); }}>
            <Plus className="size-3.5" /> زيارة
          </Button>
        ) : null}
      </div>

      {showForm ? (
        <div key={editing?.id ?? "new"} ref={formRef} className="mb-3 space-y-2 rounded-lg border border-border/60 bg-card/60 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-[11px] text-muted-foreground">تاريخ الزيارة *</label>
              <input name="visit_date" type="date" defaultValue={editing ? (editing.visit_date ?? "").slice(0, 10) : ""} className={INPUT} />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] text-muted-foreground">نوع الزيارة</label>
              <input name="visit_type" defaultValue={editing?.visit_type ?? ""} className={INPUT} />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] text-muted-foreground">الموظفون</label>
              <input name="staff" defaultValue={editing?.staff ?? ""} className={INPUT} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] text-muted-foreground">ملاحظات</label>
            <textarea name="notes" rows={2} defaultValue={editing?.notes ?? ""} className={INPUT + " min-h-16 leading-relaxed"} />
          </div>
          {/* صور الزيارة — حتى 3 (§ج.8/7) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">الصور (حتى 3)</span>
              <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onPickPhotos(e.target.files)} />
              <Button type="button" size="sm" variant="outline" disabled={uploadingPhoto || photoPaths.length >= 3} onClick={() => photoInputRef.current?.click()}>
                {uploadingPhoto ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
                {uploadingPhoto ? "جارٍ الرفع…" : "إضافة"}
              </Button>
            </div>
            {photoPaths.length ? (
              <div className="flex gap-1.5">
                {photoPaths.map((p) => (
                  <div key={p} className="relative">
                    {formThumbs?.[p] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={formThumbs[p]} alt="صورة زيارة" className="size-16 rounded-lg object-cover ring-1 ring-inset ring-border/50" />
                    ) : (
                      <span className="grid size-16 place-items-center rounded-lg bg-secondary/40 ring-1 ring-inset ring-border/50">
                        <Camera className="size-4 text-muted-foreground" />
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setPhotoPaths((arr) => arr.filter((x) => x !== p))}
                      aria-label="إزالة الصورة"
                      title="إزالة"
                      className="absolute -end-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-state-withdrawn text-white shadow"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={saving} onClick={() => void onSubmit()}>{saving ? "جارٍ الحفظ…" : "حفظ"}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setAdding(false); setEditing(null); }}>إلغاء</Button>
          </div>
        </div>
      ) : null}

      {visits.length === 0 && !showForm ? (
        <p className="text-xs text-muted-foreground">لا زيارات مسجّلة.</p>
      ) : null}

      <ul className="space-y-2">
        {visits.map((v) => (
          <li key={v.id} className="rounded-lg border border-border/50 bg-card/50 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <CalendarDays className="size-3.5 text-primary/60" /> {formatDate(v.visit_date)}
                  </span>
                  {v.visit_type ? <span className="rounded bg-secondary/60 px-1.5 py-0.5 text-[10px]">{v.visit_type}</span> : null}
                  {v.staff ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Users className="size-3 opacity-70" /> {v.staff}
                    </span>
                  ) : null}
                </div>
                {v.notes ? <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">{orNA(v.notes)}</p> : null}
                <VisitThumbs paths={Array.isArray(v.photos) ? v.photos : []} />
              </div>
              {!isViewer ? (
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setAdding(false); setPhotoPaths(v.photos ?? []); setEditing(v); }} title="تعديل" aria-label="تعديل">
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => void onDelete(v)} title="حذف" aria-label="حذف">
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
