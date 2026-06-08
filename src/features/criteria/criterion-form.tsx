"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ComboField } from "@/components/ui/combo-field";
import { asItems, CRITERION_DOMAINS, CRITERION_STATUSES, type CriterionItem } from "./fields";
import { saveCriterion } from "./actions";
import type { Criterion } from "@/types/entities";

const INPUT = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";

export function CriterionForm({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Criterion | null;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<CriterionItem[]>([]);

  // تهيئة البنود عند كل فتح (النموذج يبقى مركّباً).
  useEffect(() => {
    if (open) setItems(asItems(initial?.items));
  }, [open, initial]);

  function patchItem(i: number, patch: Partial<CriterionItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { description: null, basis: null, weight: null, support_indicator: null }]);
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) {
      toast.error("اسم المعيار مطلوب");
      return;
    }
    const domain = String(fd.get("domain") ?? "").trim();
    const status = String(fd.get("status") ?? "active").trim() || "active";
    const purpose = String(fd.get("purpose") ?? "").trim();
    const cleanItems = items
      .map((it) => ({
        description: it.description?.trim() || null,
        basis: it.basis?.trim() || null,
        weight: it.weight?.trim() || null,
        support_indicator: it.support_indicator?.trim() || null,
      }))
      .filter((it) => it.description || it.basis || it.weight || it.support_indicator);
    const values = { name, domain: domain || null, purpose: purpose || null, status, items: cleanItems };
    setSaving(true);
    const res = await saveCriterion(values, initial?.id);
    setSaving(false);
    if (res.ok) {
      toast.success(initial ? "حُفِّظ المعيار" : "أُضيف المعيار");
      void queryClient.invalidateQueries({ queryKey: ["table", "criteria"] });
      void queryClient.invalidateQueries({ queryKey: ["counts"] });
      onClose();
    } else {
      toast.error("تعذّر الحفظ — حاول مجدداً");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial ? "تعديل معيار" : "معيار جديد"} size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="cr-name" className="block text-xs text-muted-foreground">
              الاسم<span className="text-destructive"> *</span>
            </label>
            <input id="cr-name" name="name" required defaultValue={initial?.name ?? ""} className={INPUT} />
          </div>
          <div className="space-y-1">
            <label htmlFor="cr-domain" className="block text-xs text-muted-foreground">المجال</label>
            <ComboField id="cr-domain" name="domain" defaultValue={initial?.domain ?? ""} options={[{ value: "", label: "غير محدّد" }, ...CRITERION_DOMAINS]} ariaLabel="المجال" />
          </div>
          <div className="space-y-1">
            <label htmlFor="cr-status" className="block text-xs text-muted-foreground">الحالة</label>
            <ComboField id="cr-status" name="status" defaultValue={initial?.status ?? "active"} options={[...CRITERION_STATUSES]} ariaLabel="الحالة" />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="cr-purpose" className="block text-xs font-medium text-muted-foreground">الغرض</label>
          <textarea id="cr-purpose" name="purpose" rows={2} defaultValue={initial?.purpose ?? ""} className={INPUT + " min-h-16 leading-relaxed"} />
        </div>

        {/* محرّر البنود (وصف · أساس · وزن · مؤشّر الدعم) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-primary/80">البنود ({items.length})</span>
            <Button type="button" size="sm" variant="outline" onClick={addItem}>
              <Plus className="size-3.5" /> بند
            </Button>
          </div>
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا بنود — أضِف بنداً أو احفظ بلا بنود.</p>
          ) : null}
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="space-y-1.5 rounded-lg border border-border/60 bg-card/50 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground">بند {i + 1}</span>
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(i)} aria-label="حذف البند" title="حذف البند">
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
                <input value={it.description ?? ""} onChange={(e) => patchItem(i, { description: e.target.value })} placeholder="الوصف" className={INPUT} />
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  <input value={it.basis ?? ""} onChange={(e) => patchItem(i, { basis: e.target.value })} placeholder="الأساس" className={INPUT} />
                  <input value={it.weight ?? ""} onChange={(e) => patchItem(i, { weight: e.target.value })} placeholder="الوزن" className={INPUT} />
                  <input value={it.support_indicator ?? ""} onChange={(e) => patchItem(i, { support_indicator: e.target.value })} placeholder="مؤشّر الدعم" className={INPUT} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-start gap-2 pt-1">
          <Button type="submit" disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ"}</Button>
          <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
        </div>
      </form>
    </Dialog>
  );
}
