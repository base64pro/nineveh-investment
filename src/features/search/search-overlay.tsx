"use client";

// م5.2 · لوحة البحث الفائق (§هـ.2.ج) — مدخل واحد قوي: بياناتنا أولاً ثم مواقع نينوى.
// النتائج حقيقية حصراً؛ النقر ينتقل لمصدرها (قطعة على الخريطة · قسم · موقع جغرافي).

import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Building2, Loader2, MapPin, Megaphone, Search, Shapes, X } from "lucide-react";
import { superSearch } from "./actions";
import type { SearchKind, SearchResult } from "./types";
import { onOpenSearch } from "./search-store";
import { requestFlyTo, requestFlyToCoords, requestOpenParcelDetail, type ParcelKind } from "@/features/map/lib/map-nav-store";
import { requestOpenCompany, requestOpenSection } from "@/features/shell/shell-store";

const KIND_META: Record<
  SearchKind,
  { label: string; Icon: typeof Search; cls: string; section?: string }
> = {
  opportunity: { label: "فرصة", Icon: Megaphone, cls: "text-state-announced", section: "opportunities" },
  license: { label: "رخصة", Icon: BadgeCheck, cls: "text-state-inprogress", section: "licenses" },
  company: { label: "شركة", Icon: Building2, cls: "text-primary", section: "companies" },
  assumed: { label: "مفترضة", Icon: Shapes, cls: "text-state-assumed", section: "opportunity-design" },
  place: { label: "موقع", Icon: MapPin, cls: "text-foreground/70" },
};

export function SearchOverlay() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(0);
  const reqId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // فتح من الهيدبار + اختصار Ctrl/⌘+K
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
    setQuery("");
    setResults([]);
    setSel(0);
    setLoading(false);
    return undefined;
  }, [open]);

  // بحث مُمَهَّل (debounce) — حارس reqId يمنع نتائج قديمة
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const id = ++reqId.current;
    const t = setTimeout(() => {
      void superSearch(q)
        .then((r) => {
          if (id === reqId.current) {
            setResults(r.results);
            setSel(0);
          }
        })
        .catch(() => {
          if (id === reqId.current) setResults([]);
        })
        .finally(() => {
          if (id === reqId.current) setLoading(false);
        });
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  function go(r: SearchResult): void {
    if (r.kind === "place" && r.lng !== null && r.lat !== null) {
      requestFlyToCoords({ lng: r.lng, lat: r.lat, label: r.label });
    } else if (r.hasGeom && r.mapRef) {
      requestFlyTo(r.mapRef); // مرسوم ← طيران للخريطة
    } else if (r.kind === "company" && r.entityId) {
      requestOpenSection("companies"); // §هـ.2.ج «فتح بياناته»: القسم + تفاصيل الشركة نفسها
      requestOpenCompany(r.entityId);
    } else if (r.entityId && (r.kind === "opportunity" || r.kind === "license" || r.kind === "assumed")) {
      requestOpenParcelDetail({ kind: r.kind as ParcelKind, id: r.entityId, readOnly: true }); // نافذة القطعة الموحّدة
    } else {
      const section = KIND_META[r.kind].section;
      if (section) requestOpenSection(section);
    }
    setOpen(false);
  }

  function onInputKey(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[sel];
      if (r) go(r);
    }
  }

  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    const r = results[sel];
    if (r) go(r);
  }

  const q = query.trim();
  const navHint = (r: SearchResult): string =>
    r.kind === "place" ? "↵ الموقع على الخريطة" : r.hasGeom ? "↵ القطعة على الخريطة" : r.entityId ? "↵ فتح السجلّ" : "↵ فتح القسم";

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
            <form onSubmit={onSubmit} className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3">
              <Search className="size-5 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
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
                          onClick={() => go(r)}
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
