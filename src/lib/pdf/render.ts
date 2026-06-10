// م6.1 · مصيّر PDF خادمي (Puppeteer) — يصيّر HTML عربي/RTL بخطّ Readex إلى PDF براندد. خادمي فقط.
import puppeteer from "puppeteer";

export interface Branding {
  org?: string | null;
  header?: string | null;
  footer?: string | null;
}

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&display=swap');
* { box-sizing: border-box; }
body { font-family: 'Readex Pro', system-ui, sans-serif; color: #1b2740; margin: 0; font-size: 11.5px; line-height: 1.65; }
.title { border-bottom: 2px solid #233355; padding-bottom: 8px; margin-bottom: 14px; }
.title h1 { font-size: 18px; color: #233355; margin: 0 0 3px; }
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
table.rpt { width: 100%; border-collapse: collapse; font-size: 9.5px; }
table.rpt th { background: #233355; color: #fff; padding: 4px 6px; text-align: right; font-weight: 600; }
table.rpt td { border-bottom: 1px solid #e3e8f0; padding: 3px 6px; vertical-align: top; }
table.rpt tr:nth-child(even) td { background: #f4f6fa; }
.qa-q { background: #eef2f9; border-right: 3px solid #5775A8; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; font-size: 11px; }
.qa-q .lbl { font-size: 10px; font-weight: 700; color: #33518a; margin-bottom: 3px; }
.qa-a p { margin: 0 0 6px; }
.qa-a ul { margin: 0 0 6px; padding-right: 18px; }
.qa-a h3 { font-size: 12.5px; color: #2a3a5c; margin: 8px 0 4px; }
`;

export async function renderPdf(opts: { title: string; bodyHtml: string; branding: Branding }): Promise<Uint8Array<ArrayBuffer>> {
  const { title, bodyHtml, branding } = opts;
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${STYLES}</style></head><body>${bodyHtml}</body></html>`;

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
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
    await browser.close();
  }
}
