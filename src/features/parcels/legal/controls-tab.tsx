"use client";

// التاب 1 — الضوابط والمعايير القانونية (الفحص القانوني). يعرض مخرجات المحرّك الحتمي (§ج.9)
// بالقالب: رأس + قسمان (ضوابط/معايير) + ذيل خلاصة الأهلية. كل بند باستشهاد · لا كشف تحقّق (§ح).

import { AlertTriangle, CheckCircle2, CircleSlash, FileEdit, Scale, ShieldAlert, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { StateBadge } from "@/features/parcels/state-badge";
import { sectorLabel } from "@/lib/sectors";
import type { ParcelKind } from "@/features/map/lib/map-nav-store";
import type { ParcelState } from "@/types/entities";
import { evaluateControls, type ControlItem, type ControlsInput, type Eligibility, type Fulfillment } from "./controls-engine";

const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

function parcelState(kind: ParcelKind, e: Record<string, unknown>): ParcelState {
  if (kind === "opportunity") return "announced";
  if (kind === "license") return (str(e.status) as ParcelState) ?? "in-progress";
  return (str(e.state) as ParcelState) ?? "assumed";
}

function toInput(kind: ParcelKind, e: Record<string, unknown>): ControlsInput {
  const capitalUsd = kind === "license" ? num(e.capital) : kind === "assumed" ? num(e.value) : null;
  return {
    state: parcelState(kind, e),
    sector: str(e.sector),
    capitalUsd,
    projectValueUsd: capitalUsd,
    landRight: str(e.land_right),
    nationality: str(e.investor_nationality),
    owner: str(e.owner),
    withdrawalReason: str(e.withdrawal_reason),
  };
}

const FULFILL: Record<Fulfillment, { label: string; cls: string; Icon: LucideIcon }> = {
  met: { label: "مستوفٍ", cls: "bg-state-completed/15 text-state-completed ring-state-completed/40", Icon: CheckCircle2 },
  not_met: { label: "غير مستوفٍ", cls: "bg-state-withdrawn/15 text-state-withdrawn ring-state-withdrawn/40", Icon: XCircle },
  needs_action: { label: "يتطلّب إجراء", cls: "bg-state-announced/15 text-state-announced ring-state-announced/40", Icon: AlertTriangle },
  needs_input: { label: "مُدخل مطلوب", cls: "bg-state-inprogress/15 text-state-inprogress ring-state-inprogress/40", Icon: FileEdit },
  not_applicable: { label: "غير منطبق", cls: "bg-secondary/60 text-muted-foreground ring-border/60", Icon: CircleSlash },
};

const ELIGIBILITY: Record<Eligibility, string> = {
  eligible: "bg-state-completed/15 text-state-completed ring-state-completed/40",
  not_eligible: "bg-state-withdrawn/15 text-state-withdrawn ring-state-withdrawn/40",
  needs_action: "bg-state-announced/15 text-state-announced ring-state-announced/40",
  future: "bg-state-assumed/15 text-state-assumed ring-state-assumed/40",
};

function ItemCard({ item }: { item: ControlItem }) {
  const f = FULFILL[item.fulfillment];
  const Icon = f.Icon;
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-secondary/70 text-[11px] font-bold text-foreground/80">
            {item.number}
          </span>
          <h5 className="truncate text-sm font-bold text-foreground">{item.title}</h5>
          {item.conditional ? <span className="shrink-0 rounded bg-secondary/60 px-1 text-[9px] text-muted-foreground">شرطي</span> : null}
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${f.cls}`}>
          <Icon className="size-3" /> {f.label}
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-foreground/80">{item.text}</p>
      {item.note ? <p className="mt-1 text-[11px] text-muted-foreground">{item.note}</p> : null}
      {item.requiredInput ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-state-inprogress">
          <FileEdit className="size-3 shrink-0" /> مطلوب: {item.requiredInput}
        </p>
      ) : null}
      <p className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-primary/70">
        <Scale className="size-3 shrink-0" /> {item.citation}
      </p>
    </div>
  );
}

export function ControlsTab({ kind, entity }: { kind: ParcelKind; entity: Record<string, unknown> }) {
  const input = toInput(kind, entity);
  const r = evaluateControls(input);

  return (
    <div className="space-y-4">
      {/* رأس: الحالة + القطاع + طبيعة الفحص */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-gradient-to-l from-primary/10 to-transparent p-3">
        <StateBadge state={input.state} />
        <span className="rounded-full bg-secondary/50 px-2 py-0.5 text-xs text-foreground/80 ring-1 ring-inset ring-border/60">
          {sectorLabel(input.sector)}
        </span>
        <span className="text-[11px] text-muted-foreground">فحص حتمي بقواعد موثّقة (الذكاء يشرح لا يقرّر)</span>
      </div>

      {/* تنبيه المدخلات الناقصة الحرجة — تُطلب لا تُفترض */}
      {r.missingInputs.length ? (
        <div className="rounded-xl border border-state-inprogress/40 bg-state-inprogress/10 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-state-inprogress">
            <ShieldAlert className="size-4" /> مدخلات حرجة ناقصة — تُطلب لا تُفترض
          </p>
          <ul className="mt-1.5 list-inside list-disc text-[11px] text-foreground/80">
            {r.missingInputs.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* أولاً — ضوابط المشروع/الأرض */}
      <section className="space-y-2">
        <h4 className="text-xs font-bold text-primary/80">أولاً — ضوابط المشروع/الأرض</h4>
        {r.projectControls.map((it) => (
          <ItemCard key={`c-${it.number}`} item={it} />
        ))}
      </section>

      {/* ثانياً — معايير المستثمر/الشركة */}
      <section className="space-y-2">
        <h4 className="text-xs font-bold text-primary/80">ثانياً — معايير المستثمر/الشركة</h4>
        {r.investorCriteria.map((it) => (
          <ItemCard key={`m-${it.number}`} item={it} />
        ))}
      </section>

      {/* ذيل — خلاصة الأهلية + أبرز النواقص */}
      <section className={`rounded-xl p-3 ring-1 ring-inset ${ELIGIBILITY[r.eligibility]}`}>
        <p className="text-sm font-bold">خلاصة الأهلية: {r.eligibilityLabel}</p>
        {r.gaps.length ? <p className="mt-1 text-[11px] opacity-90">أبرز النواقص: {r.gaps.join(" · ")}</p> : null}
      </section>
    </div>
  );
}
