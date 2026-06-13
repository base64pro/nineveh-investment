"use client";

// تاب 2 — التوصيات الذكية (§هـ.4): تُولَّد عند الطلب · تُثبَّت كبيانات للقطعة · زرّ مسح.
// مؤشَّرة صراحةً: 🟩 اجتهاد آلي غير مُلزِم (§ح.5) — لا تحلّ محلّ الضوابط الإلزامية.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eraser, Lightbulb, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/display";
import { AdvisorAnswer } from "@/features/legal-advisor/advisor-answer";
import type { ParcelKind } from "@/features/map/lib/map-nav-store";
import { clearRecommendations, generateRecommendations, getInsights } from "./insights-actions";

export function IjtihadBadge({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-state-completed/40 bg-state-completed/10 px-3 py-2 text-[11px] font-semibold text-state-completed">
      <span aria-hidden>🟩</span> {label} — رأي استنتاجي آلي <b>غير مُلزِم</b>؛ الضوابط الإلزامية في تاب «الضوابط والمعايير».
    </div>
  );
}

export function RecommendationsTab({ kind, entity }: { kind: ParcelKind; entity: Record<string, unknown> }) {
  const id = String(entity[kind === "assumed" ? "id" : "record_id"] ?? "");
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["insights", kind, id],
    queryFn: () => getInsights(kind, id),
    enabled: id !== "",
  });
  const [busy, setBusy] = useState(false);

  async function onGenerate(): Promise<void> {
    if (busy) return;
    setBusy(true);
    const res = await generateRecommendations(kind, id);
    setBusy(false);
    if (res.ok) {
      toast.success("وُلِّدت التوصيات وثُبِّتت للقطعة");
      void queryClient.invalidateQueries({ queryKey: ["insights", kind, id] });
    } else {
      toast.error(`تعذّر التوليد — ${res.error}`);
    }
  }
  async function onClear(): Promise<void> {
    if (!window.confirm("مسح كل التوصيات المثبّتة لهذه القطعة؟")) return;
    const res = await clearRecommendations(kind, id);
    if (res.ok) {
      toast.success("مُسِحت التوصيات");
      void queryClient.invalidateQueries({ queryKey: ["insights", kind, id] });
    } else {
      toast.error("تعذّر المسح");
    }
  }

  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  const rec = data?.recommendations;

  if (!rec) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary/80 ring-1 ring-primary/20">
          {busy ? <Loader2 className="size-7 animate-spin" /> : <Lightbulb className="size-7" />}
        </div>
        <div className="max-w-md space-y-1">
          <h4 className="text-sm font-bold text-foreground">التوصيات الذكية</h4>
          <p className="text-xs leading-relaxed text-muted-foreground">
            الاستخدام الأنسب · الشركات الأنسب (من بنكنا، بتعليل) · المخاطر والفرص · المعمار الإرشادي — بذكر الأساس.
            تُولَّد عند الطلب وتُثبَّت كبيانات للقطعة حتى إعادة الطلب أو المسح.
          </p>
        </div>
        <Button type="button" disabled={busy || !id} onClick={() => void onGenerate()} className="gap-1.5">
          <Sparkles className="size-4" /> {busy ? "جارٍ التوليد… (قد يستغرق دقيقة)" : "إنشاء توصيات ذكية"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <IjtihadBadge label="توصيات مولّدة بالذكاء" />
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span>ثُبِّتت بتاريخ {formatDate(data?.recommendations_at ?? null)}</span>
        <span className="ms-auto flex gap-1.5">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void onGenerate()} className="gap-1">
            <RefreshCw className={busy ? "size-3.5 animate-spin" : "size-3.5"} /> {busy ? "يُعاد التوليد…" : "إعادة الإنشاء"}
          </Button>
          <Button type="button" size="sm" variant="danger" disabled={busy} onClick={() => void onClear()} className="gap-1">
            <Eraser className="size-3.5" /> مسح
          </Button>
        </span>
      </div>
      <div className="rounded-xl border border-border/60 bg-background/40 p-4">
        <AdvisorAnswer text={rec} />
      </div>
    </div>
  );
}
