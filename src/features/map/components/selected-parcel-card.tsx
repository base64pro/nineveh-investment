"use client";

// م7.6 · شارة القطعة (Callout هولوكرامي): تنبثق **بجانب** القطعة المنقورة بخط رشيق متوهّج يربطها بها،
// وتتبعها حيّاً مع الزوم والتنقّل (إسقاط شاشة) — الخريطة تبقى ظاهرة بلا تعتيم (§هـ.3 هولوكرامي مودرن).

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, ChevronLeft, Eye, ImageOff, PencilRuler, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatArea, orNA } from "@/lib/display";
import { sectorLabel } from "@/lib/sectors";
import { StateBadge } from "@/features/parcels/state-badge";
import { useParcelPhotos } from "@/features/parcels/photos/photo-lib";
import type { ParcelKind } from "../lib/map-nav-store";
import type { ParcelProps } from "../lib/use-map-parcels";
import type { ParcelState } from "@/types/entities";

const STATE_HEX: Record<string, string> = {
  announced: "#C7A24E",
  "in-progress": "#5775A8",
  completed: "#5E977A",
  withdrawn: "#B5616A",
  assumed: "#8B6FB0",
};

const CARD_W = 272;
const CARD_H = 308; // تقدير للحجب داخل حدود الخريطة
const GAP = 46; // مسافة الخط بين القطعة والبطاقة

export interface SelectedEntityInfo {
  sector: string | null;
  area: number | null;
  investor: string | null;
}

