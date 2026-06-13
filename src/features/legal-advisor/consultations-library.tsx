"use client";

// مكتبة الاستشارات (§هـ.5) — قائمة المحفوظة (عنوان · تاريخ · مقتطف) ← فتح/تصدير PDF/حذف.

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Copy, FileDown, Library, Trash2 } from "lucide-react";
import { useTable } from "@/lib/data/use-table";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/display";
import { AdvisorAnswer } from "./advisor-answer";
import { copyConsultation } from "./copy-consultation";
import { deleteConsultation } from "./consultation-actions";
import type { Consultation } from "@/types/entities";

export function ConsultationsLibrary() {
  const { data } = useTable<Consultation>("consultations");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<Consultation | null>(null);

  const items = useMemo(
    () => (data ?? []).slice().sort((a, b) => (b.consulted_at ?? "").localeCompare(a.consulted_at ?? "")),
    [data],
  );

  const [exporting, setExporting] = useState<string | null>(null);
  async function onExport(c: Consultation) {
    if (exporting) return;
    setExporting(c.id);
    try {
      const res = await fetch(`/api/pdf/consultation?id=${encodeURIComponent(c.id)}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${c.title ?? "استشارة"}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("تعذّر تصدير الـPDF — حاول مجدداً");
    } finally {
      setExporting(null);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("حذف هذه الاستشارة؟")) return;
    const res = await deleteConsultation(id);
    if (res.ok) {
      toast.success("حُذِفت الاستشارة");
      void queryClient.invalidateQueries({ queryKey: ["table", "consultations"] });
    } else {
      toast.error("تعذّر الحذف");
    }
  }

  return (
    <div className="scroll-slim h-full overflow-y-auto p-3">
      {items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
          <Library className="size-10 text-primary/40" />
          <p className="text-sm">لا استشارات محفوظة بعد.</p>
          <p className="text-xs">احفظ إجابةً من تاب «أسئلة حرّة» لتظهر هنا.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => (
            <li key={c.id} className="rounded-xl border border-border/60 bg-background/40 p-3 transition hover:border-primary/40">
              <div className="flex items-start justify-between gap-2">
                <button type="button" onClick={() => setOpen(c)} className="min-w-0 flex-1 text-start">
                  <p className="truncate text-sm font-bold text-foreground">{c.title ?? "استشارة"}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <CalendarDays className="size-3" /> {formatDate(c.consulted_at)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-foreground/70">{c.excerpt}</p>
                </button>
                <div className="flex shrink-0 flex-col gap-0.5">
                  <Button size="icon" variant="ghost" onClick={() => void copyConsultation(c.question ?? "", c.answer ?? "", c.title)} aria-label="نسخ" title="نسخ السؤال والإجابة">
                    <Copy className="size-3.5 text-primary/70" />
                  </Button>
                  <Button size="icon" variant="ghost" disabled={exporting === c.id} onClick={() => void onExport(c)} aria-label="تصدير PDF" title="تصدير PDF">
                    <FileDown className="size-3.5 text-primary/70" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => void onDelete(c.id)} aria-label="حذف" title="حذف">
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open !== null} onClose={() => setOpen(null)} title={open?.title ?? "استشارة"} size="lg">
        {open ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-primary/10 p-3 text-sm ring-1 ring-inset ring-primary/20">
              <p className="mb-1 text-[11px] font-bold text-primary/70">السؤال</p>
              <p className="whitespace-pre-wrap">{open.question}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/40 p-3">
              <p className="mb-2 text-[11px] font-bold text-primary/70">الإجابة</p>
              <AdvisorAnswer text={open.answer ?? ""} />
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void copyConsultation(open.question ?? "", open.answer ?? "", open.title)} className="gap-1.5">
                <Copy className="size-4" /> نسخ
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={exporting === open.id} onClick={() => void onExport(open)} className="gap-1.5">
                <FileDown className="size-4" /> {exporting === open.id ? "جارٍ التصدير…" : "تصدير PDF"}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
