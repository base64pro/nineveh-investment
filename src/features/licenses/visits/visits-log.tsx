"use client";

import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, ClipboardList, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useTable } from "@/lib/data/use-table";
import { Button } from "@/components/ui/button";
import { formatDate, orNA } from "@/lib/display";
import { saveVisit, deleteVisit } from "./visits-actions";
import type { Visit } from "@/types/entities";

const INPUT = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";

// سجلّ الزيارات لرخصة (§هـ.1 · §ج.8/7) — مرتبط عبر parcel_ref = معرّف الرخصة.
export function VisitsLog({ parcelRef }: { parcelRef: string }) {
  const { data } = useTable<Visit>("visits");
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Visit | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null); // بديل <form> لتجنّب تداخل النماذج (نافذة القطعة فيها <form>)

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
        {!showForm ? (
          <Button size="sm" variant="outline" onClick={() => { setEditing(null); setAdding(true); }}>
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
          <p className="text-[10px] text-muted-foreground">الصور (حتى 3) تُضاف بعد تهيئة التخزين (Storage).</p>
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
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setAdding(false); setEditing(v); }} title="تعديل" aria-label="تعديل">
                  <Pencil className="size-3.5" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => void onDelete(v)} title="حذف" aria-label="حذف">
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
