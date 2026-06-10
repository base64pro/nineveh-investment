// مدخل المحرّك الحتمي §ج.9 من كيان القطعة — **وحدة نقية واحدة** (مصدر وحيد، لا انجراف بين النسخ).
// تستهلكها: تاب الضوابط (عميل) · تقرير الـPDF (خادم) · التوصيات (خادم).
import type { ParcelKind } from "@/features/map/lib/map-nav-store";
import type { ParcelState } from "@/types/entities";
import type { ControlsInput } from "./controls-engine";

export const numField = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const strField = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

/** حالة القطعة من كيانها (فرصة=معلَنة · رخصة=status · مفترضة=state). */
export function parcelStateOf(kind: ParcelKind, e: Record<string, unknown>): ParcelState {
  if (kind === "opportunity") return "announced";
  if (kind === "license") return (strField(e.status) as ParcelState | null) ?? "in-progress";
  return (strField(e.state) as ParcelState | null) ?? "assumed";
}

export function toControlsInput(kind: ParcelKind, e: Record<string, unknown>): ControlsInput {
  const capitalUsd = kind === "license" ? numField(e.capital) : kind === "assumed" ? numField(e.value) : null;
  return {
    state: parcelStateOf(kind, e),
    sector: strField(e.sector),
    capitalUsd,
    projectValueUsd: capitalUsd,
    landRight: strField(e.land_right),
    nationality: strField(e.investor_nationality),
    owner: strField(e.owner),
    withdrawalReason: strField(e.withdrawal_reason),
  };
}
