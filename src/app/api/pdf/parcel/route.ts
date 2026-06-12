import { type NextRequest, NextResponse } from "next/server";
import { hasSession } from "@/lib/supabase/require-session";
import { createClient } from "@/lib/supabase/server";
import { getBranding } from "@/lib/pdf/branding";
import { renderPdf } from "@/lib/pdf/render";
import { parcelReportBody, type PinnedInsights, type ReportScope } from "@/lib/pdf/parcel-report";
import { coverHtml } from "@/lib/pdf/table-report";
import type { ParcelKind } from "@/features/map/lib/map-nav-store";

const SCOPES = new Set<ReportScope>(["parcel", "controls", "recommendations", "criteria", "full"]);

export const runtime = "nodejs"; // Puppeteer يتطلّب بيئة Node
export const maxDuration = 60;

const TABLE: Record<string, { table: string; idcol: string; numeric: boolean }> = {
  opportunity: { table: "opportunities", idcol: "record_id", numeric: true },
  license: { table: "licenses", idcol: "record_id", numeric: true },
  assumed: { table: "assumed_parcels", idcol: "id", numeric: false },
};

// م6.1 · تقرير قطعة PDF براندد (§هـ.4 · §ح). خادمي فقط (تحقّق جلسة).
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await hasSession())) return new NextResponse("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "";
  const id = url.searchParams.get("id") ?? "";
  const rawScope = url.searchParams.get("scope") ?? "full";
  const scope: ReportScope = SCOPES.has(rawScope as ReportScope) ? (rawScope as ReportScope) : "full";
  const cfg = TABLE[kind];
  if (!cfg || !id) return new NextResponse("طلب غير صالح", { status: 400 });

  const sb = await createClient();
  const { data: entity } = await sb.from(cfg.table).select("*").eq(cfg.idcol, cfg.numeric ? Number(id) : id).maybeSingle();
  if (!entity) return new NextResponse("القطعة غير موجودة", { status: 404 });

  // النتائج المثبّتة (توصيات/معايير §هـ.4) — تدخل تقارير التوصيات/المعايير/الشامل
  let insights: PinnedInsights | undefined;
  if (scope === "full" || scope === "recommendations" || scope === "criteria") {
    const { data: ins } = await sb
      .from("parcel_insights")
      .select("recommendations, recommendations_at, criteria, criteria_at")
      .eq("kind", kind)
      .eq("ref_id", id)
      .maybeSingle<PinnedInsights>();
    insights = ins ?? undefined;
  }

  const branding = await getBranding();
  const { title, html } = parcelReportBody(kind as ParcelKind, entity as Record<string, unknown>, { scope, insights });
  // التقرير الشامل يبدأ بغلاف براندد (م7.5)
  const issued = new Date().toLocaleDateString("en-GB");
  const body = scope === "full" ? coverHtml(title, branding.org ?? branding.header, [`تاريخ الإصدار: ${issued}`]) + html : html;
  const pdf = await renderPdf({ title, bodyHtml: body, branding });

  return new NextResponse(new Blob([pdf], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="parcel-report.pdf"; filename*=UTF-8''${encodeURIComponent(title + ".pdf")}`,
      "cache-control": "no-store",
    },
  });
}
