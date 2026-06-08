"use server";

// مكتبة الاستشارات (§هـ.5 · §ج.8/6) — حفظ/حذف الاستشارة بعنوان مقترَح بالذكاء (قابل للتعديل).
import { createClient } from "@/lib/supabase/server";
import { anthropicChat } from "@/lib/ai/anthropic";

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

async function suggestTitle(question: string): Promise<string> {
  const fallback = question.replace(/\s+/g, " ").trim().slice(0, 60) || "استشارة قانونية";
  try {
    const t = await anthropicChat({
      system: "اقترح عنواناً موجزاً جداً (٣–٦ كلمات) لاستشارة قانونية استثمارية. أعد العنوان فقط، بلا علامات اقتباس ولا شرح.",
      messages: [{ role: "user", content: question }],
      maxTokens: 30,
    });
    const clean = t.replace(/["«»]/g, "").split("\n")[0]?.trim() ?? "";
    return clean.slice(0, 80) || fallback;
  } catch {
    return fallback;
  }
}

export async function saveConsultation(input: {
  question: string;
  answer: string;
  inputs?: unknown;
  title?: string;
}): Promise<SaveResult> {
  const supabase = await createClient();
  const title = input.title?.trim() || (await suggestTitle(input.question));
  const { data, error } = await supabase
    .from("consultations")
    .insert({
      title,
      question: input.question,
      answer: input.answer,
      excerpt: input.answer.replace(/\s+/g, " ").trim().slice(0, 140),
      inputs: input.inputs ?? null,
      consulted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as { id: string }).id };
}

export async function deleteConsultation(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.from("consultations").delete().eq("id", id);
  return { ok: !error };
}
