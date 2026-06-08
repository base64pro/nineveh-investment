"use client";

import { useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { addFieldOption } from "@/lib/data/field-options-actions";
import { Combo } from "@/components/ui/combo";

/** حقل بمنسدلة أنيقة (Combo) + إدخال حرّ + تعريف خيار جديد يُحفظ ويُعاد استخدامه.
 *  يحمل القيمة عبر input خفيّ باسم الحقل ليلتقطها FormData في النماذج غير المضبوطة. */
export function OptionField({
  id,
  name,
  label,
  defaultValue,
  fieldKey,
  options,
  disabled = false,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  fieldKey: string;
  options: string[];
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(defaultValue);
  const [adding, setAdding] = useState(false);
  const [newOpt, setNewOpt] = useState("");
  const comboOptions = useMemo(() => options.map((o) => ({ value: o, label: o })), [options]);

  async function save() {
    const v = newOpt.trim();
    if (!v) return;
    const res = await addFieldOption(fieldKey, v);
    if (res.ok) {
      toast.success("أُضيف الخيار");
      void queryClient.invalidateQueries({ queryKey: ["table", "field_options"] });
      setValue(v);
      setNewOpt("");
      setAdding(false);
    } else {
      toast.error("تعذّرت الإضافة");
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-xs text-muted-foreground">
          {label}
        </label>
        {!disabled ? (
          <button
            type="button"
            onClick={() => setAdding((a) => !a)}
            className="inline-flex items-center gap-0.5 text-[10px] text-primary transition hover:underline"
            title="تعريف خيار جديد لهذا الحقل"
          >
            <Plus className="size-3" /> خيار
          </button>
        ) : null}
      </div>
      <input type="hidden" name={name} value={value} />
      <Combo id={id} value={value} onChange={setValue} options={comboOptions} allowCustom disabled={disabled} ariaLabel={label} placeholder="اختر أو اكتب…" />
      {adding && !disabled ? (
        <div className="flex gap-1">
          <input
            value={newOpt}
            onChange={(e) => setNewOpt(e.target.value)}
            placeholder="عرّف خياراً جديداً…"
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void save();
              }
            }}
          />
          <button
            type="button"
            onClick={() => void save()}
            aria-label="حفظ الخيار"
            className="rounded-md bg-primary px-2 text-primary-foreground transition hover:opacity-90"
          >
            <Check className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
