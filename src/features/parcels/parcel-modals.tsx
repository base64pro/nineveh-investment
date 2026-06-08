"use client";

// النوافذ العامّة للقطعة (تُركَّب في القشرة) — تُفتح من الخريطة أو السايدبار، أيّاً كان القسم المفتوح:
// • نافذة القطعة الموحّدة (تفاصيل/تحرير) للأنواع الثلاثة — حدث onOpenParcelDetail.
// • نموذج القطعة المفترضة بعد الرسم — حدث onOpenParcelForm.

import { useEffect, useMemo, useState } from "react";
import { useTable } from "@/lib/data/use-table";
import { NINEVEH_DISTRICTS, NINEVEH_SUBDISTRICTS } from "@/lib/nineveh-geo";
import { onOpenParcelDetail, onOpenParcelForm, type ParcelRef } from "@/features/map/lib/map-nav-store";
import { AssumedForm } from "@/features/assumed/assumed-form";
import { ParcelWindow } from "@/features/parcels/parcel-window";
import type { AssumedParcel, License, Opportunity } from "@/types/entities";

const distinct = (values: (string | null)[]): string[] =>
  Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort();

export function ParcelModals() {
  const { data: opps } = useTable<Opportunity>("opportunities");
  const { data: lics } = useTable<License>("licenses");
  const { data: assumed } = useTable<AssumedParcel>("assumed_parcels");
  const allAssumed = useMemo(() => assumed ?? [], [assumed]);

  const [formId, setFormId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ParcelRef | null>(null);

  useEffect(() => onOpenParcelForm((id) => setFormId(id)), []);
  useEffect(() => onOpenParcelDetail((ref) => setDetail(ref)), []);

  const formParcel = useMemo(() => allAssumed.find((a) => a.id === formId) ?? null, [allAssumed, formId]);

  const detailEntity = useMemo((): Record<string, unknown> | null => {
    if (!detail) return null;
    const found =
      detail.kind === "assumed"
        ? allAssumed.find((a) => a.id === detail.id)
        : detail.kind === "license"
          ? (lics ?? []).find((l) => String(l.record_id) === detail.id)
          : (opps ?? []).find((o) => String(o.record_id) === detail.id);
    return (found as unknown as Record<string, unknown> | undefined) ?? null;
  }, [detail, allAssumed, lics, opps]);

  const optionSets = useMemo(
    () => ({
      sector: distinct(allAssumed.map((a) => a.sector)),
      district: Array.from(new Set([...NINEVEH_DISTRICTS, ...distinct(allAssumed.map((a) => a.district))])).sort(),
      subdistrict: Array.from(new Set([...NINEVEH_SUBDISTRICTS, ...distinct(allAssumed.map((a) => a.subdistrict))])).sort(),
      neighborhood: distinct(allAssumed.map((a) => a.neighborhood)),
      muqataa_name: distinct(allAssumed.map((a) => a.muqataa_name)),
      land_right: distinct(allAssumed.map((a) => a.land_right)),
    }),
    [allAssumed],
  );

  return (
    <>
      <AssumedForm
        open={formId !== null && formParcel !== null}
        onClose={() => setFormId(null)}
        initial={formParcel}
        optionSets={optionSets}
      />
      {detail && detailEntity ? (
        <ParcelWindow kind={detail.kind} entity={detailEntity} onClose={() => setDetail(null)} />
      ) : null}
    </>
  );
}
