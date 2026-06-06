import { type NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { hasSession } from "@/lib/supabase/require-session";

// حدود نينوى من GeoJSON (§ج.10 · م1) — مصدر واحد: data/map/
const FILES: Record<string, string> = {
  governorate: "nineveh_governorate.geojson",
  districts: "nineveh_districts.geojson",
  subdistricts: "nineveh_subdistricts.geojson",
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ level: string }> }) {
  if (!(await hasSession())) return new NextResponse("Unauthorized", { status: 401 });

  const { level } = await ctx.params;
  const file = FILES[level];
  if (!file) return NextResponse.json({ error: "مستوى غير معروف" }, { status: 404 });

  const body = await readFile(join(process.cwd(), "data", "map", file), "utf-8");
  return new NextResponse(body, {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
  });
}
