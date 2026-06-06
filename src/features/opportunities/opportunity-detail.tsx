"use client";

import { Dialog } from "@/components/ui/dialog";
import { formatDate, NOT_AVAILABLE, orNA } from "@/lib/display";
import { formatNumber } from "@/lib/format";
import { OPPORTUNITY_DETAIL_FIELDS } from "./fields";
import type { Opportunity } from "@/types/entities";

function fieldValue(o: Opportunity, key: string, type: string): string {
  const v = (o as unknown as Record<string, unknown>)[key];
  if (type === "date") return formatDate(typeof v === "string" ? v : null);
  if (type === "number") return v === null || v === undefined ? NOT_AVAILABLE : formatNumber(Number(v));
  return orNA(v);
}

export function OpportunityDetail({
  open,
  onClose,
  opportunity,
}: {
  open: boolean;
  onClose: () => void;
  opportunity: Opportunity | null;
}) {
  if (!opportunity) return null;
  return (
    <Dialog open={open} onClose={onClose} title={opportunity.title ?? "تفاصيل الفرصة"}>
      <dl className="space-y-2 text-sm">
        {OPPORTUNITY_DETAIL_FIELDS.map((f) => (
          <div key={f.key} className="grid grid-cols-3 gap-2 border-b border-border/50 pb-1.5">
            <dt className="text-xs text-muted-foreground">{f.label}</dt>
            <dd className="col-span-2 break-words">{fieldValue(opportunity, f.key, f.type)}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
