"use client";

// م8.3 · البحث المضمَّن على الجوال (§هـ.2.ج) — شريط سفلي ثابت هو حقل البحث نفسه (لا مربّع منفصل ينبثق).
// عند التركيز يتمدّد لملء المنطقة المرئية (--app-h فوق الكيبورد) فتظهر النتائج فوق الحقل ذاته. يُخفى تحت الورقة.
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Building2, Loader2, MapPin, MapPinned, Megaphone, Search, Shapes, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchKind, SearchResult } from "@/features/search/types";
import { navHint, useSuperSearch } from "@/features/search/use-super-search";
import { useSheetHeight } from "@/features/shell/mobile-sheet-store";

const META: Record<SearchKind, { Icon: typeof Search; cls: string; label: string }> = {
  opportunity: { Icon: Megaphone, cls: "text-state-announced", label: "فرصة" },
  license: { Icon: BadgeCheck, cls: "text-state-inprogress", label: "رخصة" },
  company: { Icon: Building2, cls: "text-primary", label: "شركة" },
  assumed: { Icon: Shapes, cls: "text-state-assumed", label: "مفترضة" },
  annotation: { Icon: MapPinned, cls: "text-[#94afd1]", label: "تسمية" },
  place: { Icon: MapPin, cls: "text-foreground/70", label: "موقع" },
};

export function MobileSearch() {
  const [active, setActive] = useState(false);
  const { query, setQuery, results, warning, loading, sel, go, reset, handleKey } = useSuperSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const sheetOpen = useSheetHeight() > 0;

  const close = (): void => {
    setActive(false);
    reset();
    inputRef.current?.blur();
  };
  const onGo = (r: SearchResult): void => {
    go(r);
    close();
  };

  if (sheetOpen) return null; // مخفي تحت الورقة السفلية

  const q = query.trim();
  return (
    <>
      <AnimatePresence>
        {active ? (
          <motion.div
            key="bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onPointerDown={close}
            className="fixed inset-0 z-40 bg-[hsl(220_40%_5%/0.55)] backdrop-blur-[2px] md:hidden"
          />
        ) : null}
      </AnimatePresence>

      <div
        className={cn("fixed inset-x-0 z-40 flex flex-col md:hidden", active ? "top-0" : "bottom-0")}
        style={active ? { height: "var(--app-h, 100dvh)", paddingTop: "var(--sat)" } : undefined}
      >
        {/* النتائج فوق الحقل نفسه (عند التفعيل) — لا مربّع بحث منفصل */}
        {active ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {warning ? (
              <p className="mb-2 rounded-xl bg-state-announced/10 px-3 py-2 text-xs text-state-announced ring-1 ring-inset ring-state-announced/35">{warning}</p>
            ) : null}
            {q.length < 2 ? (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">اكتب حرفين على الأقل — بياناتنا أولاً ثم مواقع نينوى.</p>
            ) : results.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">{loading ? "يبحث…" : "لا نتائج مطابقة ضمن نينوى."}</p>
            ) : (
              <ul className="space-y-1.5">
                {results.map((r, i) => {
                  const m = META[r.kind];
                  const Icon = m.Icon;
                  return (
                    <li key={`${r.kind}-${i}-${r.label}`}>
                      <button
                        type="button"
                        onClick={() => onGo(r)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border border-[rgba(148,175,209,0.28)] bg-[hsl(221_42%_12%/0.85)] px-3 py-2.5 text-right ring-1 ring-inset ring-white/[0.05] backdrop-blur-md transition active:scale-[0.99]",
                          i === sel && "border-[rgba(159,192,232,0.55)]",
                        )}
                      >
                        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl bg-white/5 ring-1 ring-inset ring-border/40", m.cls)}>
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-foreground">{r.label}</span>
                            <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] bg-white/5", m.cls)}>{m.label}</span>
                          </span>
                          {r.sublabel ? <span className="block truncate text-xs text-muted-foreground">{r.sublabel}</span> : <span className="block truncate text-[11px] text-muted-foreground/80">{navHint(r)}</span>}
                        </span>
                        {r.parcel_no ? (
                          <span className="shrink-0 rounded bg-secondary/50 px-1.5 py-0.5 text-[11px] tabular-nums text-secondary-foreground">{r.parcel_no}</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        {/* الحقل نفسه — في الأسفل دائماً (فوق الكيبورد عند التفعيل) */}
        <div style={{ paddingBottom: "var(--sab)" }} className="px-3 pb-2 pt-2">
          <div
            className={cn(
              "flex h-[52px] items-center gap-2.5 rounded-2xl border border-[rgba(148,175,209,0.45)] bg-[hsl(221_42%_10%/0.95)] px-4 ring-1 ring-inset ring-white/[0.06] shadow-[0_-6px_28px_-12px_rgba(0,0,0,0.85),0_0_24px_-10px_rgba(148,175,209,0.5)] backdrop-blur-xl",
              active && "shadow-[0_0_0_1px_rgba(159,192,232,0.6),0_0_26px_-6px_rgba(148,175,209,0.75)]",
            )}
          >
            <Search className="size-5 shrink-0 text-[#9fc0e8]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setActive(true)}
              onKeyDown={(e) =>
                handleKey(e, () => {
                  const r = results[sel];
                  if (r) onGo(r);
                })
              }
              enterKeyHint="search"
              placeholder="ابحث في نينوى…"
              className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/70"
            />
            {loading ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : null}
            {active ? (
              <button type="button" onClick={close} aria-label="إغلاق البحث" className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground ring-1 ring-inset ring-white/10 transition active:scale-90">
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
