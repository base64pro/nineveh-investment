"use client";

// م5.2 · لوحة البحث الفائق (§هـ.2.ج) — للديسكتوب: نافذة مركزية بمدخل واحد. (على الجوال يُستخدم البحث
// المضمَّن MobileSearch في الشريط السفلي — نفس المنطق عبر useSuperSearch، بلا مربّع منفصل.)
// النتائج حقيقية حصراً؛ النقر ينتقل لمصدرها (قطعة · قسم · موقع جغرافي).

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Building2, Loader2, MapPin, MapPinned, Megaphone, Search, Shapes, X } from "lucide-react";
import type { SearchKind, SearchResult } from "./types";
import { onOpenSearch } from "./search-store";
import { navHint, useSuperSearch } from "./use-super-search";

const KIND_META: Record<SearchKind, { label: string; Icon: typeof Search; cls: string }> = {
  opportunity: { label: "فرصة", Icon: Megaphone, cls: "text-state-announced" },
  license: { label: "رخصة", Icon: BadgeCheck, cls: "text-state-inprogress" },
  company: { label: "شركة", Icon: Building2, cls: "text-primary" },
  assumed: { label: "مفترضة", Icon: Shapes, cls: "text-state-assumed" },
  annotation: { label: "تسمية", Icon: MapPinned, cls: "text-[#94afd1]" },
  place: { label: "موقع", Icon: MapPin, cls: "text-foreground/70" },
};

export function SearchOverlay() {
  const [open, setOpen] = useState(false);
  const { query, setQuery, results, warning, loading, sel, setSel, go, reset, handleKey } = useSuperSearch();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => onOpenSearch(() => setOpen(true)), []);
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // تركيز عند الفتح · تصفير عند الإغلاق
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
    reset();
    return undefined;
  }, [open, reset]);

  function onGo(r: SearchResult): void {
    go(r);
    setOpen(false);
  }

  const q = query.trim();

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onMouseDown={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-center bg-[hsl(220_40%_5%_/_0.6)] px-4 pt-[12vh] backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: -14, opacity: 0, scale: 0.985 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex max-h-[70vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[rgba(148,175,209,0.45)] bg-[hsl(220_36%_15%_/_0.98)] shadow-[0_24px_70px_-18px_rgba(0,0,0,0.7),0_0_0_1px_rgba(148,175,209,0.12)]"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const r = results[sel];
                if (r) onGo(r);
              }}
              className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3"
            >
              <Search className="size-5 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) =>
                  handleKey(e, () => {
                    const r = results[sel];
                    if (r) onGo(r);
                  })
                }
                placeholder="ابحث في بيانات نينوى أو عن موقع… (قطعة · فرصة · رخصة · شركة · معلم)"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/70"
              />
              {loading ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
                className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </form>

            <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-2">
              {warning ? (
                <p className="mx-1 mb-1.5 rounded-lg bg-state-announced/10 px-3 py-2 text-xs text-state-announced ring-1 ring-inset ring-state-announced/35">
                  {warning}
                </p>
              ) : null}
              {q.length < 2 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  اكتب حرفين على الأقل — تُعرَض بياناتنا أولاً ثم المواقع الجغرافية ضمن نينوى.
                </p>
              ) : loading && results.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">يبحث…</p>
              ) : results.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">لا نتائج مطابقة ضمن نينوى.</p>
              ) : (
                <ul className="space-y-0.5">
                  {results.map((r, i) => {
                    const m = KIND_META[r.kind];
                    const Icon = m.Icon;
                    return (
                      <li key={`${r.kind}-${i}-${r.label}`}>
                        <button
                          type="button"
                          onMouseEnter={() => setSel(i)}
                          onClick={() => onGo(r)}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-right transition ${
                            i === sel ? "bg-[rgba(148,175,209,0.16)]" : "hover:bg-white/5"
                          }`}
                        >
                          <span className={`grid size-9 shrink-0 place-items-center rounded-lg bg-white/5 ring-1 ring-inset ring-border/40 ${m.cls}`}>
                            <Icon className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold text-foreground">{r.label}</span>
                              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${m.cls} bg-white/5`}>{m.label}</span>
                            </span>
                            {r.sublabel ? <span className="block truncate text-xs text-muted-foreground">{r.sublabel}</span> : null}
                          </span>
                          {r.parcel_no ? (
                            <span className="shrink-0 rounded bg-secondary/50 px-1.5 py-0.5 text-[11px] tabular-nums text-secondary-foreground">
                              {r.parcel_no}
                            </span>
                          ) : null}
                          {i === sel ? <span className="shrink-0 text-[10px] text-muted-foreground">{navHint(r)}</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border/50 px-4 py-2 text-[11px] text-muted-foreground">
              <span>بياناتنا أولاً · ثم مواقع نينوى — لا تأليف</span>
              <span className="hidden sm:block">↑↓ تنقّل · ↵ فتح · Esc إغلاق</span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
