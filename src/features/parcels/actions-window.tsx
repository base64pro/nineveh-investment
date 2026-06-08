"use client";

// النافذة الفرعية للإجراءات (§هـ.4) — شريط تابات أفقي علوي بأربعة تابات:
// 1) الضوابط والمعايير القانونية (حتمي §ج.9 — م3.3) · 2) التوصيات الذكية (م4)
// 3) إنشاء معايير (م4) · 4) التقرير (عرض داخلي؛ PDF في م6).

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { FileText, Lightbulb, ListChecks, Scale, Sparkles, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ControlsTab } from "./legal/controls-tab";
import { ReportTab } from "./legal/report-tab";
import type { ParcelKind } from "@/features/map/lib/map-nav-store";

type TabKey = "controls" | "recommendations" | "criteria" | "report";
const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "controls", label: "الضوابط والمعايير", icon: Scale },
  { key: "recommendations", label: "التوصيات الذكية", icon: Lightbulb },
  { key: "criteria", label: "إنشاء معايير", icon: ListChecks },
  { key: "report", label: "التقرير", icon: FileText },
];

function SoonPanel({ icon: Icon, title, desc, action, phase }: { icon: LucideIcon; title: string; desc: string; action: string; phase: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary/80 ring-1 ring-primary/20">
        <Icon className="size-7" />
      </div>
      <div className="max-w-md space-y-1">
        <h4 className="text-sm font-bold text-foreground">{title}</h4>
        <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
      </div>
      <Button type="button" disabled className="gap-1.5 opacity-60">
        <Sparkles className="size-4" /> {action}
      </Button>
      <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-inset ring-border/60">
        يُوصَل في {phase}
      </span>
    </div>
  );
}

export function ActionsWindow({ kind, entity, onClose }: { kind: ParcelKind; entity: Record<string, unknown>; onClose: () => void }) {
  const [tab, setTab] = useState<TabKey>("controls");

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      <motion.div
        className="relative z-10 flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-card to-card/85 shadow-2xl shadow-[0_0_60px_-12px] shadow-primary/30"
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-border/70 bg-gradient-to-l from-primary/10 to-transparent px-4 py-3">
          <h3 className="text-base font-bold tracking-tight">إجراءات القطعة</h3>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="rounded-md p-1 transition hover:bg-accent">
            <X className="size-4" />
          </button>
        </header>

        {/* شريط التابات الأفقي */}
        <div className="flex shrink-0 gap-1 border-b border-border/60 px-3 pt-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={
                  "flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium transition " +
                  (active
                    ? "bg-background text-primary ring-1 ring-inset ring-border/60 ring-b-0"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
                }
              >
                <Icon className="size-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === "controls" ? <ControlsTab kind={kind} entity={entity} /> : null}
          {tab === "recommendations" ? (
            <SoonPanel
              icon={Lightbulb}
              title="التوصيات الذكية"
              desc="توصيات مولّدة بالذكاء (معلَنة، غير مُلزِمة) تُكمّل الضوابط: الاستخدام الأنسب · الشركة الأنسب · المخاطر والفرص — مع ذكر الأساس."
              action="إنشاء توصيات ذكية"
              phase="م4 (RAG + ويب)"
            />
          ) : null}
          {tab === "criteria" ? (
            <SoonPanel
              icon={ListChecks}
              title="إنشاء معايير"
              desc="توليد معايير مرجعية 🟩 (مهنية/تنافسية، غير مُلزِمة) من بيانات القطعة + قالب الشركة + ممارسات عالمية + مكتبة المعايير."
              action="إنشاء معايير"
              phase="م4 (RAG + ويب)"
            />
          ) : null}
          {tab === "report" ? <ReportTab kind={kind} entity={entity} /> : null}
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
