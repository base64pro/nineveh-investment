/** أداة فحص: أبعاد نموذج glb (من حدود إكسسورات الموضع) — لحساب مقياس الملاءمة. */
import { readFileSync } from "fs";

function dims(path: string): { dims: number[]; min: number[]; max: number[] } {
  const buf = readFileSync(path);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString("utf8", 20, 20 + jsonLen)) as { accessors?: { type: string; min?: number[]; max?: number[] }[] };
  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (const a of json.accessors ?? []) {
    if (a.type !== "VEC3" || !a.min || !a.max || a.min.length !== 3) continue;
    const big = a.max.some((v) => Math.abs(v) > 1.01) || a.min.some((v) => Math.abs(v) > 1.01); // تجاهل النواظم (±1)
    if (!big) continue;
    for (let i = 0; i < 3; i++) {
      mn[i] = Math.min(mn[i]!, a.min[i]!);
      mx[i] = Math.max(mx[i]!, a.max[i]!);
    }
  }
  return { dims: [mx[0]! - mn[0]!, mx[1]! - mn[1]!, mx[2]! - mn[2]!], min: mn, max: mx };
}

for (const f of process.argv.slice(2)) console.log(f.split(/[\\/]/).pop(), JSON.stringify(dims(f)));
