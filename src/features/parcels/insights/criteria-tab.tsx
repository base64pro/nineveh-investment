"use client";

// تاب 3 — إنشاء معايير (§هـ.4): مسودة معايير 🟩 من بيانات القطعة + قالب الشركة + مرجعية المكتبة (+ ويب إن فُعِّل).
// تُثبَّت للقطعة (فارغة حتى أوّل طلب · زرّ مسح) + حفظ اختياري في مكتبة المعايير (قابلة للتحرير هناك).

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eraser, Library, ListChecks, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/display";
import { domainLabel } from "@/features/criteria/fields";
import type { ParcelKind } from "@/features/map/lib/map-nav-store";
import { IjtihadBadge } from "./recommendations-tab";
import { clearCriteriaDraft, generateCriteria, getInsights, saveCriteriaToLibrary } from "./insights-actions";

export function CriteriaTab({ kind, entity }: { kind: ParcelKind; entity: Record<string, unknown> }) {
  const id = String(entity[kind === "assumed" ? "id" : "record_id"] ?? "");
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["insights", kind, id],
    queryFn: () => getInsights(kind, id),
    enabled: id !== "",
  });
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: ["insights", kind, id] });
  }
  async function onGenerate(): Promise<void> {
    if (busy) return;
    setBusy(true);
    const res = await generateCriteria(kind, id);
    setBusy(false);
    if (res.ok) {
      toast.success("وُلِّدت المعايير وثُبِّتت للقطعة");
      invalidate();
    } else {
      toast.error(`تعذّر التوليد — ${res.error}`);
    }
  }
  async function onClear(): Promise<void> {
    if (!window.confirm("مسح مسودة المعايير المثبّتة لهذه القطعة؟")) return;
    const res = await clearCriteriaDraft(kind, id);
    if (res.ok) {
      toast.success("مُسِحت المسودة");
      invalidate();
    } else {
      toast.error("تعذّر المسح");
    }
  }
  async function onSave(): Promise<void> {
    setSaving(true);
    const res = await saveCriteriaToLibrary(kind, id);
    setSaving(false);
    if (res.ok) {
      toast.success("حُفِظت في مكتبة المعايير — حرّرها هناك متى شئت");
      void queryClient.invalidateQueries({ queryKey: ["table", "criteria"] });
      void queryClient.invalidateQueries({ queryKey: ["counts"] });
    } else {
      toast.error(`تعذّر الحفظ — ${res.error}`);
    }
  }

  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  const draft = data?.criteria;

  if (!draft) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary/80 ring-1 ring-primary/20">
          {busy ? <Loader2 className="size-7 animate-spin" /> : <ListChecks className="size-7" />}
        </div>
        <div className="max-w-md space-y-1">
          <h4 className="text-sm font-bold text-foreground">إنشاء معايير</h4>
          <p className="text-xs leading-relaxed text-muted-foreground">
            معايير مرجعية 🟩 لتقييم الشركات/العروض الأنسب — من بيانات القطعة + قالب الشركة + مرجعية مكتبتك.
            كل بند: وصف · أساس · وزن · مؤشّر الدعم ببياناتنا. تُثبَّت للقطعة حتى إعادة الطلب أو المسح.
          </p>
        </div>
        <Button type="button" disabled={busy || !id} onClick={() => void onGenerate()} className="gap-1.5">
          <Sparkles className="size-4" /> {busy ? "جارٍ التوليد… (قد يستغرق دقيقة)" : "إنشاء معايير"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <IjtihadBadge label="معايير مولّدة بالذكاء" />
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span>ثُبِّتت بتاريخ {formatDate(data?.criteria_at ?? null)}</span>
        <span className="ms-auto flex gap-1.5">
          <Button type="button" size="sm" disabled={saving} onClick={() => void onSave()} className="gap-1">
            <Library className="size-3.5" /> {saving ? "جارٍ الحفظ…" : "حفظ في المكتبة"}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void onGenerate()} className="gap-1">
            <RefreshCw className={busy ? "size-3.5 animate-spin" : "size-3.5"} /> إعادة الإنشاء
          </Button>
          <Button type="button" size="sm" variant="danger" disabled={busy} onClick={() => void onClear()} className="gap-1">
            <Eraser className="size-3.5" /> مسح
          </Button>
        </span>
      </div>

      <div className="rounded-xl border border-border/60 bg-background/40 p-3.5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-bold">{draft.name}</h4>
          <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] text-secondary-foreground ring-1 ring-inset ring-border/60">
            {domainLabel(draft.domain) || draft.domain}
          </span>
        </div>
        {draft.purpose ? <p className="mb-3 text-xs text-muted-foreground">{draft.purpose}</p> : null}
        <ol className="space-y-2.5">
          {draft.items.map((it, i) => (
            <li key={i} className="rounded-lg border border-border/50 bg-card/50 p-2.5">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-semibold leading-snug">{it.description}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {it.weight ? <span>الوزن: <b className="text-foreground/90">{it.weight}</b></span> : null}
                    {it.support_indicator ? <span>مؤشّر الدعم: {it.support_indicator}</span> : null}
                  </div>
                  {it.basis ? <p className="text-[11px] leading-relaxed text-foreground/70">الأساس: {it.basis}</p> : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
