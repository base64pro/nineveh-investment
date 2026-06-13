// م6.1 · مصيّر PDF خادمي (Puppeteer) — يصيّر HTML عربي/RTL بخطّ Readex إلى PDF براندد. خادمي فقط.
// متصفّح مشترك (singleton) — لا إطلاق Chromium لكل تصدير؛ وخطّ محلي مضمّن — لا اعتماد على Google وقت التصيير.
import { readFileSync } from "node:fs";
import path from "node:path";
import puppeteer, { type Browser } from "puppeteer";

let browserPromise: Promise<Browser> | null = null;
async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined, // Chromium النظام على Render (Docker)؛ المحلي يستخدم المحزّم
    });
    browserPromise.catch(() => {
      browserPromise = null;
    });
  }
  const b = await browserPromise;
  if (!b.connected) {
    browserPromise = null;
    return getBrowser();
  }
  return b;
}

let fontCss: string | null = null;
/** خطّ Readex من public/fonts/readex مضمَّناً base64 — وعند غيابه تراجُع لاستيراد Google (يتطلّب إنترنت). */
function getFontCss(): string {
  if (fontCss !== null) return fontCss;
  try {
    const dir = path.join(process.cwd(), "public", "fonts", "readex");
    fontCss = readFileSync(path.join(dir, "readex.css"), "utf8").replace(/url\(([^)]+\.woff2)\)/g, (_, f: string) => {
      const b64 = readFileSync(path.join(dir, f.trim())).toString("base64");
      return `url(data:font/woff2;base64,${b64})`;
    });
  } catch {
    fontCss = "@import url('https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;600;700&display=swap');";
  }
  return fontCss;
}

export interface Branding {
  org?: string | null;
  header?: string | null;
  footer?: string | null;
}

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

