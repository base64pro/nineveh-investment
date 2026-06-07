"use client";

import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OPPORTUNITY_FORM_FIELDS, OPPORTUNITY_OPTION_FIELDS } from "./fields";
import { saveOpportunity } from "./actions";
import type { Opportunity } from "@/types/entities";

function initialValue(o: Opportunity | null | undefined, key: string): string {
  if (!o) return "";
  const v = (o as unknown as Record<string, unknown>)[key];
  if (v === null || v === undefined) return "";
  if (key.endsWith("_date") || key === "deadline") return String(v).slice(0, 10);
  return String(v);
}

export function OpportunityForm({
  open,
  onClose,
  initial,
  optionSets,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Opportunity | null;
  optionSets?: Record<string, string[]>;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const values: Record<string, unknown> = {};
    for (const f of OPPORTUNITY_FORM_FIELDS) {
      const raw = String(fd.get(f.key) ?? "").trim();
      values[f.key] = raw === "" ? null : f.type === "number" ? Number(raw) : raw; // فراغ→null (لا تأليف §ح)
    }
    const res = await saveOpportunity(values, initial?.record_id);
    setSaving(false);
    if (res.ok) {
      toast.success(initial ? "حُفِّظت الفرصة" : "أُضيفت الفرصة");
      void queryClient.invalidateQueries({ queryKey: ["table", "opportunities"] });
      void queryClient.invalidateQueries({ queryKey: ["counts"] });
      onClose();
    } else {
      toast.error("تعذّر الحفظ — حاول مجدداً"); // §ز.2: النموذج يبقى بلا فقدان
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial ? "تعديل فرصة" : "إضافة فرصة"} size="lg">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {OPPORTUNITY_FORM_FIELDS.map((f) => {
            const options = OPPORTUNITY_OPTION_FIELDS.includes(f.key) ? (optionSets?.[f.key] ?? []) : null;
            const isWide = f.type === "textarea";
            return (
              <div key={f.key} className={isWide ? "space-y-1 sm:col-span-2" : "space-y-1"}>
                <label htmlFor={`opp-${f.key}`} className="block text-xs text-muted-foreground">
                  {f.label}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    id={`opp-${f.key}`}
                    name={f.key}
                    rows={2}
                    defaultValue={initialValue(initial, f.key)}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                ) : (
                  <>
                    <input
                      id={`opp-${f.key}`}
                      name={f.key}
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      step={f.type === "number" ? "any" : undefined}
                      list={options ? `dl-${f.key}` : undefined}
                      defaultValue={initialValue(initial, f.key)}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                    {options ? (
                      <datalist id={`dl-${f.key}`}>
                        {options.map((opt) => (
                          <option key={opt} value={opt} />
                        ))}
                      </datalist>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
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
