"use client";

// نافذة القطعة الموحّدة (§هـ.4) — للأنواع الثلاثة (فرصة/رخصة/مفترضة).
// رأس ثابت (عنوان + بيانات مفتاحية + إجراءات) · تمرير عمودي · تحرير مباشر لكل حقل · لا كشف تحقّق (§ح).

import { type FormEvent, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ArrowLeftRight, Layers, Ruler, Tag, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combo } from "@/components/ui/combo";
import { OptionField } from "@/components/ui/option-field";
import { StateBadge } from "@/features/parcels/state-badge";
import { ActionsWindow } from "@/features/parcels/actions-window";
import { CompanyField } from "@/features/parcels/company-field";
import { TransferLogView, type TransferEntry } from "@/features/parcels/transfer-log-view";
import { VisitsLog } from "@/features/licenses/visits/visits-log";
import { useFieldOptions } from "@/lib/data/use-field-options";
import { useTable } from "@/lib/data/use-table";
import { formatArea, orNA } from "@/lib/display";
import { sectorLabel } from "@/lib/sectors";
import { type ParcelKind, requestFlyTo } from "@/features/map/lib/map-nav-store";
import type { Company, ParcelState } from "@/types/entities";
import { OPPORTUNITY_FORM_FIELDS, OPPORTUNITY_OPTION_FIELDS } from "@/features/opportunities/fields";
import { LICENSE_FORM_FIELDS, LICENSE_OPTION_FIELDS } from "@/features/licenses/fields";
import { ASSUMED_FORM_FIELDS, ASSUMED_OPTION_FIELDS } from "@/features/assumed/fields";
import { saveOpportunity } from "@/features/opportunities/actions";
import { saveLicense } from "@/features/licenses/actions";
import { saveAssumed } from "@/features/assumed/actions";
import { moveParcel } from "@/features/parcels/transition-actions";

type ActionResult = { ok: true } | { ok: false; error: string };
type WinFieldType = "text" | "number" | "date" | "textarea" | "select";
interface WinField {
  key: string;
  label: string;
  type: WinFieldType;
  options?: { value: string; label: string }[];
}
type AnyEntity = Record<string, unknown>;

interface KindConfig {
  table: string;
  titleKey: string;
  areaKey: string;
  fields: readonly WinField[];
  optionFields: ReadonlySet<string>;
  save: (values: Record<string, unknown>, id: string | number | undefined) => Promise<ActionResult>;
}

const KINDS: Record<ParcelKind, KindConfig> = {
  opportunity: {
    table: "opportunities",
    titleKey: "title",
    areaKey: "area_total_m2",
    fields: OPPORTUNITY_FORM_FIELDS as readonly WinField[],
    optionFields: new Set(OPPORTUNITY_OPTION_FIELDS),
    save: (v, id) => saveOpportunity(v, id as number | undefined),
  },
  license: {
    table: "licenses",
    titleKey: "title",
    areaKey: "area_total_m2",
    fields: LICENSE_FORM_FIELDS as readonly WinField[],
    optionFields: new Set(LICENSE_OPTION_FIELDS),
    save: (v, id) => saveLicense(v, id as number | undefined),
  },
  assumed: {
    table: "assumed_parcels",
    titleKey: "name",
    areaKey: "area_m2",
    fields: ASSUMED_FORM_FIELDS as readonly WinField[],
    optionFields: new Set(ASSUMED_OPTION_FIELDS),
    save: (v, id) => saveAssumed(v, id as string | undefined),
  },
};

const LARGE_TEXTAREAS = new Set(["description", "raw_details", "annexation_plan"]);

// الحالات الخمس لمنسدلة النقل (§هـ.4 · م3.5).
const STATE_OPTIONS: { value: ParcelState; label: string }[] = [
  { value: "announced", label: "معلَنة" },
  { value: "in-progress", label: "قيد الإنجاز" },
  { value: "completed", label: "منجزة" },
  { value: "withdrawn", label: "مسحوبة" },
  { value: "assumed", label: "مفترضة" },
];

// وجهة النقل (لرسالة واضحة تمنع لبس «الفقدان») — القسم + لون القطعة على الخريطة.
const MOVE_DEST: Record<ParcelState, { section: string; color: string }> = {
  announced: { section: "الفرص", color: "ذهبية" },
  "in-progress": { section: "الرخص · قيد الإنجاز", color: "زرقاء" },
  completed: { section: "الرخص · منجزة", color: "خضراء" },
  withdrawn: { section: "الرخص · مسحوبة", color: "حمراء" },
  assumed: { section: "تصميم فرصة · مفترضة", color: "بنفسجية" },
};

