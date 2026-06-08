"use client";

import { useEffect, useMemo, useState } from "react";
import { useTable } from "@/lib/data/use-table";
import { NINEVEH_DISTRICTS, NINEVEH_SUBDISTRICTS } from "@/lib/nineveh-geo";
import { onOpenParcelDetail, onOpenParcelForm } from "@/features/map/lib/map-nav-store";
import { AssumedForm } from "./assumed-form";
import { AssumedDetail } from "./assumed-detail";
import type { AssumedParcel } from "@/types/entities";

const distinct = (values: (string | null)[]): string[] =>
  Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort();

/**
 * نوافذ القطعة المفترضة (نموذج/تفاصيل) **عامّة** — تُفتح من الخريطة (بعد الرسم أو من إشارة القطعة)
 * أيّاً كان قسم السايدبار المفتوح. تُركَّب في القشرة.
 */
export function AssumedModals() {
  const { data } = useTable<AssumedParcel>("assumed_parcels");
  const all = useMemo(() => data ?? [], [data]);
  const [formId, setFormId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => onOpenParcelForm((id) => setFormId(id)), []);
  useEffect(() => onOpenParcelDetail((id) => setDetailId(id)), []);

  const formParcel = useMemo(() => all.find((a) => a.id === formId) ?? null, [all, formId]);
  const detailParcel = useMemo(() => all.find((a) => a.id === detailId) ?? null, [all, detailId]);

  const optionSets = useMemo(
    () => ({
      sector: distinct(all.map((a) => a.sector)),
      district: Array.from(new Set([...NINEVEH_DISTRICTS, ...distinct(all.map((a) => a.district))])).sort(),
      subdistrict: Array.from(new Set([...NINEVEH_SUBDISTRICTS, ...distinct(all.map((a) => a.subdistrict))])).sort(),
      neighborhood: distinct(all.map((a) => a.neighborhood)),
      muqataa_name: distinct(all.map((a) => a.muqataa_name)),
      land_right: distinct(all.map((a) => a.land_right)),
    }),
    [all],
  );

  return (
    <>
      <AssumedForm
        open={formId !== null && formParcel !== null}
        onClose={() => setFormId(null)}
        initial={formParcel}
        optionSets={optionSets}
      />
      <AssumedDetail open={detailId !== null && detailParcel !== null} onClose={() => setDetailId(null)} parcel={detailParcel} />
    </>
  );
}
