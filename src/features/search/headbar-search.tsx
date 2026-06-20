"use client";

// م8.8 · بحث الهيدبار المضمَّن (الحاسوب md+) — حقل حيّ + قائمة نتائج منسدلة تحته **بلا نافذة** (§هـ.2.ج).
// نفس منطق useSuperSearch المشترك مع الجوال (MobileSearch). Ctrl K يركّز الحقل. النتائج حقيقية حصراً.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Building2, Loader2, MapPin, MapPinned, Megaphone, Search, Shapes } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchKind, SearchResult } from "./types";
import { navHint, useSuperSearch } from "./use-super-search";

const KIND_META: Record<SearchKind, { label: string; Icon: typeof Search; cls: string }> = {
  opportunity: { label: "فرصة", Icon: Megaphone, cls: "text-state-announced" },
  license: { label: "رخصة", Icon: BadgeCheck, cls: "text-state-inprogress" },
  company: { label: "شركة", Icon: Building2, cls: "text-primary" },
  assumed: { label: "مفترضة", Icon: Shapes, cls: "text-state-assumed" },
  annotation: { label: "تسمية", Icon: MapPinned, cls: "text-[#94afd1]" },
  place: { label: "موقع", Icon: MapPin, cls: "text-foreground/70" },
};

export function HeadbarSearch() {
  const { query, setQuery, results, warning, loading, sel, setSel, go, reset, handleKey } = useSuperSearch();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Ctrl/Cmd K يركّز الحقل المضمَّن (بدل فتح نافذة) · Esc يطويه
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape") {
        inputRef.current?.blur();
        setFocused(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // طيّ القائمة عند النقر خارجها
  useEffect(() => {
    function onDown(e: PointerEvent): void {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  function onGo(r: SearchResult): void {
    go(r);
    setFocused(false);
    inputRef.current?.blur();
    reset();
  }

  const q = query.trim();
  const showPanel = focused && q.length >= 1;

  return (
    <div ref={boxRef} className="relative shrink-0 md:w-36 lg:w-44 xl:w-56 2xl:w-72">
      <div className="flex h-9 items-center gap-2 rounded-xl border border-[rgba(148,175,209,0.45)] bg-white/5 px-2.5 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition focus-within:border-[rgba(148,175,209,0.9)] focus-within:bg-white/10 focus-within:text-foreground focus-within:shadow-[0_0_18px_-6px_rgba(148,175,209,0.8)] 2xl:h-11 2xl:px-3">
        <Search className="size-4 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) =>
            handleKey(e, () => {
              const r = results[sel];
              if (r) onGo(r);
            })
          }
          placeholder="ابحث في نينوى…"
          className="min-w-0 flex-1 bg-transparent text-right text-[11px] text-foreground outline-none placeholder:text-muted-foreground/70 lg:text-xs 2xl:text-sm"
        />
        {loading ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
        ) : (
          <kbd className="hidden rounded bg-black/25 px-1.5 py-0.5 text-[9px] lg:inline">Ctrl K</kbd>
        )}
      </div>

      <AnimatePresence>
        {showPanel ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-[calc(100%+6px)] z-50 w-[min(26rem,90vw)] overflow-hidden rounded-2xl border border-[rgba(148,175,209,0.45)] bg-[hsl(220_36%_15%_/_0.98)] shadow-[0_24px_70px_-18px_rgba(0,0,0,0.7),0_0_0_1px_rgba(148,175,209,0.12)]"
          >
            <div className="scroll-slim max-h-[58vh] overflow-y-auto p-2">
              {warning ? (
                <p className="mx-1 mb-1.5 rounded-lg bg-state-announced/10 px-3 py-2 text-xs text-state-announced ring-1 ring-inset ring-state-announced/35">{warning}</p>
              ) : null}
              {q.length < 2 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">اكتب حرفين على الأقل — بياناتنا أولاً ثم مواقع نينوى.</p>
              ) : loading && results.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">يبحث…</p>
              ) : results.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">لا نتائج مطابقة ضمن نينوى.</p>
              ) : (
                <ul className="space-y-0.5">
                  {results.map((r, i) => {
                    const m = KIND_META[r.kind];
                    const Icon = m.Icon;
                    return (
                      <li key={`${r.kind}-${i}-${r.label}`}>
                        <button
                          type="button"
                          data-sfx="off"
                          onMouseEnter={() => setSel(i)}
                          onClick={() => onGo(r)}
                          className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-right transition", i === sel ? "bg-[rgba(148,175,209,0.16)]" : "hover:bg-white/5")}
                        >
                          <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg bg-white/5 ring-1 ring-inset ring-border/40", m.cls)}>
                            <Icon className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold text-foreground">{r.label}</span>
                              <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] bg-white/5", m.cls)}>{m.label}</span>
                            </span>
                            {r.sublabel ? <span className="block truncate text-xs text-muted-foreground">{r.sublabel}</span> : null}
                          </span>
                          {r.parcel_no ? (
                            <span className="shrink-0 rounded bg-secondary/50 px-1.5 py-0.5 text-[11px] tabular-nums text-secondary-foreground">{r.parcel_no}</span>
                          ) : null}
                          {i === sel ? <span className="shrink-0 text-[10px] text-muted-foreground">{navHint(r)}</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