// حقول يُؤشَّر لإكمالها بعد النقل (لا مانعة — تُملأ لاحقاً).
const HINTS: Record<ParcelKind, { key: string; label: string }[]> = {
  opportunity: [{ key: "title", label: "العنوان" }],
  license: [
    { key: "license_number", label: "رقم الرخصة" },
    { key: "investor_name", label: "المستثمر" },
    { key: "capital", label: "رأس المال" },
  ],
  assumed: [{ key: "name", label: "اسم القطعة" }],
};

function field(e: AnyEntity, key: string): string {
  const v = e[key];
  if (v === null || v === undefined) return "";
  if (key.endsWith("_date") || key === "deadline") return String(v).slice(0, 10);
  return String(v);
}

function parcelState(kind: ParcelKind, e: AnyEntity): ParcelState {
  if (kind === "opportunity") return "announced";
  if (kind === "license") return (e.status as ParcelState) ?? "in-progress";
  return (e.state as ParcelState) ?? "assumed";
}

function entityId(kind: ParcelKind, e: AnyEntity): string | number | undefined {
  const raw = kind === "assumed" ? e.id : e.record_id;
  return raw as string | number | undefined;
}

export function ParcelWindow({
  kind,
  entity,
  onClose,
  onMoved,
  readOnly = false,
}: {
  kind: ParcelKind;
  entity: AnyEntity;
  onClose: () => void;
  onMoved: (ref: { kind: ParcelKind; id: string }) => void;
  readOnly?: boolean;
}) {
  const cfg = KINDS[kind];
  const queryClient = useQueryClient();
  const { data: custom } = useFieldOptions();
  const [saving, setSaving] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const { data: companiesData } = useTable<Company>("companies");
  const companyOptions = useMemo(() => (companiesData ?? []).map((c) => ({ id: c.id, name: c.name })), [companiesData]);
  const [companyRef, setCompanyRef] = useState<string | null>((entity.company_ref as string | null) ?? null);

  const state = parcelState(kind, entity);
  const missingHints = HINTS[kind].filter((h) => !field(entity, h.key));
  const title = orNA(entity[cfg.titleKey] ?? entity.parcel_no);
  const subParts = [entity.parcel_no ? `قطعة ${entity.parcel_no}` : null, entity.muqataa_no ? `مقاطعة ${entity.muqataa_no}` : null].filter(
    Boolean,
  );

  const merged = (key: string): string[] =>
    Array.from(new Set([...(custom?.[key] ?? [])])).sort();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (readOnly) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const values: Record<string, unknown> = {};
    for (const f of cfg.fields) {
      const raw = String(fd.get(f.key) ?? "").trim();
      values[f.key] = raw === "" ? null : f.type === "number" ? Number(raw) : raw; // فراغ→null (لا تأليف §ح)
    }
    if (kind !== "opportunity") values.company_ref = companyRef; // الربط بشركة (المعرّف لا يُعرَض §ح)
    const res = await cfg.save(values, entityId(kind, entity));
    setSaving(false);
    if (res.ok) {
      toast.success("حُفِّظت القطعة");
      void queryClient.invalidateQueries({ queryKey: ["table", cfg.table] });
      void queryClient.invalidateQueries({ queryKey: ["map_parcels"] });
      void queryClient.invalidateQueries({ queryKey: ["counts"] });
    } else {
      toast.error("تعذّر الحفظ — حاول مجدداً");
    }
  }

  async function handleMove(target: ParcelState) {
    if (target === state || moving) return;
    setMoving(true);
    const res = await moveParcel(kind, String(entityId(kind, entity) ?? ""), target);
    setMoving(false);
    if (!res.ok) {
      toast.error("تعذّر نقل الحالة — حاول مجدداً");
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["table", "opportunities"] }),
      queryClient.invalidateQueries({ queryKey: ["table", "licenses"] }),
      queryClient.invalidateQueries({ queryKey: ["table", "assumed_parcels"] }),
      queryClient.invalidateQueries({ queryKey: ["map_parcels"] }),
      queryClient.invalidateQueries({ queryKey: ["counts"] }),
    ]);
    const pn = String(entity.parcel_no ?? "");
    if (pn) requestFlyTo(pn); // طيران + إبراز القطعة في موضعها الجديد (يظهر عند إغلاق النافذة)
    const d = MOVE_DEST[target];
    toast.success(d ? `نُقلت إلى ${d.section} — تجدها ${d.color} على الخريطة` : "نُقلت القطعة");
    onMoved({ kind: res.kind, id: res.id });
  }

  const compact = cfg.fields.filter((f) => f.type !== "textarea" && f.key !== "status");
  const textareas = cfg.fields.filter((f) => f.type === "textarea");

  return createPortal(
    <>
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
        <motion.div
          className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-card to-card/85 shadow-2xl shadow-[0_0_60px_-12px] shadow-primary/30"
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {/* رأس ثابت: عنوان + بيانات مفتاحية (حالة/قطاع/مساحة) + إجراءات + إغلاق */}
          <header className="flex shrink-0 items-start gap-3 border-b border-border/70 bg-gradient-to-l from-primary/10 to-transparent p-4">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-bold tracking-tight" title={title}>
                {title}
              </h3>
              {subParts.length ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{subParts.join(" · ")}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StateBadge state={state} />
                {!readOnly ? (
                  <div className="flex items-center gap-1.5" title="نقل الحالة بين الأقسام الخمسة">
                    <ArrowLeftRight className="size-3.5 shrink-0 text-muted-foreground" />
                    <div className="w-32">
                      <Combo value={state} onChange={(v) => void handleMove(v as ParcelState)} options={STATE_OPTIONS} ariaLabel="نقل الحالة" disabled={moving} />
                    </div>
                  </div>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2 py-0.5 text-xs text-foreground/80 ring-1 ring-inset ring-border/60">
                  <Tag className="size-3" /> {sectorLabel(entity.sector as string | null)}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2 py-0.5 text-xs text-foreground/80 ring-1 ring-inset ring-border/60">
                  <Ruler className="size-3" /> {formatArea(entity[cfg.areaKey] as number | null)}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" size="sm" onClick={() => setActionsOpen(true)} className="gap-1.5">
                <Layers className="size-4" /> إجراءات
              </Button>
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق"
                title="إغلاق"
                className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground ring-1 ring-inset ring-border/50 transition hover:bg-accent hover:text-foreground hover:ring-border active:scale-90"
              >
                <X className="size-5" />
              </button>
            </div>
          </header>

          {/* جسم التحرير المباشر */}
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <fieldset disabled={readOnly} className="m-0 grid grid-cols-1 gap-3 border-0 p-0 sm:grid-cols-2">
              {!readOnly && missingHints.length ? (
                <div className="rounded-lg border border-state-announced/40 bg-state-announced/10 p-2.5 text-xs text-state-announced sm:col-span-2">
                  أكمل الحقول المطلوبة: {missingHints.map((h) => h.label).join(" · ")}
                </div>
              ) : null}
              {kind !== "opportunity" ? (
                <CompanyField companies={companyOptions} value={companyRef} onChange={setCompanyRef} />
              ) : null}
              {compact.map((f) => {
                const id = `pw-${kind}-${f.key}`;
                if (cfg.optionFields.has(f.key)) {
                  const isSector = f.key === "sector";
                  const raw = field(entity, f.key);
                  const dv = isSector && raw ? sectorLabel(raw) : raw;
                  const opts = isSector ? merged(f.key).map((c) => sectorLabel(c)) : merged(f.key);
                  return <OptionField key={f.key} id={id} name={f.key} label={f.label} defaultValue={dv} fieldKey={f.key} options={opts} />;
                }
                return (
                  <div key={f.key} className="space-y-1">
                    <label htmlFor={id} className="block text-xs text-muted-foreground">
                      {f.label}
                    </label>
                    <input
                      id={id}
                      name={f.key}
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      step={f.type === "number" ? "any" : undefined}
                      defaultValue={field(entity, f.key)}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                );
              })}

              {textareas.length ? (
                <div className="space-y-3 sm:col-span-2">
                  {textareas.map((f) => {
                    const id = `pw-${kind}-${f.key}`;
                    return (
                      <div key={f.key} className="space-y-1">
                        <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">
                          {f.label}
                        </label>
                        <textarea
                          id={id}
                          name={f.key}
                          rows={LARGE_TEXTAREAS.has(f.key) ? 5 : 3}
                          defaultValue={field(entity, f.key)}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {kind === "license" && (state === "in-progress" || state === "completed") ? (
                <div className="sm:col-span-2">
                  <VisitsLog parcelRef={String(entity.record_id ?? "")} />
                </div>
              ) : null}
              </fieldset>
              <div className="mt-3">
                <TransferLogView log={Array.isArray(entity.transfer_log) ? (entity.transfer_log as TransferEntry[]) : []} />
              </div>
            </div>

            {/* ذيل ثابت: حفظ التحرير المباشر */}
            <footer className="flex shrink-0 items-center justify-start gap-2 border-t border-border/70 bg-card/80 px-5 py-3">
              {!readOnly ? (
                <Button type="submit" disabled={saving}>
                  {saving ? "جارٍ الحفظ…" : "حفظ"}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={onClose}>
                إغلاق
              </Button>
            </footer>
          </form>
        </motion.div>
    </div>
    {actionsOpen ? <ActionsWindow kind={kind} entity={entity} onClose={() => setActionsOpen(false)} /> : null}
    </>,
    document.body,
  );
}
