// م6.1 · باني تقرير جدولي عام (HTML) — لتصدير الأقسام والتقارير (§هـ.5 «PDF/جداول أنيقة بهوية موحّدة»).
// القيم تصل منسَّقة من طبقة العرض §ح (أرقام لاتينية · لا معرّف داخلي).
import { esc } from "./render";

export interface TableReportInput {
  title: string;
  subtitle?: string;
  columns: { key: string; label: string }[];
  rows: Record<string, string>[];
}

export function tableReportBody(i: TableReportInput): { title: string; html: string } {
  const head = `<div class="title"><h1>${esc(i.title)}</h1></div>${i.subtitle ? `<div class="subtitle">${esc(i.subtitle)}</div>` : ""}`;
  const thead = `<tr>${i.columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr>`;
  const tbody = i.rows.map((r) => `<tr>${i.columns.map((c) => `<td>${esc(r[c.key] ?? "")}</td>`).join("")}</tr>`).join("");
  return { title: i.title, html: `${head}<table class="rpt"><thead>${thead}</thead><tbody>${tbody}</tbody></table>` };
}
