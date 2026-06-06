/**
 * تأكيد صلاحية مفتاح MapTiler وتوفّر الأنماط، وأنّ الوسيط يزيل المفتاح فعلياً
 * من النمط الحقيقي ويُنتج عناوين مطلقة (لا يعرض المفتاح في المخرجات).
 */
import { requireEnv } from "./lib/env";
import { rewriteKeyless } from "../src/features/map/lib/proxy-rewrite";

const STYLES = ["streets-v2-dark", "streets-v2", "hybrid"] as const;
const ORIGIN = "http://localhost:3000";

async function main(): Promise<void> {
  const key = requireEnv("MAPTILER_KEY");
  let ok = true;
  for (const id of STYLES) {
    const res = await fetch(`https://api.maptiler.com/maps/${id}/style.json?key=${key}`);
    if (!res.ok) {
      console.log(`✗ ${id}: ${res.status}`);
      ok = false;
      continue;
    }
    const rewritten = rewriteKeyless(await res.text(), ORIGIN);
    const noLeak = !rewritten.includes(key) && !rewritten.includes("api.maptiler.com");
    const absolute = rewritten.includes(`${ORIGIN}/api/maptiler`);
    const good = noLeak && absolute;
    if (!good) ok = false;
    console.log(`${good ? "✓" : "✗"} ${id}: ${res.status} · بلا تسرّب=${noLeak} · مطلق=${absolute}`);
  }
  console.log(ok ? "✓ الأنماط صالحة، والوسيط يزيل المفتاح ويُنتج عناوين مطلقة." : "✗ مشكلة في المفتاح/التحويل.");
  if (!ok) process.exitCode = 1;
}

void main();
