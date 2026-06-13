"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCheck,
  ChevronDown,
  Download,
  Eye,
  FilterX,
  Layers,
  ListChecks,
  Pencil,
  Plus,
  Power,
  Tag,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useTable } from "@/lib/data/use-table";
import { useSettings } from "@/features/settings/use-settings";
import { cn } from "@/lib/utils";
import { exportTable } from "@/lib/export-table";
import { formatDate, orNA } from "@/lib/display";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterCombo } from "@/components/ui/filter-combo";
import { CriterionForm } from "./criterion-form";
import { CriterionDetail } from "./criterion-detail";
import { deleteCriterion, setCriterionStatus } from "./actions";
import { asItems, criterionStatusLabel, domainLabel, CRITERION_DOMAINS, CRITERION_EXPORT_COLUMNS, CRITERION_STATUSES } from "./fields";
import type { Criterion } from "@/types/entities";
import { useRole } from "@/features/auth/role-context";

const ORB =
  "relative grid place-items-center rounded-full text-foreground bg-[radial-gradient(circle_at_50%_28%,#4f6498,#2a3a5c)] shadow-[inset_0_1px_2px_rgba(255,255,255,0.32),0_10px_22px_-8px_rgba(0,0,0,0.7)] transition hover:-translate-y-0.5 hover:shadow-[inset_0_1px_2px_rgba(255,255,255,0.45),0_15px_28px_-8px_rgba(0,0,0,0.85)] active:translate-y-0 active:scale-95";

const DOMAIN_OPTIONS = CRITERION_DOMAINS.map((d) => d.label);
const STATUS_OPTIONS = CRITERION_STATUSES.map((s) => s.label);

function Chip({ icon: Icon, value }: { icon: LucideIcon; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-0.5 text-[11px] text-secondary-foreground">
      <Icon className="size-3 opacity-70" /> {value}
    </span>
  );
}

