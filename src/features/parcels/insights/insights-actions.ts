"use server";

// م6.4 · التوصيات الذكية (تاب 2) + إنشاء المعايير (تاب 3) — §هـ.4.
// بطاقة الذكاء: النموذج من الإعدادات · المصدر: بياناتنا + بحث الويب (إن فُعِّل بالإعدادات) ·
// **اجتهاد مؤشَّر غير مُلزِم 🟩** · الوقائع لها أساس لا تُؤلَّف · القرار الحتمي يبقى لمحرّك §ج.9.

import { createClient } from "@/lib/supabase/server";
import { anthropicChat } from "@/lib/ai/anthropic";
import { getWebSearchEnabled } from "@/lib/ai/ai-config";
import { evaluateControls, type ControlsInput } from "@/features/parcels/legal/controls-engine";
import { sectorLabel } from "@/lib/sectors";
import type { ParcelKind } from "@/features/map/lib/map-nav-store";
import type { Company, ParcelState } from "@/types/entities";

export interface ParcelInsights {
  recommendations: string | null;
  recommendations_at: string | null;
  criteria: CriteriaDraft | null;
  criteria_at: string | null;
}
export interface CriteriaDraft {
  name: string;
  domain: string;
  purpose: string;
  items: { description: string; basis: string; weight: string; support_indicator: string }[];
}
type TextResult = { ok: true; text: string } | { ok: false; error: string };
type DraftResult = { ok: true; draft: CriteriaDraft } | { ok: false; error: string };
type OkResult = { ok: true } | { ok: false; error: string };

