/**
 * بذرة طبقة العرض المركزية (§ح) — تُفرض كلياً في م6.
 * القاعدة §ح.3: الأرقام لاتينية دائماً (0123) في كل الواجهات والبيانات.
 */

// النطاقان: الأرقام العربية-الهندية (U+0660–0669) والفارسية (U+06F0–06F9).
const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/g;

/** يحوّل أي أرقام عربية-هندية/فارسية إلى لاتينية (دفاعياً). */
export function toLatinDigits(input: string): string {
  return input.replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) & 0xf));
}

/** ينسّق عدداً بأرقام لاتينية مع فواصل آلاف (locale ثابت en-US لضمان اللاتينية). */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/** قيمة العرض حين لا تتوفّر البيانات (§ح.4 — لا تأليف). */
export const NOT_AVAILABLE = "غير متوفّر" as const;
