import { type NextRequest, NextResponse } from "next/server";
import { hasSession } from "@/lib/supabase/require-session";
import { createClient } from "@/lib/supabase/server";
import { type Branding, renderPdf } from "@/lib/pdf/render";
import { parcelReportBody } from "@/lib/pdf/parcel-report";
import type { ParcelKind } from "@/features/map/lib/map-nav-store";

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
  const cfg = TABLE[kind];
  if (!cfg || !id) return new NextResponse("طلب غير صالح", { status: 400 });

  const sb = await createClient();
  const { data: entity } = await sb.from(cfg.table).select("*").eq(cfg.idcol, cfg.numeric ? Number(id) : id).maybeSingle();
  if (!entity) return new NextResponse("القطعة غير موجودة", { status: 404 });

  const { data: settings } = await sb.from("settings").select("pdf_org_name, pdf_header, pdf_footer").eq("id", 1).maybeSingle<{ pdf_org_name: string | null; pdf_header: string | null; pdf_footer: string | null }>();
  const branding: Branding = { org: settings?.pdf_org_name, header: settings?.pdf_header, footer: settings?.pdf_footer };

  const { title, html } = parcelReportBody(kind as ParcelKind, entity as Record<string, unknown>);
  const pdf = await renderPdf({ title, bodyHtml: html, branding });

  return new NextResponse(new Blob([pdf], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="parcel-report.pdf"; filename*=UTF-8''${encodeURIComponent(title + ".pdf")}`,
      "cache-control": "no-store",
    },
  });
}
