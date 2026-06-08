/**
 * مُشغِّل الهجرات — يتتبّع المطبَّق في schema_migrations ويطبّق الجديد فقط.
 * --dry-run: داخل معاملة BEGIN…ROLLBACK (تحقّق دون تثبيت).
 * baseline: إن كانت القاعدة منشأة قبل التتبّع (هجرات م0)، تُسجَّل كمطبَّقة دون إعادة تشغيل.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { requireEnv } from "./lib/env";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const M0_PREFIX = "20260606120"; // سلسلة هجرات م0 (مطبَّقة سلفاً قبل التتبّع)

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const client = new Client({
    connectionString: requireEnv("DATABASE_URL"),
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
  } catch (err) {
    console.error("✗ فشل الاتصال بـDATABASE_URL — تحقّق من الترميز/الشبكة/المنفذ 5432.");
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const files = migrationFiles();

  try {
    await client.query("begin");
    await client.query(
      `create table if not exists schema_migrations (
         filename text primary key,
         applied_at timestamptz not null default now()
       )`,
    );

    const appliedRes = await client.query<{ filename: string }>("select filename from schema_migrations");
    const applied = new Set(appliedRes.rows.map((r) => r.filename));

    // baseline: قاعدة منشأة قبل التتبّع → سجّل هجرات م0 كمطبَّقة دون تشغيل
    if (applied.size === 0) {
      const exists = await client.query<{ t: string | null }>("select to_regclass('public.opportunities') as t");
      if (exists.rows[0]?.t) {
        for (const f of files.filter((f) => f.startsWith(M0_PREFIX))) {
          await client.query("insert into schema_migrations(filename) values ($1) on conflict do nothing", [f]);
          applied.add(f);
        }
        console.log(`baseline: سُجّلت ${applied.size} هجرة م0 كمطبَّقة.`);
      }
    }

    const pending = files.filter((f) => !applied.has(f));
    console.log(`${pending.length} هجرة معلّقة · الوضع: ${dryRun ? "دراي-رَن (ROLLBACK)" : "تطبيق (COMMIT)"}`);

    for (const f of pending) {
      const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf-8");
      process.stdout.write(`  → ${f} … `);
      await client.query(sql);
      await client.query("insert into schema_migrations(filename) values ($1)", [f]);
      console.log("ok");
    }

    if (dryRun) {
      await client.query("rollback");
      console.log("✓ دراي-رَن ناجح — الهجرات المعلّقة صحيحة (تراجَع، بلا تثبيت).");
    } else {
      await client.query("commit");
      console.log("✓ طُبِّقت الهجرات المعلّقة (COMMIT).");
    }
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    console.error("\n✗ فشل في إحدى الهجرات — تراجَع كل شيء.");
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main();
