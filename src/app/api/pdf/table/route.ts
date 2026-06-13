import { type NextRequest, NextResponse } from "next/server";
import { hasSession } from "@/lib/supabase/require-session";
import { getBranding } from "@/lib/pdf/branding";
import { renderPdf } from "@/lib/pdf/render";
import { tableReportBody, type ChartItem } from "@/lib/pdf/table-report";

export const runtime = "nodejs";
export const maxDuration = 60;

const clamp = (s: unknown, max: number): string => String(s ?? "").slice(0, max);

// م6.1 · تقرير جدولي PDF براندد (تصدير الأقسام/التقارير §هـ.5). القيم منسَّقة مسبقاً بطبقة العرض §ح.
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await hasSession())) return new NextResponse("Unauthorized", { status: 401 });

  let payload: { title?: unknown; subtitle?: unknown; columns?: unknown; rows?: unknown; chart?: { title?: unknown; items?: unknown } };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return new NextResponse("طلب غير صالح", { status: 400 });
  }
  if (!Array.isArray(payload.columns) || !Array.isArray(payload.rows)) return new NextResponse("طلب غير صالح", { status: 400 });

  const columns = (payload.columns as { key?: unknown; label?: unknown }[])
    .slice(0, 30)
    .map((c) => ({ key: clamp(c.key, 80), label: clamp(c.label, 80) }))
    .filter((c) => c.key);
  const rows = (payload.rows as Record<string, unknown>[]).slice(0, 3000).map((r) => {
    const o: Record<string, string> = {};
    for (const c of columns) o[c.key] = clamp(r[c.key], 400);
    return o;
  });
  if (columns.length === 0) return new NextResponse("لا أعمدة", { status: 400 });

  // رسم اختياري (يُرسَم SVG داخل الـPDF) — قيم موجبة فقط، حتى 10 بنود
  let chart: { title: string; items: ChartItem[] } | undefined;
  if (payload.chart && Array.isArray(payload.chart.items)) {
    const items = (payload.chart.items as { label?: unknown; value?: unknown }[])
      .map((it) => ({ label: clamp(it.label, 60), value: Number(it.value) }))
      .filter((it) => it.label && Number.isFinite(it.value) && it.value > 0)
      .slice(0, 10);
    if (items.length) chart = { title: clamp(payload.chart.title, 120) || "توزيع", items };
  }

  const branding = await getBranding();
  const subtitle = clamp(payload.subtitle, 200) || undefined;
  const issued = new Date().toLocaleDateString("en-GB"); // أرقام لاتينية (§ح)
  const { title, html } = tableReportBody({
    title: clamp(payload.title, 160) || "تقرير",
    subtitle,
    columns,
    rows,
    chart,
    cover: { org: branding.org ?? branding.header, metaLines: [...(subtitle ? [subtitle] : []), `تاريخ الإصدار: ${issued}`] },
  });
  const pdf = await renderPdf({ title, bodyHtml: html, branding });

  return new NextResponse(new Blob([pdf], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="report.pdf"; filename*=UTF-8''${encodeURIComponent(title + ".pdf")}`,
      "cache-control": "no-store",
    },
  });
}
