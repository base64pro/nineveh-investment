"use client";

import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OptionField } from "@/components/ui/option-field";
import { useFieldOptions } from "@/lib/data/use-field-options";
import { ASSUMED_FORM_FIELDS, ASSUMED_OPTION_FIELDS } from "./fields";
import { sectorLabel } from "@/lib/sectors";
import { saveAssumed } from "./actions";
import type { AssumedParcel } from "@/types/entities";

const OPTION_SET = new Set(ASSUMED_OPTION_FIELDS);

function initialValue(o: AssumedParcel | null | undefined, key: string): string {
  if (!o) return "";
  const v = (o as unknown as Record<string, unknown>)[key];
  if (v === null || v === undefined) return "";
  return String(v);
}

export function AssumedForm({
  open,
  onClose,
  initial,
  optionSets,
}: {
  open: boolean;
  onClose: () => void;
  initial?: AssumedParcel | null;
  optionSets?: Record<string, string[]>;
}) {
  const queryClient = useQueryClient();
  const { data: custom } = useFieldOptions();
  const [saving, setSaving] = useState(false);

  const merged = (key: string): string[] =>
    Array.from(new Set([...(optionSets?.[key] ?? []), ...(custom?.[key] ?? [])])).sort();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const values: Record<string, unknown> = {};
    for (const f of ASSUMED_FORM_FIELDS) {
      const raw = String(fd.get(f.key) ?? "").trim();
      values[f.key] = raw === "" ? null : f.type === "number" ? Number(raw) : raw; // فراغ→null (§ح)
    }
    const res = await saveAssumed(values, initial?.id);
    setSaving(false);
    if (res.ok) {
      toast.success(initial ? "حُفِّظت القطعة المفترضة" : "أُضيفت قطعة مفترضة");
      void queryClient.invalidateQueries({ queryKey: ["table", "assumed_parcels"] });
      void queryClient.invalidateQueries({ queryKey: ["counts"] });
      onClose();
    } else {
      toast.error("تعذّر الحفظ — حاول مجدداً");
    }
  }

  const compactFields = ASSUMED_FORM_FIELDS.filter((f) => f.type !== "textarea");
  const textareaFields = ASSUMED_FORM_FIELDS.filter((f) => f.type === "textarea");

  return (
    <Dialog open={open} onClose={onClose} title={initial ? "تعديل قطعة مفترضة" : "قطعة مفترضة جديدة"} size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="rounded-md bg-state-assumed/10 px-2.5 py-1.5 text-[11px] text-state-assumed ring-1 ring-state-assumed/30">
          الحالة: مفترضة 🟣 — الحدود (المضلّع) تُرسَم على الخريطة لاحقاً (أداة الرسم).
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {compactFields.map((f) => {
            if (OPTION_SET.has(f.key)) {
              const isSector = f.key === "sector";
              const raw = initialValue(initial, f.key);
              const dv = isSector && raw ? sectorLabel(raw) : raw;
              const opts = isSector ? merged(f.key).map((c) => sectorLabel(c)) : merged(f.key);
              return (
                <OptionField
                  key={f.key}
                  id={`as-${f.key}`}
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
                <label htmlFor={`as-${f.key}`} className="block text-xs text-muted-foreground">{f.label}</label>
                <input
                  id={`as-${f.key}`}
                  name={f.key}
                  type={f.type === "number" ? "number" : "text"}
                  step={f.type === "number" ? "any" : undefined}
                  defaultValue={initialValue(initial, f.key)}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          {textareaFields.map((f) => (
            <div key={f.key} className="space-y-1">
              <label htmlFor={`as-${f.key}`} className="block text-xs font-medium text-muted-foreground">{f.label}</label>
              <textarea
                id={`as-${f.key}`}
                name={f.key}
                rows={3}
                defaultValue={initialValue(initial, f.key)}
                className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-start gap-2 pt-1">
          <Button type="submit" disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ"}</Button>
          <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
        </div>
      </form>
    </Dialog>
  );
}