const STYLES = `
* { box-sizing: border-box; }
body { font-family: 'Readex Pro', system-ui, sans-serif; color: #1b2740; margin: 0; font-size: 11.5px; line-height: 1.65; }
.title { position: relative; border-bottom: 2px solid #233355; padding: 0 0 9px; margin-bottom: 15px; }
.title::after { content: ""; position: absolute; right: 0; bottom: -2px; width: 90px; height: 2px; background: linear-gradient(90deg, #C7A24E, #5775A8); }
.title h1 { font-size: 19px; font-weight: 700; color: #233355; margin: 0 0 3px; letter-spacing: -0.01em; }
.title .meta { color: #6b7a99; font-size: 11px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.badge { display: inline-block; border-radius: 999px; padding: 1px 9px; font-size: 10px; font-weight: 600; color: #fff; }
section { border: 1px solid #d8dee9; border-radius: 8px; padding: 9px 12px; margin-bottom: 9px; break-inside: avoid; }
section h2 { font-size: 12px; color: #2a3a5c; margin: 0 0 7px; border-right: 3px solid #5775A8; padding-right: 6px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 18px; }
.row { display: flex; gap: 6px; font-size: 11px; padding: 1px 0; }
.row .k { color: #6b7a99; min-width: 88px; }
.row .v { font-weight: 600; }
.ctrl { border-top: 1px solid #eef1f6; padding: 5px 0; }
.ctrl:first-child { border-top: 0; padding-top: 0; }
.ctrl .top { display: flex; justify-content: space-between; gap: 8px; }
.ctrl .t { font-weight: 600; font-size: 11px; }
.ctrl .cite { color: #5775A8; font-size: 10px; }
.ctrl .note { color: #51607a; font-size: 10px; margin-top: 1px; }
.tag { font-size: 9px; font-weight: 600; border-radius: 4px; padding: 1px 5px; white-space: nowrap; }
.mandatory { background: #e7ecf6; color: #33518a; }
.encouraged { background: #eef3ee; color: #3f7a5c; }
.met { color: #3f7a5c; } .not_met { color: #a8454f; } .needs_action { color: #9a7b2e; }
.needs_input { color: #3f5c8a; } .not_applicable { color: #8b94a6; }
.gaps { color: #51607a; font-size: 10.5px; margin-top: 6px; }
.subtitle { color: #6b7a99; font-size: 10.5px; margin: -8px 0 10px; }
table.rpt { width: 100%; border-collapse: collapse; font-size: 9.5px; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 0 #e3e8f0; }
table.rpt th { background: linear-gradient(180deg, #2a3a5c, #233355); color: #fff; padding: 6px 7px; text-align: right; font-weight: 600; letter-spacing: 0.01em; }
table.rpt td { border-bottom: 1px solid #e8edf4; padding: 4px 7px; vertical-align: top; }
table.rpt tr:nth-child(even) td { background: #f4f6fa; }
table.rpt tr:hover td { background: #eef2f9; }
table.rpt thead { break-inside: avoid; }
table.rpt tr { break-inside: avoid; }
/* م7.10 · تقرير الاستشارة — تدفّق متّسق بلا فراغات صفحات غير مبرّرة (السؤال + الإجابة كتلة واحدة منسابة) */
.consult { font-size: 11.5px; line-height: 1.7; }
.qa-q { background: #eef2f9; border-right: 3px solid #5775A8; border-radius: 6px; padding: 9px 12px; margin-bottom: 12px; font-size: 11.5px; break-inside: avoid; }
.qa-q .lbl { font-size: 9.5px; font-weight: 700; letter-spacing: 0.06em; color: #33518a; margin-bottom: 4px; }
.qa-a { margin: 0; } /* لا حدود/إطار ولا break-inside:avoid — النصّ ينساب طبيعياً عبر الصفحات */
.qa-a > h2 { font-size: 13px; color: #233355; margin: 0 0 8px; padding-right: 7px; border-right: 3px solid #C7A24E; break-after: avoid; }
.qa-a p { margin: 0 0 7px; text-align: justify; orphans: 2; widows: 2; }
.qa-a ul { margin: 0 0 8px; padding-right: 20px; }
.qa-a li { margin: 0 0 3px; }
.qa-a h3 { font-size: 12px; font-weight: 700; color: #2a3a5c; margin: 11px 0 5px; break-after: avoid; }
.qa-a .cite { display: inline; color: #33518a; font-weight: 600; background: #eef2f9; border-radius: 4px; padding: 0 4px; white-space: nowrap; }
/* م7.5 · غلاف التقرير + الرسوم */
.cover { height: 245mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-after: always; }
.cover .org { font-size: 15px; font-weight: 600; color: #33518a; letter-spacing: 0.04em; }
.cover .bar { width: 120px; height: 3px; border-radius: 2px; margin: 14px 0; background: linear-gradient(90deg, #C7A24E, #5775A8, #8B6FB0); }
.cover h1 { font-size: 30px; color: #1b2740; margin: 0 0 8px; }
.cover .meta { color: #6b7a99; font-size: 12px; line-height: 2; }
.cover .frame { border: 1px solid #d8dee9; border-radius: 16px; padding: 36px 48px; box-shadow: 0 10px 30px -18px rgba(35,51,85,0.4); }
.chart { margin: 4px 0 12px; break-inside: avoid; }
.chart .ct { font-size: 12px; font-weight: 700; color: #2a3a5c; margin-bottom: 6px; border-right: 3px solid #C7A24E; padding-right: 6px; }
`;

export async function renderPdf(opts: { title: string; bodyHtml: string; branding: Branding }): Promise<Uint8Array<ArrayBuffer>> {
  const { title, bodyHtml, branding } = opts;
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${getFontCss()}${STYLES}</style></head><body>${bodyHtml}</body></html>`;

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluateHandle("document.fonts.ready");
    const out = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:9px;width:100%;text-align:center;color:#5775A8;font-family:sans-serif;padding-top:3px;">${esc(branding.org ?? branding.header ?? "")}</div>`,
      footerTemplate: `<div style="font-size:8px;width:100%;padding:0 12mm;color:#9aa3b2;font-family:sans-serif;display:flex;justify-content:space-between;"><span>${esc(branding.footer ?? "")}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      margin: { top: "20mm", bottom: "18mm", left: "12mm", right: "12mm" },
    });
    return Uint8Array.from(out); // مخزن ArrayBuffer صرف (يقبله Blob/BodyInit)
  } finally {
    await page.close(); // الصفحة فقط — المتصفّح المشترك يبقى للتصديرات التالية
  }
}
