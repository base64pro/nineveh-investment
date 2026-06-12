"use client";

// م7.1/7.6 · استوديو الرسم العائم — **قابل للطي**: زرّ رأس يفتح/يطوي الوضعيات (لا تعارض مع لوحة الطبقات فوقه).
// وضعيات: مضلّع · مستطيل · مربّع · دائرة · بأبعاد · تسمية · تحرير + مساحة حيّة توضيحية.

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Circle, Hexagon, MapPinned, MousePointerSquareDashed, PenTool, Ruler, Square, SquareDashed, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

export type DrawModeId = "off" | "polygon" | "rectangle" | "square" | "circle" | "dimensions" | "annotate" | "edit";

const MODES: { id: Exclude<DrawModeId, "off">; label: string; hint: string; Icon: LucideIcon }[] = [
  { id: "polygon", label: "مضلّع", hint: "نقاط حرّة — أغلق على الأولى", Icon: Hexagon },
  { id: "rectangle", label: "مستطيل", hint: "نقرة ثم اسحب", Icon: SquareDashed },
  { id: "square", label: "مربّع", hint: "ارسم مستطيلاً — يُضبَط مربّعاً تلقائياً", Icon: Square },
  { id: "circle", label: "دائرة", hint: "المركز ثم اسحب نصف القطر", Icon: Circle },
  { id: "dimensions", label: "بأبعاد", hint: "انقر الموقع ثم أدخل الأبعاد بالمتر", Icon: Ruler },
  { id: "annotate", label: "تسمية", hint: "سمِّ معلماً/مبنىً/منطقةً — يظهر بالخريطة والبحث", Icon: MapPinned },
  { id: "edit", label: "تحرير", hint: "انقر قطعة مرسومة لتعديل حدودها", Icon: MousePointerSquareDashed },
];

const GLASS = "border border-[rgba(148,175,209,0.45)] bg-[hsl(220_36%_15%_/_0.92)] shadow-[0_8px_28px_-10px_rgba(0,0,0,0.7),0_0_22px_-8px_rgba(148,175,209,0.5)] backdrop-blur";

export function DrawDock({
  open,
  onToggle,
  mode,
  onMode,
  liveAreaM2,
  onCancel,
}: {
  open: boolean;
  onToggle: () => void;
  mode: DrawModeId;
  onMode: (m: Exclude<DrawModeId, "off">) => void;
  liveAreaM2: number | null;
  onCancel: () => void;
}) {
  const active = mode !== "off";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className={cn("flex flex-col gap-0.5 rounded-2xl p-1.5", GLASS)}>
        {/* رأس الاستوديو: فتح/طيّ — يتوهّج بنفسجياً عند وضعية نشطة وهو مطويّ */}
        <button
          type="button"
          onClick={onToggle}
          title={open ? "طيّ استوديو الرسم" : "استوديو الرسم"}
          aria-label="استوديو الرسم"
          aria-expanded={open}
          className={cn(
            "relative flex size-11 flex-col items-center justify-center gap-0.5 rounded-xl transition active:scale-95",
            active && !open
              ? "bg-state-assumed/25 text-state-assumed shadow-[0_0_16px_-4px_rgba(139,111,176,0.9)] ring-1 ring-inset ring-state-assumed/60"
              : open
                ? "bg-white/8 text-foreground"
                : "text-foreground/80 hover:bg-white/8 hover:text-foreground",
          )}
        >
          <PenTool style={{ width: 17, height: 17 }} />
          <ChevronDown style={{ width: 11, height: 11 }} className={cn("transition-transform", open && "rotate-180")} />
          {active && !open ? (
            <motion.span
              aria-hidden
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="absolute end-1 top-1 size-1.5 rounded-full bg-state-assumed shadow-[0_0_7px_1px] shadow-state-assumed"
            />
          ) : null}
        </button>

        {/* الوضعيات — تنسدل بسلاسة عند الفتح */}
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              key="modes"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex flex-col gap-0.5 overflow-hidden"
            >
              {MODES.map((m) => {
                const isActive = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onMode(m.id)}
                    title={`${m.label} — ${m.hint}`}
                    aria-label={m.label}
                    className={cn(
                      "flex size-11 flex-col items-center justify-center gap-0.5 rounded-xl transition active:scale-95",
                      isActive
                        ? "bg-state-assumed/25 text-state-assumed shadow-[0_0_16px_-4px_rgba(139,111,176,0.9)] ring-1 ring-inset ring-state-assumed/60"
                        : "text-foreground/80 hover:bg-white/8 hover:text-foreground",
                    )}
                  >
                    <m.Icon style={{ width: 18, height: 18 }} />
                    <span className="text-[8px] leading-none">{m.label}</span>
                  </button>
                );
              })}
              {active ? (
                <button
                  type="button"
                  onClick={onCancel}
                  title="إنهاء/إلغاء الرسم (Esc)"
                  aria-label="إلغاء الرسم"
                  className="mt-0.5 flex size-11 items-center justify-center rounded-xl border-t border-border/40 text-state-withdrawn transition hover:bg-state-withdrawn/15 active:scale-95"
                >
                  <X style={{ width: 18, height: 18 }} />
                </button>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* المساحة الحيّة (توضيحية) — تظهر أثناء الرسم ولو كان الاستوديو مطوياً */}
      <AnimatePresence>
        {liveAreaM2 !== null && liveAreaM2 > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={cn("rounded-xl px-2.5 py-1.5 text-[11px] tabular-nums", GLASS)}
          >
            <span className="font-bold text-state-assumed">{formatNumber(Math.round(liveAreaM2))}</span>
            <span className="text-muted-foreground"> م² (توضيحية)</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
