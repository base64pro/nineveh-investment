"use client";

// حقل الشركة المرتبطة (§هـ.4 — الشركة حقل لا تاب). منتقٍ باحث: يعرض الاسم ويخزّن المعرّف الداخلي
// (company_ref) **دون كشفه** (§ح). الربط بشركة في م3.

import { useMemo, useState } from "react";
import { FilterCombo } from "@/components/ui/filter-combo";

export function CompanyField({
  companies,
  value,
  onChange,
}: {
  companies: { id: string; name: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const current = useMemo(() => companies.find((c) => c.id === value) ?? null, [companies, value]);
  const [text, setText] = useState(current?.name ?? "");
  const byName = useMemo(() => new Map(companies.map((c) => [c.name, c.id] as const)), [companies]);
  const options = useMemo(() => companies.map((c) => c.name).sort((a, b) => a.localeCompare(b, "ar")), [companies]);

  return (
    <div className="space-y-1">
      <label className="block text-xs text-muted-foreground">الشركة المرتبطة</label>
      <FilterCombo
        value={text}
        onChange={(v) => {
          setText(v);
          const id = byName.get(v);
          if (id) onChange(id);
          else if (v.trim() === "") onChange(null);
        }}
        options={options}
        placeholder="ابحث عن شركة…"
        allLabel="— بلا شركة —"
      />
    </div>
  );
}
