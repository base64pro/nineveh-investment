/**
 * تطبيع قيم الأعمدة المُنمَّطة (تاريخ/رقم/منطقي).
 * المبدأ: السلسلة الفارغة = «لا قيمة» → null (ليس تأليفاً)؛ والقيمة الشاذّة تُوقِف (لا إخفاء).
 */

export function emptyToNull(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return v;
}

export function asDate(v: unknown): string | null {
  const c = emptyToNull(v);
  return c === null ? null : String(c);
}

export function asNumber(v: unknown, field: string): number | null {
  const c = emptyToNull(v);
  if (c === null) return null;
  if (typeof c === "number") return c;
  const n = Number(c);
  if (Number.isNaN(n)) throw new Error(`قيمة غير رقمية في ${field}: «${String(c)}» — توقّف (لا تأليف).`);
  return n;
}

export function asBool(v: unknown, field: string): boolean | null {
  const c = emptyToNull(v);
  if (c === null) return null;
  if (typeof c === "boolean") return c;
  if (c === "true") return true;
  if (c === "false") return false;
  throw new Error(`قيمة غير منطقية في ${field}: «${String(c)}» — توقّف.`);
}
