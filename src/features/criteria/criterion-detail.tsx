"use client";

import { Layers, Tag } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { NOT_AVAILABLE, orNA } from "@/lib/display";
import { asItems, domainLabel } from "./fields";
import type { Criterion } from "@/types/entities";

export function CriterionDetail({
  open,
  onClose,
  criterion,
}: {
  open: boolean;
  onClose: () => void;
  criterion: Criterion | null;
}) {
  if (!criterion) return null;
  const o = criterion;
  const items = asItems(o.items);

  return (
    <Dialog open={open} onClose={onClose} title={o.name ?? "تفاصيل المعيار"} size="xl">
      <div className="space-y-5">
        {/* بطاقة موجزة */}
        <div className="rounded-2xl border border-border/60 bg-gradient-to-l from-primary/10 via-card to-card p-4 shadow-[0_0_36px_-14px] shadow-primary/40">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2.5 py-0.5 text-xs text-secondary-foreground">
              <Tag className="size-3 opacity-70" /> {domainLabel(o.domain) || "غير محدّد"}
            </span>
            {o.status === "active" ? (
              <span className="rounded-full bg-state-completed/15 px-2.5 py-0.5 text-xs font-medium text-state-completed ring-1 ring-state-completed/40">مفعّل</span>
            ) : (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">معطّل</span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Layers className="size-3.5" /> {items.length} بنداً
            </span>
          </div>
          {o.purpose ? <p className="mt-3 text-sm leading-relaxed text-foreground/90">{o.purpose}</p> : null}
        </div>

        {/* البنود */}
        <section className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-xs font-bold text-primary/80">
            <Layers className="size-3.5" /> البنود
          </h4>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{NOT_AVAILABLE}</p>
          ) : (
            <ul className="space-y-2">
              {items.map((it, i) => (
                <li key={i} className="rounded-xl border border-border/60 bg-background/40 p-3">
                  <p className="text-sm font-semibold">{orNA(it.description)}</p>
                  <dl className="mt-1.5 grid grid-cols-1 gap-1 text-xs sm:grid-cols-3">
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">الأساس:</dt>
                      <dd className="min-w-0 break-words font-medium">{orNA(it.basis)}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">الوزن:</dt>
                      <dd className="font-medium">{orNA(it.weight)}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">مؤشّر الدعم:</dt>
                      <dd className="min-w-0 break-words font-medium">{orNA(it.support_indicator)}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Dialog>
  );
}