const TABLE: Record<ParcelKind, { table: string; idcol: string; numeric: boolean }> = {
  opportunity: { table: "opportunities", idcol: "record_id", numeric: true },
  license: { table: "licenses", idcol: "record_id", numeric: true },
  assumed: { table: "assumed_parcels", idcol: "id", numeric: false },
};
const STATE_LABEL: Record<string, string> = {
  announced: "معلَنة",
  "in-progress": "قيد الإنجاز",
  completed: "منجزة",
  withdrawn: "مسحوبة",
  assumed: "مفترضة",
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function parcelState(kind: ParcelKind, e: Record<string, unknown>): ParcelState {
  if (kind === "opportunity") return "announced";
  if (kind === "license") return (str(e.status) as ParcelState | null) ?? "in-progress";
  return (str(e.state) as ParcelState | null) ?? "assumed";
}

async function fetchEntity(kind: ParcelKind, id: string): Promise<Record<string, unknown> | null> {
  const cfg = TABLE[kind];
  const sb = await createClient();
  const { data } = await sb
    .from(cfg.table)
    .select("*")
    .eq(cfg.idcol, cfg.numeric ? Number(id) : id)
    .maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

/** ملخّص القطعة للذكاء — الحقول المتوفّرة فقط (لا تأليف، لا معرّفات داخلية §ح). */
function entitySummary(kind: ParcelKind, e: Record<string, unknown>): string {
  const state = parcelState(kind, e);
  const pairs: [string, string | null][] = [
    ["العنوان", str(e[kind === "assumed" ? "name" : "title"])],
    ["الحالة", STATE_LABEL[state] ?? state],
    ["القطاع", str(e.sector) ? sectorLabel(str(e.sector)) : null],
    ["نوع المشروع", str(e.project_type)],
    ["رقم القطعة", str(e.parcel_no)],
    ["القضاء", str(e.district)],
    ["الناحية", str(e.subdistrict)],
    ["الحي", str(e.neighborhood)],
    ["المساحة الكلية (م²)", num(e.area_total_m2)?.toLocaleString("en-US") ?? num(e.area_m2)?.toLocaleString("en-US") ?? null],
    ["العائدية", str(e.owner)],
    ["نوع الحقّ", str(e.land_right)],
    ["جنسية المستثمر", str(e.investor_nationality)],
    ["رأس المال/القيمة ($)", (num(e.capital) ?? num(e.value))?.toLocaleString("en-US") ?? null],
    ["الوصف", str(e.description)?.slice(0, 500) ?? null],
  ];
  return pairs.filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join("\n");
}

/** خلاصة الفحص الحتمي §ج.9 (الذكاء يستند إليها ولا يقرّر بدلها). */
function controlsSummary(kind: ParcelKind, e: Record<string, unknown>): string {
  const capitalUsd = kind === "license" ? num(e.capital) : kind === "assumed" ? num(e.value) : null;
  const input: ControlsInput = {
    state: parcelState(kind, e),
    sector: str(e.sector),
    capitalUsd,
    projectValueUsd: capitalUsd,
    landRight: str(e.land_right),
    nationality: str(e.investor_nationality),
    owner: str(e.owner),
    withdrawalReason: str(e.withdrawal_reason),
  };
  const r = evaluateControls(input);
  const gaps = r.gaps.length ? `\n- أبرز النواقص: ${r.gaps.join(" · ")}` : "";
  return `- خلاصة الأهلية (محرّك §ج.9 الحتمي): ${r.eligibilityLabel}${gaps}`;
}

/** قائمة شركات مرشّحة حتمية من بنكنا (نفس القطاع أولاً ثم الأقوى رأسمالاً) — الذكاء يرشّح منها حصراً. */
async function companyShortlist(sector: string | null): Promise<string> {
  const sb = await createClient();
  const { data } = await sb
    .from("companies")
    .select("name, sector, activity, capital_usd, projects, meets_250k_threshold")
    .eq("is_excluded", false)
    .order("capital_usd", { ascending: false, nullsFirst: false })
    .limit(80);
  const all = (data ?? []) as Pick<Company, "name" | "sector" | "activity" | "capital_usd" | "projects" | "meets_250k_threshold">[];
  const same = sector ? all.filter((c) => c.sector === sector) : [];
  const rest = all.filter((c) => !same.includes(c));
  const pick = [...same, ...rest].slice(0, 12);
  return pick
    .map((c) => {
      const parts = [
        sectorLabel(c.sector),
        c.activity ?? null,
        c.capital_usd ? `رأس المال $${c.capital_usd.toLocaleString("en-US")}` : null,
        Array.isArray(c.projects) && c.projects.length ? `مشاريع موثّقة: ${c.projects.length}` : null,
        c.meets_250k_threshold ? "تستوفي عتبة 250 ألف" : null,
      ].filter(Boolean);
      return `- ${c.name} (${parts.join(" · ")})`;
    })
    .join("\n");
}

const WEB_TOOL = [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }];

/** نداء الذكاء مع بحث الويب إن فُعِّل — وعند تعذّر الأداة يُعاد بدونها (§ز.4: لا تعليق). */
async function chatWithOptionalWeb(system: string, content: string, maxTokens: number): Promise<string> {
  const webOn = await getWebSearchEnabled();
  if (webOn) {
    try {
      return await anthropicChat({ system, messages: [{ role: "user", content }], maxTokens, tools: WEB_TOOL });
    } catch {
      // أداة الويب غير متاحة/فشلت — نكمل ببياناتنا فقط
    }
  }
  return anthropicChat({ system, messages: [{ role: "user", content }], maxTokens });
}

// ===== القراءة والمسح =====

export async function getInsights(kind: ParcelKind, id: string): Promise<ParcelInsights> {
  const sb = await createClient();
  const { data } = await sb
    .from("parcel_insights")
    .select("recommendations, recommendations_at, criteria, criteria_at")
    .eq("kind", kind)
    .eq("ref_id", id)
    .maybeSingle<ParcelInsights>();
  return data ?? { recommendations: null, recommendations_at: null, criteria: null, criteria_at: null };
}

async function upsertInsights(kind: ParcelKind, id: string, patch: Record<string, unknown>): Promise<string | null> {
  const sb = await createClient();
  const { error } = await sb
    .from("parcel_insights")
    .upsert({ kind, ref_id: id, ...patch, updated_at: new Date().toISOString() });
  return error ? error.message : null;
}

export async function clearRecommendations(kind: ParcelKind, id: string): Promise<OkResult> {
  const err = await upsertInsights(kind, id, { recommendations: null, recommendations_at: null });
  return err ? { ok: false, error: err } : { ok: true };
}
export async function clearCriteriaDraft(kind: ParcelKind, id: string): Promise<OkResult> {
  const err = await upsertInsights(kind, id, { criteria: null, criteria_at: null });
  return err ? { ok: false, error: err } : { ok: true };
}

// ===== التوصيات الذكية (تاب 2) =====

const REC_SYSTEM = `أنت مستشار استثماري لهيئة استثمار نينوى. ولّد توصيات ذكية لقطعة استثمارية — اجتهاد آلي **غير مُلزِم** يكمّل الضوابط القانونية الإلزامية ولا يحلّ محلّها ولا يقرّر نتيجة قانونية.
أخرج أربعة أقسام بهذه العناوين حصراً:
### الاستخدام الأنسب
### الشركات الأنسب
### المخاطر والفرص
### المعمار والتشييد (إرشادي)
قواعد صارمة:
- الشركات حصراً من «قائمة الشركات المرشّحة» المعطاة: رشّح 2–4 شركات بالاسم مع تعليل موجز لكلٍّ. إن كانت القائمة فارغة فاذكر ذلك.
- اذكر **الأساس** بإيجاز لكل توصية (بيانات القطعة · خلاصة الضوابط · القائمة · أو بحث الويب — وعند الويب اذكر المصدر).
- لا تؤلّف أرقاماً أو وقائع؛ الناقص «غير متوفّر». الأرقام لاتينية دائماً. لا معرّفات داخلية.
- لا تكرّر نصوص الضوابط الإلزامية — كمّلها فقط. كن موجزاً منظّماً (نقاط قصيرة).`;

export async function generateRecommendations(kind: ParcelKind, id: string): Promise<TextResult> {
  try {
    const e = await fetchEntity(kind, id);
    if (!e) return { ok: false, error: "القطعة غير موجودة" };

    const pinned = await getInsights(kind, id);
    const criteriaCtx = pinned.criteria
      ? `\n\nمعايير القطعة المثبّتة (استند إليها في الترشيح):\n${pinned.criteria.items.map((it) => `- ${it.description} (وزن: ${it.weight})`).join("\n")}`
      : "";

    const content = `بيانات القطعة (المتوفّر فقط):\n${entitySummary(kind, e)}\n\nنتيجة الفحص القانوني الحتمي:\n${controlsSummary(kind, e)}\n\nقائمة الشركات المرشّحة (من بنك شركاتنا — رشّح منها حصراً):\n${await companyShortlist(str(e.sector))}${criteriaCtx}`;

    const text = await chatWithOptionalWeb(REC_SYSTEM, content, 2500);
    if (!text.trim()) return { ok: false, error: "تعذّر التوليد" };

    const err = await upsertInsights(kind, id, { recommendations: text, recommendations_at: new Date().toISOString() });
    if (err) return { ok: false, error: err };
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "خطأ غير متوقّع" };
  }
}

