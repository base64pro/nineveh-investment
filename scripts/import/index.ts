/**
 * منسّق الاستيراد (الخطوة 4) — يتطلّب .env.local والقاعدة مُطبَّقة.
 * يستورد ثم يؤكّد الأعداد في القاعدة (491/27/146/125). يتوقّف عند أي تباين.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "../lib/supabase";
import { assertCount, EXPECTED } from "../lib/counts";
import { importOpportunities } from "./opportunities";
import { importLicenses } from "./licenses";
import { importCompanies } from "./companies";
import { importLegal } from "./legal";

async function dbCount(sb: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await sb.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`فشل عدّ ${table}: ${error.message}`);
  return count ?? 0;
}

async function main(): Promise<void> {
  const sb = adminClient();
  console.log("بدء الاستيراد…");
  console.log(`الفرص: ${await importOpportunities(sb)}`);
  console.log(`الرخص: ${await importLicenses(sb)}`);
  console.log(`الشركات: ${await importCompanies(sb)}`);
  const legal = await importLegal(sb);
  console.log(`القانون: ${legal.documents} وثيقة · ${legal.records} سجلاً`);

  console.log("التحقّق من الأعداد في القاعدة…");
  assertCount("DB opportunities", await dbCount(sb, "opportunities"), EXPECTED.opportunities);
  assertCount("DB licenses", await dbCount(sb, "licenses"), EXPECTED.licenses);
  assertCount("DB companies", await dbCount(sb, "companies"), EXPECTED.companies);
  assertCount("DB legal_documents", await dbCount(sb, "legal_documents"), EXPECTED.legalDocuments);
  assertCount("DB legal", await dbCount(sb, "legal"), EXPECTED.legal);
  console.log("✓ الاستيراد مكتمل والأعداد مطابقة (491/27/146/125).");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
