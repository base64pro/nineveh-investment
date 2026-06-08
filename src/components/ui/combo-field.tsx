"use client";

// غلاف Combo للنماذج غير المضبوطة: يحمل القيمة عبر input خفيّ باسم الحقل ليلتقطها FormData.
// بديل أنيق عن <select> الأصيل (قيم ثابتة {value,label}، بلا إدخال حرّ).

import { useState } from "react";
import { Combo, type ComboOption } from "@/components/ui/combo";

export function ComboField({
  id,
  name,
  defaultValue,
  options,
  ariaLabel,
  disabled,
}: {
  id?: string;
  name: string;
  defaultValue: string;
  options: ComboOption[];
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Combo id={id} value={value} onChange={setValue} options={options} ariaLabel={ariaLabel} disabled={disabled} />
    </>
  );
}
