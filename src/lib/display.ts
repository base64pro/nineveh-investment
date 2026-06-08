/**
 * مساعدات العرض (طبقة المخرجات §ح): «غير متوفّر» للناقص · أرقام لاتينية · لا تأليف.
 */
import { NOT_AVAILABLE, formatNumber, toLatinDigits } from "./format";

export { NOT_AVAILABLE };

/** يعرض القيمة أو «غير متوفّر» (§ح.4). */
export function orNA(value: unknown): string {
  if (value === null || value === undefined || value === "") return NOT_AVAILABLE;
  return toLatinDigits(String(value));
}

/** تاريخ بصيغة YYYY-MM-DD لاتيني أو «غير متوفّر». */
export function formatDate(value: string | null | undefined): string {
  if (!value) return NOT_AVAILABLE;
  return toLatinDigits(String(value).slice(0, 10));
}

/** مساحة بالمتر المربّع (أرقام لاتينية) أو «غير متوفّر». */
export function formatArea(m2: number | null | undefined): string {
  if (m2 === null || m2 === undefined) return NOT_AVAILABLE;
  return `${formatNumber(m2)} م²`;
}
