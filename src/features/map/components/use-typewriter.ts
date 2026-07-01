"use client";

// م9.13 · سرد طباعة حرفيّ للبطاقات الهولوغراميّة: يكشف النصّ تدريجيّاً عند تفعيله، ويستدعي onTick دوريّاً (لنقرة الصوت).
// القصّ على مؤشّر الطول (slice) ⇒ ترتيب RTL والمحارف العربيّة سليمة (الحاوية direction:rtl تتولّى الاتّجاه).
import { useEffect, useRef, useState } from "react";

export function useTypewriter(
  text: string,
  opts: { enabled: boolean; cps?: number; onTick?: () => void; onDone?: () => void },
): { shown: string; done: boolean } {
  const { enabled, cps = 42, onTick, onDone } = opts;
  const [n, setN] = useState(0);
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!enabled) {
      setN(0);
      return;
    }
    if (!text) {
      setN(0);
      onDoneRef.current?.();
      return;
    }
    let raf = 0;
    let last = 0;
    let i = 0;
    let finished = false;
    const step = 1000 / Math.max(1, cps);
    const tick = (now: number): void => {
      if (!last) last = now;
      while (now - last >= step && i < text.length) {
        last += step;
        i += 1;
        if (i % 2 === 0) onTickRef.current?.(); // نقرة كلّ حرفين (تخفيف الكثافة)
      }
      setN(i);
      if (i >= text.length) {
        finished = true;
        onDoneRef.current?.();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (!finished) cancelAnimationFrame(raf);
    };
  }, [text, enabled, cps]);

  return { shown: text.slice(0, n), done: enabled && n >= text.length };
}