function Readout({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[8.5px] tracking-wide text-[#9fc0e8]/70">{label}</div>
      <div className={cn("truncate text-xs font-bold text-foreground/95", mono && "tabular-nums")} title={value}>
        {value}
      </div>
    </div>
  );
}

export function SelectedParcelCard({
  props,
  info,
  anchor,
  container,
  onView,
  onEditGeometry,
  onClose,
}: {
  props: ParcelProps;
  info: SelectedEntityInfo;
  anchor: { x: number; y: number };
  container: { w: number; h: number };
  onView: () => void;
  onEditGeometry: () => void;
  onClose: () => void;
}) {
  const kind = props.kind as ParcelKind;
  const { data: photos = [] } = useParcelPhotos(kind, props.entity_id);
  const [idx, setIdx] = useState(0);
  const safeIdx = photos.length ? Math.min(idx, photos.length - 1) : 0;
  const accent = STATE_HEX[props.state] ?? "#94afd1";

  // البطاقة على الجهة الأرحب من نقطة القطعة + حجب داخل الخريطة
  const flip = anchor.x > container.w / 2; // القطعة يميناً ← البطاقة يساراً
  const cardX = flip ? Math.max(8, anchor.x - GAP - CARD_W) : Math.min(container.w - CARD_W - 8, anchor.x + GAP);
  const cardY = Math.min(Math.max(anchor.y - CARD_H / 2, 8), Math.max(8, container.h - CARD_H - 8));
  const attachX = flip ? cardX + CARD_W : cardX; // حافة البطاقة المواجهة للقطعة
  const attachY = cardY + 84;
  const elbowX = (anchor.x + attachX) / 2;

  return (
    <>
      {/* الخط الرشيق + نبضة المرساة — يتبعان القطعة حيّاً */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 z-[14] size-full overflow-visible">
        <motion.path
          d={`M ${anchor.x} ${anchor.y} L ${elbowX} ${anchor.y} L ${elbowX} ${attachY} L ${attachX} ${attachY}`}
          fill="none"
          stroke={accent}
          strokeWidth="1.6"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.95 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 5px ${accent})` }}
        />
        <circle cx={anchor.x} cy={anchor.y} r={3.5} fill={accent} style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />
        <motion.circle
          cx={anchor.x}
          cy={anchor.y}
          r={5}
          fill="none"
          stroke={accent}
          strokeWidth="1.4"
          initial={{ scale: 0.6, opacity: 0.9 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
          style={{ transformOrigin: `${anchor.x}px ${anchor.y}px` }}
        />
      </svg>

      {/* الشارة الهولوكرامية الزجاجية */}
      <motion.div
        initial={{ opacity: 0, scale: 0.82, x: flip ? 14 : -14 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.86, x: flip ? 10 : -10 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        className="absolute z-[15] rounded-2xl p-px shadow-[0_18px_50px_-16px_rgba(0,0,0,0.8),0_0_34px_-10px_rgba(148,175,209,0.5)]"
        style={{ left: cardX, top: cardY, width: CARD_W, background: `linear-gradient(135deg, ${accent}b3, rgba(148,175,209,0.4), rgba(139,111,176,0.45))` }}
      >
        <div className="relative overflow-hidden rounded-[calc(1rem-1px)] bg-[hsl(221_42%_10%_/_0.9)] backdrop-blur-xl">
          {/* خط مسح ضوئي خفيف */}
          <motion.span
            aria-hidden
            initial={{ y: "-20%" }}
            animate={{ y: "120%" }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-transparent via-[rgba(148,175,209,0.08)] to-transparent"
          />

          {/* رأس الشارة */}
          <div className="flex items-center gap-1.5 px-3 pb-1.5 pt-2.5">
            <motion.span
              aria-hidden
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: accent, boxShadow: `0 0 7px 1px ${accent}` }}
            />
            <h4 className="min-w-0 flex-1 truncate text-[12.5px] font-bold leading-snug" title={props.label}>{orNA(props.label)}</h4>
            <StateBadge state={props.state as ParcelState} />
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              title="إغلاق"
              className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground ring-1 ring-inset ring-border/50 transition hover:bg-accent hover:text-foreground active:scale-90"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <span aria-hidden className="block h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}cc, transparent)` }} />

          {/* الصور */}
          <div className="relative h-24 w-full bg-[rgba(148,175,209,0.06)]">
            <AnimatePresence mode="wait">
              {photos.length ? (
                <motion.img
                  key={photos[safeIdx]!.id}
                  src={photos[safeIdx]!.url}
                  alt={`صورة المشروع ${safeIdx + 1}`}
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="size-full object-cover"
                />
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
                  <ImageOff className="size-5 opacity-50" />
                  <span className="text-[9px]">لا صور بعد</span>
                </motion.div>
              )}
            </AnimatePresence>
            {photos.length > 1 ? (
              <>
                <button type="button" aria-label="السابقة" onClick={() => setIdx((i) => (i - 1 + photos.length) % photos.length)} className="absolute end-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65 active:scale-90">
                  <ChevronRight className="size-3.5" />
                </button>
                <button type="button" aria-label="التالية" onClick={() => setIdx((i) => (i + 1) % photos.length)} className="absolute start-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65 active:scale-90">
                  <ChevronLeft className="size-3.5" />
                </button>
                <div className="absolute inset-x-0 bottom-1 flex justify-center gap-1">
                  {photos.map((p, i) => (
                    <button key={p.id} type="button" aria-label={`صورة ${i + 1}`} onClick={() => setIdx(i)} className={cn("h-1 rounded-full transition-all", i === safeIdx ? "w-4 bg-white" : "w-1 bg-white/45")} />
                  ))}
                </div>
              </>
            ) : null}
          </div>

          {/* قراءات مكثّفة */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-3 py-2">
            <Readout label="القطاع" value={sectorLabel(info.sector)} />
            <Readout label="المساحة" value={formatArea(info.area)} mono />
            <Readout label="رقم القطعة" value={orNA(props.parcel_no)} mono />
            <Readout label="الحي" value={orNA(props.neighborhood)} />
          </div>

          {/* الأزرار */}
          <div className="flex gap-1.5 px-3 pb-3">
            <button
              type="button"
              onClick={onView}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary/15 py-2 text-[11px] font-bold text-primary ring-1 ring-inset ring-primary/40 transition hover:bg-primary/25 hover:shadow-[0_0_18px_-6px_rgba(148,175,209,0.9)] active:scale-95"
            >
              <Eye className="size-3.5" /> عرض
            </button>
            <button
              type="button"
              onClick={onEditGeometry}
              title="تعديل حدود الرسم"
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-state-assumed/15 py-2 text-[11px] font-bold text-state-assumed ring-1 ring-inset ring-state-assumed/40 transition hover:bg-state-assumed/25 active:scale-95"
            >
              <PencilRuler className="size-3.5" /> الحدود
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
