/**
 * م9.3ب (تحقّق) · يزرع نموذج STL تجريبياً (مكعّب مبنى ~50×50×60م) لأوّل قطعة مفترضة بهندسة:
 * يؤلّف STL ثنائياً، يرفعه لدلو parcel-models، ويُدرج صفّ parcel_models — لمعاينة العرض الحيّ.
 * نموذج «تصوّر تصميمي» قابل للحذف من واجهة «المجسّم ثلاثي الأبعاد». لا يمسّ أي بيانات قائمة.
 */
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./lib/env";

function boxStl(sx: number, sy: number, sz: number): Buffer {
  const hx = sx / 2;
  const hy = sy / 2;
  const v: [number, number, number][] = [
    [-hx, -hy, 0], [hx, -hy, 0], [hx, hy, 0], [-hx, hy, 0],
    [-hx, -hy, sz], [hx, -hy, sz], [hx, hy, sz], [-hx, hy, sz],
  ];
  const tris: { n: [number, number, number]; a: number; b: number; c: number }[] = [
    { n: [0, 0, -1], a: 0, b: 2, c: 1 }, { n: [0, 0, -1], a: 0, b: 3, c: 2 },
    { n: [0, 0, 1], a: 4, b: 5, c: 6 }, { n: [0, 0, 1], a: 4, b: 6, c: 7 },
    { n: [0, -1, 0], a: 0, b: 1, c: 5 }, { n: [0, -1, 0], a: 0, b: 5, c: 4 },
    { n: [1, 0, 0], a: 1, b: 2, c: 6 }, { n: [1, 0, 0], a: 1, b: 6, c: 5 },
    { n: [0, 1, 0], a: 2, b: 3, c: 7 }, { n: [0, 1, 0], a: 2, b: 7, c: 6 },
    { n: [-1, 0, 0], a: 3, b: 0, c: 4 }, { n: [-1, 0, 0], a: 3, b: 4, c: 7 },
  ];
  const buf = Buffer.alloc(84 + tris.length * 50);
  buf.writeUInt32LE(tris.length, 80);
  let o = 84;
  for (const t of tris) {
    buf.writeFloatLE(t.n[0], o); buf.writeFloatLE(t.n[1], o + 4); buf.writeFloatLE(t.n[2], o + 8); o += 12;
    for (const vi of [t.a, t.b, t.c]) {
      const p = v[vi]!;
      buf.writeFloatLE(p[0], o); buf.writeFloatLE(p[1], o + 4); buf.writeFloatLE(p[2], o + 8); o += 12;
    }
    o += 2;
  }
  return buf;
}

async function main(): Promise<void> {
  const sb = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: parcels, error: pe } = await sb.from("assumed_parcels").select("id, name").not("geom", "is", null).limit(1);
  if (pe) throw pe;
  const parcel = parcels?.[0] as { id: string; name: string | null } | undefined;
  if (!parcel) {
    console.log("لا توجد قطعة مفترضة بهندسة لزرع النموذج عليها.");
    return;
  }
  const refId = parcel.id;
  const stl = boxStl(50, 50, 60);
  const path = `assumed/${refId}/sample-building.stl`;
  const up = await sb.storage.from("parcel-models").upload(path, stl, { contentType: "application/octet-stream", upsert: true });
  if (up.error) throw up.error;
  const ins = await sb
    .from("parcel_models")
    .insert({ kind: "assumed", ref_id: refId, storage_path: path, format: "stl", transform: { scale: 1, rotationDeg: 0, elevationM: 0 }, title: "نموذج تجريبي (مكعّب)", is_conceptual: true })
    .select("id")
    .single();
  if (ins.error) throw ins.error;
  console.log(`✓ زُرِع نموذج STL تجريبي للقطعة «${parcel.name ?? refId}» (${refId}) — صفّ ${ins.data?.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
