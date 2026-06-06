/**
 * تأكيد صلاحية مفتاح MapTiler وتوفّر الأنماط الثلاثة (لا يعرض المفتاح).
 */
import { requireEnv } from "./lib/env";

const STYLES = ["streets-v2-dark", "streets-v2", "hybrid"] as const;

async function main(): Promise<void> {
  const key = requireEnv("MAPTILER_KEY");
  let ok = true;
  for (const id of STYLES) {
    const res = await fetch(`https://api.maptiler.com/maps/${id}/style.json?key=${key}`);
    console.log(`${res.ok ? "✓" : "✗"} ${id}: ${res.status}`);
    if (!res.ok) ok = false;
  }
  console.log(ok ? "✓ مفتاح MapTiler صالح والأنماط الثلاثة متاحة." : "✗ مشكلة في المفتاح/الأنماط.");
  if (!ok) process.exitCode = 1;
}

void main();
