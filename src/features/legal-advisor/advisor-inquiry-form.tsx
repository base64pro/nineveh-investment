"use client";

// المستشار — الشق الأول (استمارة استعلام) §هـ.5. معطيات محدّدة ← فحص حتمي بمحرّك الضوابط §ج.9 باستشهاد.

import { type ReactNode, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Combo, type ComboOption } from "@/components/ui/combo";
import { Button } from "@/components/ui/button";
import { SECTOR_LABELS } from "@/lib/sectors";
import { ControlsTab } from "@/features/parcels/legal/controls-tab";

const SECTOR_OPTS: ComboOption[] = Object.entries(SECTOR_LABELS).map(([value, label]) => ({ value, label }));
const OWNER_OPTS: ComboOption[] = [
  { value: "دولة", label: "دولة" },
  { value: "خاصة", label: "خاصة" },
];
const RIGHT_OPTS: ComboOption[] = [
  { value: "تملّك", label: "تملّك" },
  { value: "مساطحة", label: "مساطحة" },
  { value: "إيجار", label: "إيجار" },
  { value: "تخصيص", label: "تخصيص" },
];
const NAT_OPTS: ComboOption[] = [
  { value: "عراقي", label: "عراقي" },
  { value: "أجنبي", label: "أجنبي" },
  { value: "مشترك", label: "مشترك" },
];

const INPUT = "w-full rounded-lg border border-input bg-background/60 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export function AdvisorInquiryForm() {
  const [sector, setSector] = useState("");
  const [owner, setOwner] = useState("");
  const [landRight, setLandRight] = useState("");
  const [nationality, setNationality] = useState("");
  const [area, setArea] = useState("");
  const [capital, setCapital] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  function run() {
    const cap = capital.trim() === "" ? null : Number(capital);
    setResult({
      status: "in-progress",
      sector: sector || null,
      owner: owner || null,
      land_right: landRight || null,
      investor_nationality: nationality || null,
      area_total_m2: area.trim() === "" ? null : Number(area),
      capital: cap,
      value: cap,
    });
  }

  return (
    <div className="scroll-slim h-full space-y-3 overflow-y-auto p-3">
      <p className="text-[11px] text-muted-foreground">املأ المعطيات ← فحص حتمي بالضوابط والمعايير القانونية باستشهاد (§ج.9). الناقص يُعرَض كمتطلَّب لا استيفاء.</p>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label="القطاع/النشاط">
          <Combo value={sector} onChange={setSector} options={SECTOR_OPTS} placeholder="اختر…" ariaLabel="القطاع" />
        </Field>
        <Field label="العائدية">
          <Combo value={owner} onChange={setOwner} options={OWNER_OPTS} placeholder="اختر…" ariaLabel="العائدية" />
        </Field>
        <Field label="نوع الحقّ">
          <Combo value={landRight} onChange={setLandRight} options={RIGHT_OPTS} placeholder="اختر…" ariaLabel="نوع الحقّ" />
        </Field>
        <Field label="جنسية المستثمر">
          <Combo value={nationality} onChange={setNationality} options={NAT_OPTS} placeholder="اختر…" ariaLabel="الجنسية" />
        </Field>
        <Field label="المساحة (م²)">
          <input value={area} onChange={(e) => setArea(e.target.value)} type="number" step="any" className={INPUT} />
        </Field>
        <Field label="رأس المال/القيمة (دولار)">
          <input value={capital} onChange={(e) => setCapital(e.target.value)} type="number" step="any" className={INPUT} />
        </Field>
      </div>

      <Button type="button" onClick={run} className="w-full gap-1.5">
        <ClipboardCheck className="size-4" /> فحص الضوابط والمعايير
      </Button>

      {result ? (
        <div className="rounded-xl border border-border/60 bg-background/30 p-3">
          <ControlsTab kind="license" entity={result} />
        </div>
      ) : null}
    </div>
  );
}
