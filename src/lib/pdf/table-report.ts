// م6.1 · باني تقرير جدولي عام (HTML) — لتصدير الأقسام والتقارير (§هـ.5 «PDF/جداول أنيقة بهوية موحّدة»).
// القيم تصل منسَّقة من طبقة العرض §ح (أرقام لاتينية · لا معرّف داخلي).
import { esc } from "./render";

export interface ChartItem {
  label: string;
  value: number;
}

export interface TableReportInput {
  title: string;
  subtitle?: string;
  columns: { key: string; label: string }[];
  rows: Record<string, string>[];
  cover?: { org?: string | null; metaLines?: string[] };
  chart?: { title: string; items: ChartItem[] };
}

/** صفحة غلاف براندد (م7.5) — عنوان كبير + شريط الهوية الثلاثي + سطور وصفية. */
export function coverHtml(title: string, org: string | null | undefined, metaLines: string[]): string {
  return `<div class="cover"><div class="frame">${org ? `<div class="org">${esc(org)}</div>` : ""}<div class="bar"></div><h1>${esc(title)}</h1><div class="meta">${metaLines.map((l) => esc(l)).join("<br/>")}</div></div></div>`;
}

/** رسم أعمدة أفقي SVG حتمي (يُصيَّر داخل الـPDF بخطّ Readex) — أرقام لاتينية، تهريب كامل. */
export function chartSvg(title: string, items: ChartItem[]): string {
  const data = items.filter((d) => Number.isFinite(d.value) && d.value > 0).slice(0, 10);
  if (!data.length) return "";
  const max = Math.max(...data.map((d) => d.value));
  const rowH = 24;
  const width = 660;
  const labelX = width - 8; // التسميات يمين (RTL)
  const barEnd = width - 170;
  const barMax = barEnd - 60;
  const rows = data
    .map((d, i) => {
      const w = Math.max(3, Math.round((d.value / max) * barMax));
      const y = i * rowH + 6;
      return (
        `<text x="${labelX}" y="${y + 12}" text-anchor="end" font-size="10.5" fill="#33518a" font-weight="600">${esc(d.label)}</text>` +
        `<rect x="${barEnd - w}" y="${y}" width="${w}" height="14" rx="4" fill="url(#g)"/>` +
        `<text x="${barEnd - w - 6}" y="${y + 11}" text-anchor="end" font-size="10" fill="#51607a">${d.value.toLocaleString("en-US")}</text>`
      );
    })
    .join("");
  const h = data.length * rowH + 10;
  return `<div class="chart"><div class="ct">${esc(title)}</div><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}" style="font-family:'Readex Pro',sans-serif"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7d9cd1"/><stop offset="1" stop-color="#33518a"/></linearGradient></defs>${rows}</svg></div>`;
}

export function tableReportBody(i: TableReportInput): { title: string; html: string } {
  const cover = i.cover ? coverHtml(i.title, i.cover.org, i.cover.metaLines ?? []) : "";
  const head = `<div class="title"><h1>${esc(i.title)}</h1></div>${i.subtitle ? `<div class="subtitle">${esc(i.subtitle)}</div>` : ""}`;
  const chart = i.chart ? chartSvg(i.chart.title, i.chart.items) : "";
  const thead = `<tr>${i.columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr>`;
  const tbody = i.rows.map((r) => `<tr>${i.columns.map((c) => `<td>${esc(r[c.key] ?? "")}</td>`).join("")}</tr>`).join("");
  return { title: i.title, html: `${cover}${head}${chart}<table class="rpt"><thead>${thead}</thead><tbody>${tbody}</tbody></table>` };
}
