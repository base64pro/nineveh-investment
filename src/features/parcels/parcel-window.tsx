"use client";

// نافذة القطعة الموحّدة (§هـ.4) — للأنواع الثلاثة (فرصة/رخصة/مفترضة).
// رأس ثابت (عنوان + بيانات مفتاحية + إجراءات) · تمرير عمودي · تحرير مباشر لكل حقل · لا كشف تحقّق (§ح).

import { type FormEvent, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Layers, Ruler, Tag, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OptionField } from "@/components/ui/option-field";
import { StateBadge } from "@/features/parcels/state-badge";
import { useFieldOptions } from "@/lib/data/use-field-options";
import { formatArea, orNA } from "@/lib/display";
import { sectorLabel } from "@/lib/sectors";
import type { ParcelKind } from "@/features/map/lib/map-nav-store";
import type { ParcelState } from "@/types/entities";
import { OPPORTUNITY_FORM_FIELDS, OPPORTUNITY_OPTION_FIELDS } from "@/features/opportunities/fields";
import { LICENSE_FORM_FIELDS, LICENSE_OPTION_FIELDS } from "@/features/licenses/fields";
import { ASSUMED_FORM_FIELDS, ASSUMED_OPTION_FIELDS } from "@/features/assumed/fields";
import { saveOpportunity } from "@/features/opportunities/actions";
import { saveLicense } from "@/features/licenses/actions";
import { saveAssumed } from "@/features/assumed/actions";

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
  onOpenActions,
}: {
  kind: ParcelKind;
  entity: AnyEntity;
  onClose: () => void;
  onOpenActions: () => void;
}) {
  const cfg = KINDS[kind];
  const queryClient = useQueryClient();
  const { data: custom } = useFieldOptions();
  const [saving, setSaving] = useState(false);

  const state = parcelState(kind, entity);
  const title = orNA(entity[cfg.titleKey] ?? entity.parcel_no);
  const subParts = [entity.parcel_no ? `قطعة ${entity.parcel_no}` : null, entity.muqataa_no ? `مقاطعة ${entity.muqataa_no}` : null].filter(
    Boolean,
  );

  const merged = (key: string): string[] =>
    Array.from(new Set([...(custom?.[key] ?? [])])).sort();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const values: Record<string, unknown> = {};
    for (const f of cfg.fields) {
      const raw = String(fd.get(f.key) ?? "").trim();
      values[f.key] = raw === "" ? null : f.type === "number" ? Number(raw) : raw; // فراغ→null (لا تأليف §ح)
    }
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

  const compact = cfg.fields.filter((f) => f.type !== "textarea");
  const textareas = cfg.fields.filter((f) => f.type === "textarea");

  return createPortal(
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
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2 py-0.5 text-xs text-foreground/80 ring-1 ring-inset ring-border/60">
                  <Tag className="size-3" /> {sectorLabel(entity.sector as string | null)}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2 py-0.5 text-xs text-foreground/80 ring-1 ring-inset ring-border/60">
                  <Ruler className="size-3" /> {formatArea(entity[cfg.areaKey] as number | null)}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" size="sm" onClick={onOpenActions} className="gap-1.5">
                <Layers className="size-4" /> إجراءات
              </Button>
              <button type="button" onClick={onClose} aria-label="إغلاق" className="rounded-md p-1 transition hover:bg-accent">
                <X className="size-4" />
              </button>
            </div>
          </header>

          {/* جسم التحرير المباشر */}
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-5 sm:grid-cols-2">
              {compact.map((f) => {
                const id = `pw-${kind}-${f.key}`;
                if (f.type === "select" && f.options) {
                  return (
                    <div key={f.key} className="space-y-1">
                      <label htmlFor={id} className="block text-xs text-muted-foreground">
                        {f.label}
                      </label>
                      <select
                        id={id}
                        name={f.key}
                        defaultValue={field(entity, f.key)}
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                      >
                        {f.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
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
            </div>

            {/* ذيل ثابت: حفظ التحرير المباشر */}
            <footer className="flex shrink-0 items-center justify-start gap-2 border-t border-border/70 bg-card/80 px-5 py-3">
              <Button type="submit" disabled={saving}>
                {saving ? "جارٍ الحفظ…" : "حفظ"}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                إغلاق
              </Button>
            </footer>
          </form>
        </motion.div>
    </div>,
    document.body,
  );
}
