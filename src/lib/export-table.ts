// م6.1 · تصدير موحّد للأقسام والتقارير: CSV (محلي) أو PDF براندد (خادمي) وفق صيغة الإعدادات.
// القيم تُنسَّق هنا بطبقة العرض §ح (أرقام لاتينية · بلا معرّف داخلي — الأعمدة أصلاً تستبعده).
import { exportCsv, type CsvColumn } from "./export-csv";
import { toLatinDigits } from "./format";

/** يصدّر الصفوف وفق الصيغة. يُرجِع false عند فشل توليد الـPDF (للتنبيه). */
export async function exportTable(
  format: string,
  csvName: string,
  title: string,
  rows: Record<string, unknown>[],
  columns: CsvColumn[],
): Promise<boolean> {
  if (format !== "pdf") {
    exportCsv(csvName, rows, columns);
    return true;
  }
  const cols = columns.map((c) => ({ key: c.key, label: c.label }));
  const body = rows.map((r) => {
    const o: Record<string, string> = {};
    for (const c of columns) {
      const v = c.format ? c.format(r[c.key]) : r[c.key];
      o[c.key] = v === null || v === undefined ? "" : toLatinDigits(String(v));
    }
    return o;
  });
  try {
    const res = await fetch("/api/pdf/table", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, subtitle: `${rows.length} سجلّ`, columns: cols, rows: body }),
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
  } catch {
    return false;
  }
}
