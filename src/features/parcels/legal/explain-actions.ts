"use server";

// م4.4 · صياغة الذكاء لشرح نتيجة الضوابط الحتمية (§ج.9). الذكاء **يصوغ الشرح فقط لا يقرّر** (CLAUDE.md قاعدة 5).
import { anthropicChat } from "@/lib/ai/anthropic";

export interface ExplainItem {
  number: number;
  title: string;
  citation: string;
  fulfillment: string; // التسمية العربية للاستيفاء
  note?: string;
}
export type ExplainResult = { ok: true; text: string } | { ok: false; error: string };

const SYSTEM = `أنت تصوغ شرحاً للمستخدم لنتيجة فحص قانوني **حتمي** أُنجِز مسبقاً بقواعد موثّقة.
- **لا تغيّر أيّ نتيجة ولا تضف حكماً جديداً ولا تخترع رقماً/مادة.**
- لخّص خلاصة الأهلية وأبرز الضوابط والمعايير والإجراءات المطلوبة، في فقرات موجزة واضحة منظّمة.
- استند للبنود واستشهاداتها كما وردت فقط، وأبقِ الاستشهادات كما هي (قانون/نظام + سنة + مادة/بند).
- لا معرّف داخلي · لا كشف تحقّق · عربية مرتّبة · أرقام لاتينية.`;

export async function explainControls(payload: {
  state: string;
  eligibility: string;
  project: ExplainItem[];
  investor: ExplainItem[];
  gaps: string[];
}): Promise<ExplainResult> {
  try {
    const fmt = (arr: ExplainItem[]): string =>
      arr.map((i) => `${i.number}. ${i.title} [${i.fulfillment}] — ${i.citation}${i.note ? ` (${i.note})` : ""}`).join("\n");
    const context =
      `الحالة: ${payload.state}\nخلاصة الأهلية: ${payload.eligibility}\n\n` +
      `أولاً — ضوابط المشروع/الأرض:\n${fmt(payload.project)}\n\n` +
      `ثانياً — معايير المستثمر/الشركة:\n${fmt(payload.investor)}\n\n` +
      `أبرز النواقص: ${payload.gaps.join(" · ") || "لا شيء"}`;
    const text = await anthropicChat({ system: SYSTEM, messages: [{ role: "user", content: context }], maxTokens: 900 });
    return { ok: true, text: text || "تعذّرت الصياغة." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "خطأ غير متوقّع" };
  }
}