// ===== إنشاء المعايير (تاب 3) =====

const CRIT_SYSTEM = `أنت خبير معايير تقييم استثماري لهيئة استثمار نينوى. ولّد «معايير مرجعية» 🟩 (مهنية/تنافسية، **غير مُلزِمة**) لتقييم وترتيب الشركات/العروض الأنسب لقطعة استثمارية معيّنة.
أعد **JSON فقط** بلا أي نص آخر بالشكل:
{"name":"...","domain":"company","purpose":"...","items":[{"description":"...","basis":"...","weight":"...","support_indicator":"..."}]}
- domain واحدة من: company | opportunity | architecture | competitive (اختر الأنسب للقطعة).
- 5–8 بنود. لكل بند: وصف **قابل للقياس** · أساس (منطق/مصدر البند — وعند بحث الويب اذكر المصدر) · وزن (نسبة لاتينية، مجموع الأوزان 100%) · مؤشّر الدعم ببياناتنا (الحقول التي تقيسه: رأس المال بالدولار · سجلّ المشاريع · القطاع · عتبة 250 ألف · الكفاءة المالية…).
- استرشد بأمثلة مكتبة المستخدم المعطاة (أسلوبه المفضّل) دون نسخها حرفياً.
- لا تأليف أرقام/وقائع. الأرقام لاتينية. لا معرّفات داخلية.`;

