/**
 * تأكيد مستقلّ لأعداد القاعدة عبر pg مباشرةً (مسار مختلف عن عميل الاستيراد).
 * يشمل الجداول المبذورة (491/27/146/8/125) والفارغة (يجب 0).
 */
import { Client } from "pg";
import { requireEnv } from "./lib/env";
import { EXPECTED } from "./lib/counts";

const TABLES: ReadonlyArray<readonly [string, number | null]> = [
  ["opportunities", EXPECTED.opportunities],
  ["licenses", EXPECTED.licenses],
  ["companies", EXPECTED.companies],
  ["legal_documents", EXPECTED.legalDocuments],
  ["legal", EXPECTED.legal],
  ["criteria", 0],
  ["consultations", 0],
  ["visits", 0],
  ["map_elements", 0],
  ["assumed_parcels", 0],
  ["parcel_geometry", 0],
];

async function main(): Promise<void> {
  const client = new Client({
    connectionString: requireEnv("DATABASE_URL"),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  let allOk = true;
  try {
    for (const [table, expected] of TABLES) {
      const res = await client.query<{ c: number }>(`select count(*)::int as c from ${table}`);
      const actual = Number(res.rows[0]?.c ?? 0);
      const ok = expected === null || actual === expected;
      if (!ok) allOk = false;
      const suffix = expected !== null ? ` (متوقّع ${expected})` : "";
      console.log(`${ok ? "✓" : "✗"} ${table}: ${actual}${suffix}`);
    }
  } finally {
    await client.end();
  }
  if (!allOk) {
    console.error("✗ تباين في عدّ القاعدة — توقّف.");
    process.exitCode = 1;
  } else {
    console.log("✓ كل الأعداد مطابقة.");
  }
}

void main();