export function CriteriaPanel() {
  const { data, isLoading, isError, refetch } = useTable<Criterion>("criteria");
  const queryClient = useQueryClient();
  const { isViewer } = useRole();

  const [q, setQ] = useState("");
  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Criterion | null>(null);
  const [detail, setDetail] = useState<Criterion | null>(null);

  const all = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const dNeedle = domain.trim();
    const stNeedle = status.trim();
    return all.filter((o) => {
      if (dNeedle && !domainLabel(o.domain).includes(dNeedle)) return false;
      if (stNeedle && !criterionStatusLabel(o.status).includes(stNeedle)) return false;
      if (needle) {
        const hay = `${o.name ?? ""} ${o.purpose ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [all, q, domain, status]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selected.has(o.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allFilteredSelected ? new Set() : new Set(filtered.map((o) => o.id)));
  }
  const { data: settingsData } = useSettings();
  const exportFormat = settingsData?.settings.default_export ?? "pdf";
  async function onExport() {
    const rows = selected.size ? filtered.filter((o) => selected.has(o.id)) : filtered;
    const ok = await exportTable(exportFormat, "criteria.csv", "تقرير مكتبة المعايير", rows as unknown as Record<string, unknown>[], [...CRITERION_EXPORT_COLUMNS]);
    if (!ok) toast.error("تعذّر تصدير الـPDF — حاول مجدداً");
  }
  const hasFilters = Boolean(q || domain || status);
  function clearFilters() {
    setQ("");
    setDomain("");
    setStatus("");
  }
  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["table", "criteria"] });
    void queryClient.invalidateQueries({ queryKey: ["counts"] });
  }
  async function onToggleStatus(o: Criterion) {
    const res = await setCriterionStatus(o.id, o.status === "active" ? "disabled" : "active");
    if (res.ok) {
      toast.success(o.status === "active" ? "عُطِّل المعيار" : "فُعِّل المعيار");
      invalidate();
    } else {
      toast.error("تعذّر التغيير");
    }
  }
  async function onDelete(o: Criterion) {
    if (!window.confirm(`حذف المعيار «${o.name}»؟`)) return;
    const res = await deleteCriterion(o.id);
    if (res.ok) {
      toast.success("حُذِف المعيار");
      invalidate();
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
          placeholder="بحث (الاسم/الغرض)…"
          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {/* تصفية: المجال · الحالة */}
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <FilterCombo value={domain} onChange={setDomain} options={DOMAIN_OPTIONS} placeholder="المجال" />
          <FilterCombo value={status} onChange={setStatus} options={STATUS_OPTIONS} placeholder="الحالة" />
        </div>
        {/* ثلاث دوائر إجراء: تصدير · معيار جديد · تحديد الكل */}
        <div className="relative flex items-center justify-center gap-3 pt-1">
          <span className="absolute start-0 top-1/2 -translate-y-1/2 text-[10px] font-semibold tabular-nums text-muted-foreground">
            {filtered.length}/{all.length}{selected.size ? ` · ${selected.size}` : ""}
          </span>
          <button type="button" onClick={() => void onExport()} title={`تصدير ${exportFormat === "pdf" ? "PDF" : "CSV"}`} aria-label="تصدير" className={cn(ORB, "size-12")}>
            <Download className="size-4" />
          </button>
          <button type="button" onClick={() => { setEditing(null); setFormOpen(true); }} title="معيار جديد" aria-label="معيار جديد" className={cn(ORB, "size-12")}>
            <Plus className="size-5" />
          </button>
          <button type="button" onClick={toggleAll} title={allFilteredSelected ? "إلغاء تحديد الكل" : "تحديد الكل"} aria-label="تحديد/إلغاء تحديد الكل" className={cn(ORB, "size-12")}>
            {allFilteredSelected ? <CheckCheck className="size-4" /> : <ListChecks className="size-4" />}
          </button>
          <button type="button" onClick={clearFilters} disabled={!hasFilters} title="مسح التصفية (عودة للكل)" aria-label="مسح التصفية" className={cn(ORB, "size-12", !hasFilters && "opacity-40")}>
            <FilterX className="size-4" />
          </button>
        </div>
      </div>

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : null}

        {isError ? (
          <div className="space-y-2 text-sm">
            <p className="text-destructive">تعذّر تحميل البيانات.</p>
            <Button size="sm" variant="outline" onClick={() => void refetch()}>إعادة المحاولة</Button>
          </div>
        ) : null}

        {!isLoading && !isError && filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا معايير محفوظة بعد — أضِف «معيار جديد».</p>
        ) : null}

        <ul className="space-y-2.5">
          {filtered.map((o) => {
            const isOpen = expanded.has(o.id);
            const itemCount = asItems(o.items).length;
            const isActive = o.status === "active";
            return (
              <li
                key={o.id}
                className="group relative overflow-hidden rounded-xl [content-visibility:auto] [contain-intrinsic-size:auto_120px] border border-foreground/30 ring-1 ring-inset ring-foreground/10 bg-gradient-to-br from-card/85 via-card/55 to-card/35 shadow-sm transition-all duration-200 hover:border-foreground/50 hover:ring-foreground/20 hover:shadow-[0_12px_34px_-14px] hover:shadow-foreground/10"
              >
                <span
                  className={cn("absolute inset-y-0 start-0 w-1 bg-gradient-to-b", isActive ? "from-state-completed to-state-completed/20" : "from-border to-border/10")}
                  aria-hidden
                />
                <div className="flex items-start gap-2 ps-4 pe-3">
                  <input
                    type="checkbox"
                    checked={selected.has(o.id)}
                    onChange={() => toggleOne(o.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 size-4 shrink-0 cursor-pointer accent-state-completed"
                    aria-label="تحديد"
                  />
                  <button
                    type="button"
                    onClick={() => toggleExpand(o.id)}
                    aria-expanded={isOpen}
                    className="flex min-w-0 flex-1 flex-col gap-1.5 py-2.5 text-start"
                  >
                    <div className="flex w-full items-start gap-2">
                      <h4 className={cn("min-w-0 flex-1 text-[15px] font-semibold leading-snug", isOpen ? "line-clamp-2" : "truncate")}>
                        {orNA(o.name)}
                      </h4>
                      <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} aria-hidden />
                    </div>
                    <div className="flex w-full items-center gap-2">
                      <Chip icon={Tag} value={domainLabel(o.domain) || "غير محدّد"} />
                      <Chip icon={Layers} value={`${formatNumber(itemCount)} بند`} />
                      <span className="ms-auto">
                        {isActive ? (
                          <span className="rounded-full bg-state-completed/15 px-2 py-0.5 text-[10px] font-medium text-state-completed ring-1 ring-state-completed/40">مفعّل</span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border">معطّل</span>
                        )}
                      </span>
                    </div>
                  </button>
                </div>

                {isOpen ? (
                  <div className="px-3.5 pb-3.5 ps-4">
                    {o.purpose ? (
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">{o.purpose}</p>
                    ) : null}
                    <p className="mt-2 text-[10px] text-muted-foreground">آخر تحديث: {formatDate(o.updated_at)}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2.5">
                      <Button size="sm" variant="outline" onClick={() => setDetail(o)} title="عرض">
                        <Eye className="size-3.5" /> عرض
                      </Button>
                      {!isViewer ? (
                      <>
                      <Button size="sm" variant="outline" onClick={() => { setEditing(o); setFormOpen(true); }} title="تعديل">
                        <Pencil className="size-3.5" /> تعديل
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void onToggleStatus(o)} title={isActive ? "تعطيل" : "تفعيل"}>
                        <Power className="size-3.5" /> {isActive ? "تعطيل" : "تفعيل"}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => void onDelete(o)} title="حذف" className="ms-auto">
                        <Trash2 className="size-3.5" /> حذف
                      </Button>
                      </>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <CriterionForm open={formOpen} onClose={() => setFormOpen(false)} initial={editing} />
      <CriterionDetail open={detail !== null} onClose={() => setDetail(null)} criterion={detail} />
    </div>
  );
}