function parseDraft(raw: string): CriteriaDraft | null {
  const a = raw.indexOf("{");
  const b = raw.lastIndexOf("}");
  if (a === -1 || b <= a) return null;
  try {
    const p = JSON.parse(raw.slice(a, b + 1)) as Partial<CriteriaDraft>;
    const items = Array.isArray(p.items)
      ? p.items
          .map((it) => ({
            description: String((it as Record<string, unknown>)?.description ?? "").trim(),
            basis: String((it as Record<string, unknown>)?.basis ?? "").trim(),
            weight: String((it as Record<string, unknown>)?.weight ?? "").trim(),
            support_indicator: String((it as Record<string, unknown>)?.support_indicator ?? "").trim(),
          }))
          .filter((it) => it.description)
      : [];
    if (!items.length) return null;
    const domain = ["company", "opportunity", "architecture", "competitive"].includes(String(p.domain)) ? String(p.domain) : "company";
    return {
      name: String(p.name ?? "").trim() || "معايير مولّدة",
      domain,
      purpose: String(p.purpose ?? "").trim(),
      items,
    };
  } catch {
    return null;
  }
}

export async function generateCriteria(kind: ParcelKind, id: string): Promise<DraftResult> {
  try {
    const e = await fetchEntity(kind, id);
    if (!e) return { ok: false, error: "القطعة غير موجودة" };

    // مرجعية المكتبة (حلقة التحسين §هـ.4: أمثلة المستخدم في السياق، لا إعادة تدريب)
    const sb = await createClient();
    const { data: lib } = await sb
      .from("criteria")
      .select("name, purpose, items")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(4);
    const exemplars = (lib ?? [])
      .map((c) => `- «${c.name}»${c.purpose ? ` (الغرض: ${c.purpose})` : ""} — ${Array.isArray(c.items) ? c.items.length : 0} بنود`)
      .join("\n");

    const content = `بيانات القطعة (المتوفّر فقط):\n${entitySummary(kind, e)}\n\nنتيجة الفحص القانوني الحتمي:\n${controlsSummary(kind, e)}\n\nقالب الشركة القابل للقياس عندنا: رأس المال (دينار/دولار) · استيفاء عتبة 250 ألف · سجلّ المشاريع/الخبرة · القطاع/النشاط · المدير والمساهمون · بيانات الاتصال.\n\nأمثلة من مكتبة معايير المستخدم:\n${exemplars || "(المكتبة فارغة بعد)"}`;

    const raw = await chatWithOptionalWeb(CRIT_SYSTEM, content, 2000);
    const draft = parseDraft(raw);
    if (!draft) return { ok: false, error: "تعذّر توليد بنود صالحة — حاول مجدداً" };

    const err = await upsertInsights(kind, id, { criteria: draft, criteria_at: new Date().toISOString() });
    if (err) return { ok: false, error: err };
    return { ok: true, draft };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "خطأ غير متوقّع" };
  }
}

/** حفظ المسودة المثبّتة في مكتبة المعايير (§هـ.4.د) — قابلة للتحرير هناك (CRUD). */
export async function saveCriteriaToLibrary(kind: ParcelKind, id: string): Promise<OkResult> {
  const pinned = await getInsights(kind, id);
  if (!pinned.criteria) return { ok: false, error: "لا مسودة مثبّتة" };
  const e = await fetchEntity(kind, id);
  const sb = await createClient();
  const { error } = await sb.from("criteria").insert({
    name: pinned.criteria.name,
    domain: pinned.criteria.domain,
    purpose: pinned.criteria.purpose || null,
    items: pinned.criteria.items,
    status: "active",
    parcel_ref: str(e?.parcel_no),
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}
