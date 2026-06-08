"use server";

// المستشار القانوني — الشق الثاني (أسئلة حرّة) · §هـ.5. RAG على الطبقة القانونية حصراً ← Anthropic باستشهاد.
// خادمي بالكامل: المفاتيح والاسترجاع والنموذج لا تصل العميل. صفر تأليف · لا معرّف داخلي · لا كشف تحقّق.
import { createClient } from "@/lib/supabase/server";
import { voyageEmbed, toVectorLiteral } from "@/lib/ai/voyage";
import { anthropicChat, type ChatMessage } from "@/lib/ai/anthropic";

export type AdvisorResult = { ok: true; answer: string } | { ok: false; error: string };

interface LegalRow {
  doc_type: string | null;
  doc_number: number | null;
  doc_year: number | null;
  article_no: number | null;
  article_label_ar: string | null;
  article_text: string | null;
  clauses: { key?: string; text?: string }[] | null;
}

const SYSTEM = `أنت المستشار القانوني للاستثمار في هيئة استثمار محافظة نينوى. تجيب بدقّة مطلقة عن أسئلة الاستثمار والقانون.

القواعد الصارمة (بلا استثناء):
- مصدرك **الوحيد** هو «المواد القانونية المتاحة» في رسالة المستخدم (الطبقة القانونية). لا معرفة خارجية ولا ويب.
- **كل حكم أو ادّعاء يقترن باستشهاد صريح**: اسم القانون/النظام/التعليمات + السنة + رقم المادة (والبند إن وُجد)، بالصيغة الواردة في رأس المادة (مثل: «قانون 13/2006 · المادة 29»).
- **صفر تأليف**: إن لم تجد الإجابة في المواد المتاحة فقُل صراحةً «هذا غير متوفّر في الطبقة القانونية المتاحة» واقترح أقرب مادة ذات صلة إن وُجدت. لا تخترع أرقاماً أو مواد أو أحكاماً.
- ميّز **النصّ الملزم** (باستشهاد) عن أيّ **اجتهاد/تفسير** (أشِر صراحةً أنه اجتهاد غير مُلزِم).
- لا تذكر أيّ معرّف داخلي للسجلّ، ولا حالة تحقّق.
- العربية، منظّم ومرتّب وواضح، مباشر دون حشو. الأرقام لاتينية.

حالات الإجابة:
- محدّد بقانون واحد ← إجابة مركّزة باستشهاد دقيق.
- متعدّد الجوانب ← إحاطة منظّمة بعدّة مواد، كلّ نقطة باستشهادها.
- خارج نطاق المواد المتاحة ← «غير متوفّر في الطبقة القانونية» + أقرب مادة إن وُجدت.
- غامض ← اطلب توضيحاً أو بيّن الافتراض.
- يحتاج اجتهاداً ← افصل الملزم (استشهاد) عن الاجتهاد (مؤشَّر).`;

function citation(r: LegalRow): string {
  const t = r.doc_type ?? "وثيقة";
  const num = r.doc_number != null && r.doc_year != null ? ` ${r.doc_number}/${r.doc_year}` : "";
  const art = r.article_no != null ? ` · المادة ${r.article_no}` : "";
  const label = r.article_label_ar ? ` (${r.article_label_ar})` : "";
  return `${t}${num}${art}${label}`;
}

function clausesText(clauses: LegalRow["clauses"]): string {
  if (!Array.isArray(clauses) || clauses.length === 0) return "";
  return (
    "\nالبنود:\n" +
    clauses.map((c) => `• ${c.key ? `${c.key}: ` : ""}${c.text ?? ""}`).join("\n")
  );
}

export async function askLegalAdvisor(question: string, history: ChatMessage[] = []): Promise<AdvisorResult> {
  try {
    const q = question.trim();
    if (!q) return { ok: false, error: "السؤال فارغ" };

    // 1) تضمين السؤال (Voyage · query)
    const [emb] = await voyageEmbed([q], "query");
    if (!emb) return { ok: false, error: "تعذّر تضمين السؤال" };

    // 2) استرجاع أقرب المواد (RAG) — RLS عبر العميل الخادمي
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("match_legal", {
      query_embedding: toVectorLiteral(emb),
      match_count: 12,
    });
    if (error) return { ok: false, error: error.message };
    const rows = (data ?? []) as LegalRow[];
    if (rows.length === 0) {
      return { ok: true, answer: "لا توجد مواد قانونية مُفهرسة بعد للإجابة. (شغّل فهرسة الطبقة القانونية.)" };
    }

    // 3) سياق المواد (مصدر الإجابة الوحيد، باستشهاداتها)
    const context = rows
      .map((r) => `【${citation(r)}】\n${r.article_text ?? ""}${clausesText(r.clauses)}`)
      .join("\n\n———\n\n");

    // 4) صياغة الإجابة (Opus 4.8) — السياق + سلسلة المحادثة للمتابعة
    const messages: ChatMessage[] = [
      ...history.slice(-6),
      { role: "user", content: `المواد القانونية المتاحة (مصدرك الوحيد):\n\n${context}\n\n────────\nسؤال المستخدم: ${q}` },
    ];
    const answer = await anthropicChat({ system: SYSTEM, messages, maxTokens: 2048 });
    return { ok: true, answer: answer || "تعذّرت الصياغة." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "خطأ غير متوقّع" };
  }
}
