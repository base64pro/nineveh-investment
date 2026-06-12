// أنواع عناصر الخريطة المحرَّرة (§ج.8/8) — رمز ثابت ↔ تسمية عربية.
export const ELEMENT_TYPES = [
  { value: "landmark", label: "معلم" },
  { value: "building", label: "مبنى" },
  { value: "street", label: "شارع" },
  { value: "point", label: "نقطة" },
  { value: "label", label: "تسمية منطقة" },
] as const;

export function elementTypeLabel(v: string | null | undefined): string {
  return ELEMENT_TYPES.find((t) => t.value === v)?.label ?? "عنصر";
}
