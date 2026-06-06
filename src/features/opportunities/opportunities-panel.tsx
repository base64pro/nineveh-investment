"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { useTable } from "@/lib/data/use-table";
import { exportCsv } from "@/lib/export-csv";
import { formatArea, orNA } from "@/lib/display";
import { StateBadge } from "@/features/parcels/state-badge";
import { OpportunityForm } from "./opportunity-form";
import { deleteOpportunity } from "./actions";
import { OPPORTUNITY_EXPORT_COLUMNS } from "./fields";
import type { Opportunity } from "@/types/entities";

export function OpportunitiesPanel() {
  const { data, isLoading, isError } = useTable<Opportunity>("opportunities");
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);

  const sectors = useMemo(
    () => Array.from(new Set((data ?? []).map((o) => o.sector).filter((s): s is string => Boolean(s)))),
    [data],
  );

  const filtered = useMemo(() => {
    const list = data ?? [];
    const needle = q.trim().toLowerCase();
    return list.filter((o) => {
      if (sector && o.sector !== sector) return false;
      if (needle) {
        const hay = `${o.title ?? ""} ${o.parcel_no ?? ""} ${o.owner ?? ""} ${o.muqataa_name ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [data, q, sector]);

  async function onDelete(o: Opportunity) {
    if (!window.confirm(`حذف الفرصة «${o.title ?? "بلا عنوان"}»؟`)) return;
    const res = await deleteOpportunity(o.record_id);
    if (res.ok) {
      toast.success("حُذِفت الفرصة");
      void queryClient.invalidateQueries({ queryKey: ["table", "opportunities"] });
      void queryClient.invalidateQueries({ queryKey: ["counts"] });
    } else {
      toast.error("تعذّر الحذف");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-border p-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث (عنوان/قطعة/مالك/مقاطعة)…"
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          >
            <option value="">كل القطاعات</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground"
          >
            <Plus className="size-3.5" /> إضافة
          </button>
          <button
            type="button"
            onClick={() => exportCsv("opportunities.csv", filtered as unknown as Record<string, unknown>[], [...OPPORTUNITY_EXPORT_COLUMNS])}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs transition hover:bg-accent"
          >
            <Download className="size-3.5" /> تصدير
          </button>
          <span className="ms-auto text-xs text-muted-foreground">
            {filtered.length} / {(data ?? []).length}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading ? <p className="text-sm text-muted-foreground">جارٍ التحميل…</p> : null}
        {isError ? <p className="text-sm text-destructive">تعذّر تحميل البيانات.</p> : null}
        {!isLoading && filtered.length === 0 ? <p className="text-sm text-muted-foreground">لا نتائج.</p> : null}
        <ul className="space-y-2">
          {filtered.map((o) => (
            <li key={o.record_id} className="rounded-lg border border-border bg-background/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold">{orNA(o.title)}</h4>
                <StateBadge state="announced" />
              </div>
              <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <div>القطاع: {orNA(o.sector)}</div>
                <div>القطعة: {orNA(o.parcel_no)}</div>
                <div>المقاطعة: {orNA(o.muqataa_no)}</div>
                <div>المساحة: {formatArea(o.area_total_m2)}</div>
                <div className="col-span-2">العائدية: {orNA(o.owner)}</div>
              </dl>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(o);
                    setFormOpen(true);
                  }}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs transition hover:bg-accent"
                >
                  <Pencil className="size-3" /> تعديل
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete(o)}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-destructive transition hover:bg-destructive/10"
                >
                  <Trash2 className="size-3" /> حذف
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <OpportunityForm open={formOpen} onClose={() => setFormOpen(false)} initial={editing} />
    </div>
  );
}
