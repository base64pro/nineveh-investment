"use client";

// المستشار القانوني — لوحة الأسئلة الحرّة (الشق الثاني §هـ.5). محادثة مستندة للطبقة القانونية باستشهاد.

import { useEffect, useRef, useState } from "react";
import { Scale, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import { askLegalAdvisor } from "./actions";
import type { ChatMessage } from "@/lib/ai/anthropic";

export function LegalAdvisorPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    <div className="flex h-full flex-col">
      <div className="border-b border-border/60 bg-gradient-to-l from-primary/10 to-transparent px-3 py-2">
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Scale className="size-3.5 shrink-0 text-primary/70" /> المصدر: الطبقة القانونية حصراً · كل إجابة باستشهاد · لا تأليف.
        </p>
      </div>

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
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-primary/70">
                <Sparkles className="size-3.5" /> المستشار القانوني
              </p>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{m.content}</div>
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
            className="scroll-slim max-h-32 min-h-[2.75rem] w-full resize-none rounded-xl border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
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
