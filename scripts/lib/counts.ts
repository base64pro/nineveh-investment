/** الأعداد المتوقّعة (مؤكّدة من الملفّات الفعلية) — تُفرض حتمياً (لا تأليف). */
export const EXPECTED = {
  companies: 491,
  opportunities: 27,
  licenses: 146,
  legalDocuments: 8,
  legal: 125,
} as const;

/** عدد السجلّات القانونية لكل وثيقة (مجموعها 125). */
export const LEGAL_PER_DOC: Readonly<Record<string, number>> = {
  law_13_2006: 38,
  reg_2_2009: 41,
  int_reg_3_2009: 14,
  reg_7_2010: 11,
  reg_6_2017: 10,
  reg_5_2011: 4,
  reg_5_2018: 4,
  fees_1_2016: 3,
};

/** يؤكّد تطابق العدّ، ويرمي خطأً يوقف الاستيراد عند أي تباين. */
export function assertCount(label: string, actual: number, expected: number): void {
  if (actual !== expected) {
    throw new Error(`تباين في العدّ [${label}]: المتوقّع ${expected} والفعلي ${actual} — توقّف (§ح.4 لا تأليف).`);
  }
}
