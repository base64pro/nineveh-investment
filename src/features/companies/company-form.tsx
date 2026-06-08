"use client";

import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OptionField } from "@/components/ui/option-field";
import { useFieldOptions } from "@/lib/data/use-field-options";
import { COMPANY_FORM_FIELDS, COMPANY_OPTION_FIELDS } from "./fields";
import { sectorLabel } from "@/lib/sectors";
import { governorateLabel } from "@/lib/governorates";
import { saveCompany } from "./actions";
import type { Company } from "@/types/entities";

const OPTION_SET = new Set(COMPANY_OPTION_FIELDS);

function initialValue(o: Company | null | undefined, key: string): string {
  if (!o) return "";
  const v = (o as unknown as Record<string, unknown>)[key];
  if (v === null || v === undefined) return "";
  return String(v);
}

export function CompanyForm({
  open,
  onClose,
  initial,
  optionSets,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Company | null;
  optionSets?: Record<string, string[]>;
}) {
  const queryClient = useQueryClient();
  const { data: custom } = useFieldOptions();
  const [saving, setSaving] = useState(false);

  const merged = (key: string): string[] =>
    Array.from(new Set([...(optionSets?.[key] ?? []), ...(custom?.[key] ?? [])])).sort();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) {
      toast.error("اسم الشركة مطلوب");
      return;
    }
    setSaving(true);
    const values: Record<string, unknown> = {};
    for (const f of COMPANY_FORM_FIELDS) {
      const raw = String(fd.get(f.key) ?? "").trim();
      if (f.type === "boolean") {
        values[f.key] = raw === "" ? null : raw === "true";
      } else {
        values[f.key] = raw === "" ? null : f.type === "number" ? Number(raw) : raw; // فراغ→null (§ح)
      }
    }
    const res = await saveCompany(values, initial?.id);
    setSaving(false);
    if (res.ok) {
      toast.success(initial ? "حُفِّظت الشركة" : "أُضيفت الشركة");
      void queryClient.invalidateQueries({ queryKey: ["table", "companies"] });
      void queryClient.invalidateQueries({ queryKey: ["counts"] });
      onClose();
    } else {
      toast.error("تعذّر الحفظ — حاول مجدداً"); // §ز.2: النموذج يبقى بلا فقدان
    }
  }

  const compactFields = COMPANY_FORM_FIELDS.filter((f) => f.type !== "textarea");
  const textareaFields = COMPANY_FORM_FIELDS.filter((f) => f.type === "textarea");

  return (
    <Dialog open={open} onClose={onClose} title={initial ? "تعديل شركة" : "إضافة شركة"} size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {compactFields.map((f) => {
            if (f.type === "select" || f.type === "boolean") {
              return (
                <div key={f.key} className="space-y-1">
                  <label htmlFor={`co-${f.key}`} className="block text-xs text-muted-foreground">
                    {f.label}
                  </label>
                  <select
                    id={`co-${f.key}`}
                    name={f.key}
                    defaultValue={initialValue(initial, f.key) || (f.options?.[0]?.value ?? "")}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }
            if (OPTION_SET.has(f.key)) {
              // القطاع/المحافظة: عرض عربي والتخزين بالرمز (يُوحَّد في الحفظ).
              const isSector = f.key === "sector";
              const isGov = f.key === "governorate";
              const raw = initialValue(initial, f.key);
              const dv = isSector && raw ? sectorLabel(raw) : isGov && raw ? governorateLabel(raw) : raw;
              const opts = isSector
                ? merged(f.key).map((c) => sectorLabel(c))
                : isGov
                  ? merged(f.key).map((c) => governorateLabel(c))
                  : merged(f.key);
              return (
                <OptionField
                  key={f.key}
                  id={`co-${f.key}`}
                  name={f.key}
                  label={f.label}
                  defaultValue={dv}
                  fieldKey={f.key}
                  options={opts}
                />
              );
            }
            return (
              <div key={f.key} className="space-y-1">
                <label htmlFor={`co-${f.key}`} className="block text-xs text-muted-foreground">
                  {f.label}
                  {f.key === "name" ? <span className="text-destructive"> *</span> : null}
                </label>
                <input
                  id={`co-${f.key}`}
                  name={f.key}
                  type={f.type === "number" ? "number" : "text"}
                  step={f.type === "number" ? "any" : undefined}
                  required={f.key === "name"}
                  defaultValue={initialValue(initial, f.key)}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            );
          })}
        </div>

        {/* حقول النصّ المطوّل */}
        <div className="space-y-3">
          {textareaFields.map((f) => (
            <div key={f.key} className="space-y-1">
              <label htmlFor={`co-${f.key}`} className="block text-xs font-medium text-muted-foreground">
                {f.label}
              </label>
              <textarea
                id={`co-${f.key}`}
                name={f.key}
                rows={3}
                defaultValue={initialValue(initial, f.key)}
                className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-start gap-2 pt-1">
          <Button type="submit" disabled={saving}>
            {saving ? "جارٍ الحفظ…" : "حفظ"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            إلغاء
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
