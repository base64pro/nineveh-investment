"use client";

// المستشار — الشق الثاني (أسئلة حرّة): محادثة مستندة للطبقة القانونية باستشهاد (§هـ.5).

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus, Copy, Scale, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import { askLegalAdvisor } from "./actions";
import { saveConsultation } from "./consultation-actions";
import { copyConsultation } from "./copy-consultation";
import { AdvisorAnswer } from "./advisor-answer";
import type { ChatMessage } from "@/lib/ai/anthropic";

export function AdvisorChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // مربع السؤال يتوسّع مع النص حتى 50% من مساحة لوحة الاستشارات ثم يظهر تمرير — النص كله مقروء (طلب معتمد)
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    const cap = Math.max(160, Math.floor((rootRef.current?.clientHeight ?? window.innerHeight) * 0.5));
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, cap)}px`;
    ta.style.overflowY = ta.scrollHeight > cap ? "auto" : "hidden";
  }, [input]);

  async function saveOne(i: number) {
    const answer = messages[i]?.content ?? "";
    const question = messages[i - 1]?.content ?? "";
    if (!question || !answer || savingIdx !== null) return;
    setSavingIdx(i);
    const res = await saveConsultation({ question, answer });
    setSavingIdx(null);
    if (res.ok) {
      toast.success("حُفِظت في المكتبة");
      void queryClient.invalidateQueries({ queryKey: ["table", "consultations"] });
    } else {
      toast.error("تعذّر الحفظ");
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    const history = messages;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setLoading(true);
    const res = await askLegalAdvisor(q, history);
    setLoading(false);
    setMessages((m) => [
      ...m,
      { role: "assistant", content: res.ok ? res.answer : "تعذّر الحصول على إجابة. (تحقّق من إعداد الذكاء أو حاول مجدداً.)" },
    ]);
    if (!res.ok) toast.error("تعذّرت الاستشارة");
  }

  return (
    <div ref={rootRef} className="flex h-full flex-col">
      <div ref={scrollRef} className="scroll-slim min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
            <Scale className="size-10 text-primary/40" />
            <p className="text-sm font-medium text-foreground/80">اسأل عن الضوابط والمعايير والقوانين الاستثمارية</p>
            <p className="text-xs">مثال: «ما عتبة رأس المال المطلوبة من المستثمر؟» · «كم مدّة الإعفاء الضريبي؟»</p>
          </div>
        ) : null}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-start">
              <div className="inline-flex max-w-[88%] items-start gap-2 rounded-2xl rounded-tr-sm bg-primary/15 px-3 py-2 text-sm ring-1 ring-inset ring-primary/25">
                <User className="mt-0.5 size-3.5 shrink-0 text-primary/70" />
                <span className="whitespace-pre-wrap">{m.content}</span>
              </div>
            </div>
          ) : (
            <div key={i} className="rounded-2xl border border-border/60 bg-background/40 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-primary/70">
                  <Sparkles className="size-3.5" /> المستشار القانوني
                </p>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => void copyConsultation(messages[i - 1]?.content ?? "", m.content)}
                    title="نسخ السؤال والإجابة"
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:bg-accent hover:text-primary"
                  >
                    <Copy className="size-3.5" /> نسخ
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveOne(i)}
                    disabled={savingIdx === i}
                    title="حفظ في مكتبة الاستشارات"
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:bg-accent hover:text-primary disabled:opacity-50"
                  >
                    <BookmarkPlus className="size-3.5" /> {savingIdx === i ? "…" : "حفظ"}
                  </button>
                </div>
              </div>
              <AdvisorAnswer text={m.content} />
            </div>
          ),
        )}

        {loading ? (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-background/40 px-3 py-2 text-sm text-muted-foreground">
            <Sparkles className="size-3.5 animate-pulse text-primary/70" /> يستشير الطبقة القانونية…
          </div>
        ) : null}
      </div>

      <div className="border-t border-border/60 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder="اكتب سؤالك القانوني…"
            disabled={loading}
            className="scroll-slim min-h-[2.75rem] w-full resize-none rounded-xl border border-input bg-background/60 px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={loading || !input.trim()}
            aria-label="إرسال"
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
