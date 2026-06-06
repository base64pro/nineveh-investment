/**
 * مُشغِّل الهجرات (الخطوة 4) — يطبّق ملفّات supabase/migrations بالترتيب عبر DATABASE_URL.
 * --dry-run: داخل معاملة BEGIN…ROLLBACK (تحقّق دون تثبيت).
 * بدونها: BEGIN…COMMIT (تطبيق ذرّي: الكلّ أو لا شيء).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { requireEnv } from "./lib/env";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const connectionString = requireEnv("DATABASE_URL");
  // Supabase pooler يتطلّب SSL؛ تعطيل التحقّق من الشهادة يتفادى مشاكل سلسلة الشهادات.
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  const files = migrationFiles();
  console.log(`${files.length} هجرة · الوضع: ${dryRun ? "دراي-رَن (ROLLBACK)" : "تطبيق (COMMIT)"}`);

  try {
    await client.connect();
  } catch (err) {
    console.error("✗ فشل الاتصال بـDATABASE_URL — تحقّق من الترميز (محارف خاصّة في كلمة المرور تحتاج URL-encoding) أو الشبكة/المنفذ 5432.");
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  try {
    await client.query("begin");
    for (const f of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf-8");
      process.stdout.write(`  → ${f} … `);
      await client.query(sql);
      console.log("ok");
    }
    if (dryRun) {
      await client.query("rollback");
      console.log("✓ دراي-رَن ناجح — كل الهجرات صحيحة على القاعدة (تراجَع، بلا تثبيت).");
    } else {
      await client.query("commit");
      console.log("✓ طُبِّقت كل الهجرات (COMMIT).");
    }
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    console.error("\n✗ فشل في إحدى الهجرات — تراجَع كل شيء (لا تثبيت جزئي).");
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main();
