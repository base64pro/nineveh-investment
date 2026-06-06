import type { SupabaseClient } from "@supabase/supabase-js";
import { readData } from "../lib/data";
import { assertCount, EXPECTED } from "../lib/counts";
import { upsertAll } from "../lib/upsert";
import { COMPANY_JSON_TO_COLUMN } from "../../src/lib/company-fields";
import type { CountedFile } from "./raw-types";

type RawCompany = Record<string, unknown>;

const KNOWN_KEYS = new Set(Object.keys(COMPANY_JSON_TO_COLUMN));

function toRow(r: RawCompany): Record<string, unknown> {
  // كشف أي مفتاح غير متوقّع (لا افتراض — توقّف عند المفاجأة)
  for (const k of Object.keys(r)) {
    if (!KNOWN_KEYS.has(k)) {
      throw new Error(`مفتاح غير متوقّع في الشركات: «${k}» — توقّف (لا افتراض).`);
    }
  }
  const row: Record<string, unknown> = {};
  for (const [jsonKey, column] of Object.entries(COMPANY_JSON_TO_COLUMN)) {
    row[column] = r[jsonKey] ?? null;
  }
  // أعمدة NOT NULL ذات قيم افتراضية (لا تأليف — مجرّد صون القيد)
  row.is_excluded = r["مستثناة"] ?? false;
  row.shareholders = r["المساهمون والنسب"] ?? [];
  row.source = r["المصدر"] ?? [];
  row.matched_opportunities = r["الفرص المطابقة"] ?? [];
  row.projects = []; // الحقل 23 غير موجود في الملف — يُثرى لاحقاً (CRUD)

  if (row.id == null) throw new Error("شركة بلا «معرّف داخلي» — توقّف.");
  if (row.name == null) throw new Error(`شركة بلا «اسم الشركة» (id=${String(row.id)}) — توقّف.`);
  return row;
}

export function loadCompanies(): Record<string, unknown>[] {
  const file = readData<CountedFile<RawCompany>>("companies_final.json");
  if (typeof file.count === "number") {
    assertCount("companies(count↔records)", file.records.length, file.count);
  }
  assertCount("companies", file.records.length, EXPECTED.companies);
  return file.records.map(toRow);
}

export async function importCompanies(sb: SupabaseClient): Promise<number> {
  const rows = loadCompanies();
  await upsertAll(sb, "companies", rows, "id");
  return rows.length;
}
