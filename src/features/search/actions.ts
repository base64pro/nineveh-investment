"use server";

// م5.2 · البحث الفائق (§هـ.2.ج): الذكاء **يفهم ويوجّه** فقط؛ النتائج **حقيقية حصراً** من قاعدتنا + geocoding.
// لا تأليف · ضمن نينوى · الأولوية لبياناتنا ثم المواقع.

import { createClient } from "@/lib/supabase/server";
import { anthropicChat } from "@/lib/ai/anthropic";
import { geocodeNineveh } from "@/lib/ai/maptiler-geocode";
import { sectorCode, sectorLabel } from "@/lib/sectors";
import type { SearchKind, SearchResult } from "./types";

interface Intent {
  terms: string[];
  kinds: string[];
  sector: string | null;
  status: string | null;
  place: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  "in-progress": "قيد الإنجاز",
  completed: "منجزة",
  withdrawn: "مسحوبة",
  announced: "معلَنة",
  assumed: "مفترضة",
};

const KIND_OK = new Set(["opportunity", "license", "company", "assumed"]);

const INTENT_SYSTEM = `أنت موجّه بحث ذكي لنظام استثمار نينوى. حلّل استعلام المستخدم وأعد **JSON فقط** بلا أي نص آخر بالشكل:
{"terms":[],"kinds":[],"sector":null,"status":null,"place":null}
- terms: كلمات البحث النصّي الجوهرية في بياناتنا (أسماء/أرقام قطع/ملّاك/أحياء)؛ احذف منها كلمات الحالة والقطاع.
- kinds: أيٌّ من "opportunity","license","company","assumed" يقصدها الاستعلام (فارغ = الكل).
- sector: تسمية القطاع العربية إن ذُكرت بوضوح (مثل "صناعي"،"سكني"،"تجاري")؛ وإلا null.
- status: حالة الرخصة إن ذُكرت: "in-progress" أو "completed" أو "withdrawn"؛ وإلا null.
- place: اسم موقع/معلم/عنوان جغرافي إن كان الاستعلام يسأل عن مكان على الخريطة؛ وإلا null.
قواعد صارمة: لا تؤلّف. إن غمض الاستعلام اجعل terms=[الاستعلام كما هو] والبقية null/فارغة. الأرقام لاتينية.
أمثلة:
"الرخص الصناعية المسحوبة" => {"terms":[],"kinds":["license"],"sector":"صناعي","status":"withdrawn","place":null}
"قطعة 12/34" => {"terms":["12/34"],"kinds":[],"sector":null,"status":null,"place":null}
"جامع النوري" => {"terms":[],"kinds":[],"sector":null,"status":null,"place":"جامع النوري"}
"شركة الفارس" => {"terms":["الفارس"],"kinds":["company"],"sector":null,"status":null,"place":null}`;

function extractJson(raw: string): string {
  const a = raw.indexOf("{");
  const b = raw.lastIndexOf("}");
  return a !== -1 && b > a ? raw.slice(a, b + 1) : "{}";
}

async function understand(q: string): Promise<Intent> {
  const fallback: Intent = { terms: [q], kinds: [], sector: null, status: null, place: null };
  try {
    const raw = await anthropicChat({
      system: INTENT_SYSTEM,
      messages: [{ role: "user", content: q }],
      maxTokens: 300,
    });
    const p = JSON.parse(extractJson(raw)) as Partial<Intent>;
    return {
      terms: Array.isArray(p.terms) ? p.terms.filter((t): t is string => typeof t === "string" && t.trim() !== "") : [],
      kinds: Array.isArray(p.kinds) ? p.kinds.filter((k): k is string => typeof k === "string" && KIND_OK.has(k)) : [],
      sector: typeof p.sector === "string" && p.sector.trim() !== "" ? p.sector.trim() : null,
      status: typeof p.status === "string" && STATUS_LABEL[p.status] ? p.status : null,
      place: typeof p.place === "string" && p.place.trim() !== "" ? p.place.trim() : null,
    };
  } catch {
    return fallback;
  }
}

function buildSublabel(kind: SearchKind, sector: string | null, district: string | null, status: string | null): string {
  const parts: string[] = [];
  if (kind === "license" && status) parts.push(STATUS_LABEL[status] ?? status);
  if (sector) parts.push(sectorLabel(sector));
  if (district && kind !== "company") parts.push(district); // المحافظة للشركات رمز ISO — تُحجب
  return parts.join(" · ");
}

interface Row {
  kind: SearchKind;
  label: string | null;
  sector: string | null;
  district: string | null;
  status: string | null;
  parcel_no: string | null;
  map_ref: string | null;
  entity_id: string | null;
  has_geom: boolean;
  lng: number | null;
  lat: number | null;
}

export async function superSearch(query: string): Promise<{ results: SearchResult[]; warning?: string }> {
  const q = query.trim();
  if (q.length < 2) return { results: [] };

  // الفهم بالذكاء للاستعلامات المركّبة فقط (مسافة أو طول ≥ 12) — الأسماء/الأرقام القصيرة مباشرة (أسرع وأوفر)
  const needsIntent = /\s/.test(q) || q.length >= 12;
  const intent: Intent = needsIntent
    ? await understand(q)
    : { terms: [q], kinds: [], sector: null, status: null, place: null };
  const hasFilters = intent.sector !== null || intent.status !== null || intent.kinds.length > 0;
  const needle = (intent.terms[0] ?? "").trim() || (hasFilters ? "" : q);
  const sCode = intent.sector ? sectorCode(intent.sector) : null;

  // بحث بياناتنا (حتمي) + تسميات/مواقع الخريطة الأصلية (geocoding) — **معاً دائماً** بالتوازي.
  // فيعثر المستخدم على القطعة المرسومة وعلى أي تسمية على الخريطة (حي · منطقة · معلم · منشأة).
  const supabase = await createClient();
  const [dbRes, places] = await Promise.all([
    supabase.rpc("super_search", {
      p_q: needle || null,
      p_sector: sCode,
      p_status: intent.status,
      p_kinds: intent.kinds,
      p_limit: 12,
    }),
    geocodeNineveh(intent.place || q),
  ]);
  if (dbRes.error) console.error("super_search:", dbRes.error.message); // لا إسقاط صامت لنتائج البيانات (§ز)
  const rows = (dbRes.data ?? []) as Row[];
  const entityResults: SearchResult[] = rows.map((r) => ({
    kind: r.kind,
    label: r.label ?? "—",
    sublabel: r.kind === "annotation" ? "تسمية محرَّرة — من بياناتك" : buildSublabel(r.kind, r.sector, r.district, r.status),
    parcel_no: r.parcel_no,
    mapRef: r.map_ref,
    entityId: r.entity_id,
    hasGeom: r.has_geom,
    lng: r.lng,
    lat: r.lat,
  }));

  // تسميات/مواقع الخريطة (أُحضِرت أعلاه بالتوازي)
  const placeResults: SearchResult[] = places.map((p) => ({
    kind: "place" as const,
    label: p.label,
    sublabel: p.sublabel,
    parcel_no: null,
    mapRef: null,
    entityId: null,
    hasGeom: false,
    lng: p.lng,
    lat: p.lat,
  }));

  // دمج: بياناتنا أولاً ثم تسميات/مواقع الخريطة (§هـ.4 الأولوية لعناصرنا)
  return {
    results: [...entityResults, ...placeResults].slice(0, 18),
    ...(dbRes.error ? { warning: "تعذّر البحث في بيانات النظام مؤقتاً — تُعرض نتائج الخريطة فقط" } : {}),
  };
}
