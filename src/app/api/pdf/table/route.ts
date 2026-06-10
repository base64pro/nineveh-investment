import { type NextRequest, NextResponse } from "next/server";
import { hasSession } from "@/lib/supabase/require-session";
import { getBranding } from "@/lib/pdf/branding";
import { renderPdf } from "@/lib/pdf/render";
import { tableReportBody } from "@/lib/pdf/table-report";

export const runtime = "nodejs";
export const maxDuration = 60;

const clamp = (s: unknown, max: number): string => String(s ?? "").slice(0, max);

// م6.1 · تقرير جدولي PDF براندد (تصدير الأقسام/التقارير §هـ.5). القيم منسَّقة مسبقاً بطبقة العرض §ح.
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await hasSession())) return new NextResponse("Unauthorized", { status: 401 });

  let payload: { title?: unknown; subtitle?: unknown; columns?: unknown; rows?: unknown };
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

  const { title, html } = tableReportBody({
    title: clamp(payload.title, 160) || "تقرير",
    subtitle: clamp(payload.subtitle, 200) || undefined,
    columns,
    rows,
  });
  const pdf = await renderPdf({ title, bodyHtml: html, branding: await getBranding() });

  return new NextResponse(new Blob([pdf], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="report.pdf"; filename*=UTF-8''${encodeURIComponent(title + ".pdf")}`,
      "cache-control": "no-store",
    },
  });
}
