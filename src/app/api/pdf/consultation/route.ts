import { type NextRequest, NextResponse } from "next/server";
import { hasSession } from "@/lib/supabase/require-session";
import { createClient } from "@/lib/supabase/server";
import { getBranding } from "@/lib/pdf/branding";
import { renderPdf } from "@/lib/pdf/render";
import { consultationReportBody } from "@/lib/pdf/consultation-report";

export const runtime = "nodejs";
export const maxDuration = 60;

// م6.1 · تصدير استشارة محفوظة PDF (§هـ.5 المستشار: «تصدير PDF أنيق») — باستشهاداتها كما هي.
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await hasSession())) return new NextResponse("Unauthorized", { status: 401 });

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return new NextResponse("طلب غير صالح", { status: 400 });

  const sb = await createClient();
  const { data } = await sb
    .from("consultations")
    .select("title, consulted_at, question, answer")
    .eq("id", id)
    .maybeSingle<{ title: string | null; consulted_at: string; question: string | null; answer: string | null }>();
  if (!data) return new NextResponse("الاستشارة غير موجودة", { status: 404 });

  const { title, html } = consultationReportBody(data);
  const pdf = await renderPdf({ title, bodyHtml: html, branding: await getBranding() });

  return new NextResponse(new Blob([pdf], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="consultation.pdf"; filename*=UTF-8''${encodeURIComponent(title + ".pdf")}`,
      "cache-control": "no-store",
    },
  });
}
