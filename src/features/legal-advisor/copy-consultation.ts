"use client";

// م7.10 · نسخ نتيجة الاستشارة (سؤال + إجابة) نصاً نظيفاً — قبل الحفظ ومن المكتبة.
import { toast } from "sonner";

/** يبني نصاً مرتّباً للاستشارة وينسخه للحافظة (يجرّد ماركداون الغامق فقط — النصّ حرفي بلا تغيير). */
export async function copyConsultation(question: string, answer: string, title?: string | null): Promise<void> {
  const clean = (s: string): string => s.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
  const parts = [
    title?.trim() ? `${title.trim()}\n${"─".repeat(Math.min(40, title.trim().length))}` : null,
    `السؤال:\n${clean(question)}`,
    `الإجابة:\n${clean(answer)}`,
  ].filter(Boolean);
  const text = parts.join("\n\n");
  try {
    await navigator.clipboard.writeText(text);
    toast.success("نُسخت الاستشارة إلى الحافظة");
  } catch {
    // مسار احتياطي إن مُنع clipboard API
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      toast.success("نُسخت الاستشارة إلى الحافظة");
    } catch {
      toast.error("تعذّر النسخ — انسخ يدوياً");
    }
    document.body.removeChild(ta);
  }
}
