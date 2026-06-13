"use server";

// م6.4 · إثراء الشركات بالويب (§هـ.5 الشركات): بحث ويب ذكي ← **اقتراح بمصدر** ← اعتماد المستخدم (لا حفظ تلقائي).
// بطاقة الذكاء: النموذج من الإعدادات · المصدر: الويب (للإثراء فقط) · كل مُقترَح بمصدر · لا تأليف · الاعتماد للمستخدم.

import { createClient } from "@/lib/supabase/server";
import { anthropicChat } from "@/lib/ai/anthropic";
import { getWebSearchEnabled } from "@/lib/ai/ai-config";
import { sectorLabel } from "@/lib/sectors";
import type { Company } from "@/types/entities";

export interface EnrichSuggestion {
  field: string;
  label: string;
  value: string;
  source: string;
}
type SuggestResult = { ok: true; suggestions: EnrichSuggestion[] } | { ok: false; error: string };
type OkResult = { ok: true } | { ok: false; error: string };

// الحقول القابلة للإثراء (نصوص اتصال/تعريف + رأس المال) — لا حقول أهلية/تصنيف داخلي.
const ENRICHABLE: Record<string, string> = {
  phone: "الهاتف",
  email: "البريد الإلكتروني",
  website: "الموقع الإلكتروني",
  address: "العنوان",
  manager: "المدير",
  activity: "النشاط",
  capital_iqd: "رأس المال (دينار)",
  capital_usd: "رأس المال (دولار)",
};
const NUMERIC_FIELDS = new Set(["capital_iqd", "capital_usd"]);

const SYSTEM = `أنت باحث بيانات شركات عراقية لهيئة استثمار نينوى. عبر **بحث الويب**، اقترح قيماً للحقول الناقصة المطلوبة لشركة معيّنة.
أعد **JSON فقط** بلا أي نص آخر بالشكل: {"suggestions":[{"field":"phone","value":"...","source":"الرابط أو اسم المصدر"}]}
قواعد صارمة:
- اقترح **فقط** ما وجدت له مصدراً فعلياً من نتائج البحث — لا تخمين ولا تأليف إطلاقاً. إن لم تجد شيئاً موثوقاً أعد {"suggestions":[]}.
- field حصراً من قائمة الحقول الناقصة المعطاة. كل اقتراح **بمصدر** (رابط يُفضَّل).
- الأرقام لاتينية. رأس المال رقماً صرفاً بلا فواصل نصية.`;

export async function enrichCompany(id: string): Promise<SuggestResult> {
  try {
    if (!(await getWebSearchEnabled())) {
      return { ok: false, error: "بحث الويب معطَّل — فعِّله من الإعدادات ← الذكاء" };
    }
    const sb = await createClient();
    const { data: c } = await sb.from("companies").select("*").eq("id", id).maybeSingle<Company>();
    if (!c) return { ok: false, error: "الشركة غير موجودة" };

    const rec = c as unknown as Record<string, unknown>;
    const missing = Object.entries(ENRICHABLE).filter(([key]) => {
      const v = rec[key];
      return v === null || v === undefined || v === "";
    });
    if (!missing.length) return { ok: false, error: "لا حقول ناقصة قابلة للإثراء" };

    const ctx = [
      `اسم الشركة: ${c.name}`,
      c.sector ? `القطاع: ${sectorLabel(c.sector)}` : null,
      c.activity ? `النشاط: ${c.activity}` : null,
      c.registration_no ? `رقم القيد: ${c.registration_no}` : null,
      c.governorate ? `المحافظة (رمز): ${c.governorate}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const raw = await anthropicChat({
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `${ctx}\n\nالحقول الناقصة المطلوب إثراؤها (field: التسمية):\n${missing.map(([k, l]) => `- ${k}: ${l}`).join("\n")}`,
        },
      ],
      maxTokens: 1500,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
    });

    const a = raw.indexOf("{");
    const b = raw.lastIndexOf("}");
    if (a === -1 || b <= a) return { ok: true, suggestions: [] };
    const parsed = JSON.parse(raw.slice(a, b + 1)) as { suggestions?: { field?: unknown; value?: unknown; source?: unknown }[] };
    const allowed = new Set(missing.map(([k]) => k));
    const suggestions: EnrichSuggestion[] = (parsed.suggestions ?? [])
      .map((s) => ({
        field: String(s.field ?? ""),
        value: String(s.value ?? "").trim(),
        source: String(s.source ?? "").trim(),
      }))
      .filter((s) => allowed.has(s.field) && s.value && s.source) // بلا مصدر = يُرفَض (لا تأليف)
      .map((s) => ({ ...s, label: ENRICHABLE[s.field]! }));
    return { ok: true, suggestions };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "خطأ غير متوقّع" };
  }
}

/** اعتماد المستخدم: يحدّث الحقول المعتمدة فقط + يوثّق المصدر في حقل المصدر (source[]). */
export async function applyEnrichment(id: string, items: { field: string; value: string; source: string }[]): Promise<OkResult> {
  const valid = items.filter((it) => it.field in ENRICHABLE && it.value.trim());
  if (!valid.length) return { ok: false, error: "لا اقتراحات معتمدة" };

  const patch: Record<string, unknown> = {};
  for (const it of valid) {
    if (NUMERIC_FIELDS.has(it.field)) {
      // رقم صرف فقط (بعد إزالة الفواصل) — «1.5 مليون» ونحوها تُرفض لا تُخمَّن (صفر تأليف)
      const clean = it.value.replace(/[,٬\s]/g, "");
      if (!/^\d+(\.\d+)?$/.test(clean)) continue;
      const n = Number(clean);
      if (!Number.isFinite(n) || n <= 0) continue;
      patch[it.field] = n;
    } else {
      patch[it.field] = it.value.trim();
    }
  }
  if (!Object.keys(patch).length) return { ok: false, error: "قيم غير صالحة" };

  const sb = await createClient();
  const { data: c } = await sb.from("companies").select("source").eq("id", id).maybeSingle<{ source: string[] }>();
  const prev = Array.isArray(c?.source) ? c.source : [];
  const added = valid.filter((it) => it.field in patch).map((it) => `إثراء ويب (${ENRICHABLE[it.field]}): ${it.source}`);
  patch.source = Array.from(new Set([...prev, ...added]));

  const { error } = await sb.from("companies").update(patch).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
