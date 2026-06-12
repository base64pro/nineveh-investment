"use client";

// م7.8 · نافذة إشارة القطعة (عرض/الموقع) — أعيد بناؤها كبطاقة هولوكرامية مصغّرة بنفس سلوك شارة القطعة:
// خط ربط رشيق متوهّج من الإشارة + زجاج متدرّج، تتبع الإشارة حيّاً مع الزوم/التنقّل،
// وتُرسم فوق كل شيء (z فوق طبقات deck) فلا تختفي خلف الإشارات المتجمّعة.

import { motion } from "framer-motion";
import { Eye, Navigation, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { orNA } from "@/lib/display";

const CARD_W = 216;
const CARD_H = 132;
const GAP = 38;

export function MarkerCallout({
  label,
  anchor,
  container,
  onView,
  onLocate,
  onClose,
}: {
  label: string | null;
  anchor: { x: number; y: number };
  container: { w: number; h: number };
  onView: () => void;
  onLocate: () => void;
  onClose: () => void;
}) {
  const flip = anchor.x > container.w / 2; // الإشارة يميناً ← البطاقة يساراً
  const cardX = flip ? Math.max(8, anchor.x - GAP - CARD_W) : Math.min(container.w - CARD_W - 8, anchor.x + GAP);
  const cardY = Math.min(Math.max(anchor.y - CARD_H / 2, 8), Math.max(8, container.h - CARD_H - 8));
  const attachX = flip ? cardX + CARD_W : cardX;
  const attachY = cardY + CARD_H / 2;
  const elbowX = (anchor.x + attachX) / 2;
  const accent = "#9fc0e8";

  const BTN = "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-bold ring-1 ring-inset transition active:scale-95";

  return (
    <>
      {/* خط الربط + نبضة المرساة — فوق إشارات الخريطة كلها */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 z-[16] size-full overflow-visible">
        <motion.path
          d={`M ${anchor.x} ${anchor.y} L ${elbowX} ${anchor.y} L ${elbowX} ${attachY} L ${attachX} ${attachY}`}
          fill="none"
          stroke={accent}
          strokeWidth="1.4"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.9 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 4px ${accent})` }}
        />
        <circle cx={anchor.x} cy={anchor.y} r={3} fill={accent} style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />
        <motion.circle
          cx={anchor.x}
          cy={anchor.y}
          r={4.5}
          fill="none"
          stroke={accent}
          strokeWidth="1.2"
          initial={{ scale: 0.6, opacity: 0.9 }}
          animate={{ scale: 2.3, opacity: 0 }}
          transition={{ duration: 1.7, repeat: Infinity, ease: "easeOut" }}
          style={{ transformOrigin: `${anchor.x}px ${anchor.y}px` }}
        />
      </svg>

      <motion.div
        initial={{ opacity: 0, scale: 0.84, x: flip ? 12 : -12 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.88, x: flip ? 8 : -8 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="absolute z-[17] rounded-2xl p-px shadow-[0_14px_40px_-14px_rgba(0,0,0,0.85),0_0_26px_-8px_rgba(148,175,209,0.55)]"
        style={{ left: cardX, top: cardY, width: CARD_W, background: "linear-gradient(140deg, rgba(159,192,232,0.7), rgba(148,175,209,0.35), rgba(139,111,176,0.4))" }}
      >
        <div className="relative overflow-hidden rounded-[calc(1rem-1px)] bg-[hsl(221_42%_10%/0.92)] backdrop-blur-xl">
          {/* خط مسح خفيف */}
          <motion.span
            aria-hidden
            initial={{ y: "-30%" }}
            animate={{ y: "140%" }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-transparent via-[rgba(148,175,209,0.09)] to-transparent"
          />

          {/* الرأس: نبضة + العنوان + إغلاق */}
          <div className="flex items-center gap-1.5 px-2.5 pb-1.5 pt-2">
            <motion.span
              aria-hidden
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="size-1.5 shrink-0 rounded-full bg-[#9fc0e8] shadow-[0_0_7px_1px_rgba(159,192,232,0.9)]"
            />
            <h4 className="min-w-0 flex-1 truncate text-center text-[12px] font-bold leading-snug" title={label ?? ""}>
              {orNA(label)}
            </h4>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              title="إغلاق"
              className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground ring-1 ring-inset ring-border/50 transition hover:bg-accent hover:text-foreground active:scale-90"
            >
              <X className="size-3" />
            </button>
          </div>
          <span aria-hidden className="block h-px bg-gradient-to-r from-transparent via-[rgba(159,192,232,0.7)] to-transparent" />

          {/* الأزرار */}
          <div className="flex flex-col gap-1.5 p-2.5">
            <button type="button" onClick={onView} className={cn(BTN, "bg-primary/15 text-primary ring-primary/40 hover:bg-primary/25 hover:shadow-[0_0_16px_-6px_rgba(148,175,209,0.9)]")}>
              <Eye className="size-3.5" /> عرض
            </button>
            <button type="button" onClick={onLocate} className={cn(BTN, "bg-white/6 text-foreground ring-border/60 hover:bg-white/12")}>
              <Navigation className="size-3.5" /> الموقع
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
