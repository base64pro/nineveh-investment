// هوية الـPDF من إعدادات المستخدم (§هـ.5 التصدير) — خادمي.
import { createClient } from "@/lib/supabase/server";
import type { Branding } from "./render";

export async function getBranding(): Promise<Branding> {
  const sb = await createClient();
  const { data } = await sb
    .from("settings")
    .select("pdf_org_name, pdf_header, pdf_footer")
    .eq("id", 1)
    .maybeSingle<{ pdf_org_name: string | null; pdf_header: string | null; pdf_footer: string | null }>();
  return { org: data?.pdf_org_name, header: data?.pdf_header, footer: data?.pdf_footer };
}
