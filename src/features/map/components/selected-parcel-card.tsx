"use client";

// م7.4+ · البطاقة الهولوكرامية للقطعة المحدَّدة: تنبثق من الخريطة إلى وسط الشاشة (HUD مراكز بيانات مستقبلي):
// إطار متدرّج متوهّج · أقواس زوايا · خط مسح ضوئي · معرض صور · قراءات بيانات — فوق كل الواجهة (§هـ.3 هولوكرامي).

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, ChevronLeft, Eye, ImageOff, PencilRuler, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEscClose } from "@/components/ui/use-esc-close";
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

export interface SelectedEntityInfo {
  sector: string | null;
  area: number | null;
  investor: string | null;
}

/** قوس زاوية HUD (ذهبي خافت). */
function Corner({ pos }: { pos: "ts" | "te" | "bs" | "be" }) {
  const map = {
    ts: "top-2 start-2 border-t-2 border-s-2 rounded-ts-md",
    te: "top-2 end-2 border-t-2 border-e-2 rounded-te-md",
    bs: "bottom-2 start-2 border-b-2 border-s-2 rounded-bs-md",
    be: "bottom-2 end-2 border-b-2 border-e-2 rounded-be-md",
  } as const;
  return <span aria-hidden className={cn("pointer-events-none absolute size-5 border-[#C7A24E]/70", map[pos])} />;
}

function Readout({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] tracking-wide text-[#9fc0e8]/70">{label}</div>
      <div className={cn("truncate text-[13px] font-bold text-foreground/95", mono && "tabular-nums")} title={value}>
        {value}
      </div>
    </div>
  );
}

export function SelectedParcelCard({
  props,
  info,
  onView,
  onEditGeometry,
  onClose,
}: {
  props: ParcelProps;
  info: SelectedEntityInfo;
  onView: () => void;
  onEditGeometry: () => void;
  onClose: () => void;
}) {
  const kind = props.kind as ParcelKind;
  const { data: photos = [] } = useParcelPhotos(kind, props.entity_id);
  const [idx, setIdx] = useState(0);
  const safeIdx = photos.length ? Math.min(idx, photos.length - 1) : 0;
  const accent = STATE_HEX[props.state] ?? "#94afd1";
  useEscClose(true, onClose);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
      style={{ perspective: 1300 }}
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[radial-gradient(circle_at_center,rgba(8,13,24,0.25),rgba(8,13,24,0.6))] p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="بطاقة القطعة"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.55, y: 90, rotateX: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
        exit={{ opacity: 0, scale: 0.6, y: 70, rotateX: 12 }}
        transition={{ type: "spring", stiffness: 230, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
        className="w-[min(92vw,440px)] rounded-3xl p-px shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85),0_0_60px_-12px_rgba(148,175,209,0.55)]"
        style={{ background: `linear-gradient(135deg, ${accent}99, rgba(148,175,209,0.45), rgba(139,111,176,0.5))` }}
      >
        <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-[hsl(221_42%_9%_/_0.93)] backdrop-blur-2xl">
          {/* خط المسح الضوئي (HUD) */}
          <motion.span
            aria-hidden
            initial={{ y: "-15%" }}
            animate={{ y: "115%" }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-transparent via-[rgba(148,175,209,0.09)] to-transparent"
          />
          <Corner pos="ts" /><Corner pos="te" /><Corner pos="bs" /><Corner pos="be" />

          {/* رأس HUD */}
          <div className="relative flex items-start gap-2 px-5 pb-2.5 pt-4">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-1.5 text-[9px] tracking-[0.18em] text-[#9fc0e8]/80">
                <motion.span
                  aria-hidden
                  animate={{ opacity: [1, 0.35, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  className="size-1.5 rounded-full"
                  style={{ background: accent, boxShadow: `0 0 8px 1px ${accent}` }}
                />
                بطاقة قطعة · مباشر
              </div>
              <h4 className="truncate text-base font-bold leading-snug" title={props.label}>{orNA(props.label)}</h4>
            </div>
            <StateBadge state={props.state as ParcelState} />
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              title="إغلاق (Esc)"
              className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground ring-1 ring-inset ring-border/50 transition hover:bg-accent hover:text-foreground active:scale-90"
            >
              <X className="size-4" />
            </button>
          </div>
          <span aria-hidden className="block h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}cc, transparent)` }} />

          {/* معرض الصور */}
          <div className="relative h-44 w-full bg-[rgba(148,175,209,0.06)] sm:h-48">
            <AnimatePresence mode="wait">
              {photos.length ? (
                <motion.img
                  key={photos[safeIdx]!.id}
                  src={photos[safeIdx]!.url}
                  alt={`صورة المشروع ${safeIdx + 1}`}
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.28 }}
                  className="size-full object-cover"
                />
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex size-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
                  <ImageOff className="size-7 opacity-50" />
                  <span className="text-[10px]">لا صور بعد — أضفها من نافذة القطعة</span>
                </motion.div>
              )}
            </AnimatePresence>
            {photos.length > 1 ? (
              <>
                <button type="button" aria-label="السابقة" onClick={() => setIdx((i) => (i - 1 + photos.length) % photos.length)} className="absolute end-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65 active:scale-90">
                  <ChevronRight className="size-4" />
                </button>
                <button type="button" aria-label="التالية" onClick={() => setIdx((i) => (i + 1) % photos.length)} className="absolute start-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65 active:scale-90">
                  <ChevronLeft className="size-4" />
                </button>
                <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1">
                  {photos.map((p, i) => (
                    <button key={p.id} type="button" aria-label={`صورة ${i + 1}`} onClick={() => setIdx(i)} className={cn("h-1.5 rounded-full transition-all", i === safeIdx ? "w-5 bg-white" : "w-1.5 bg-white/45")} />
                  ))}
                </div>
              </>
            ) : null}
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[hsl(221_42%_9%_/_0.9)] to-transparent" />
          </div>

          {/* قراءات البيانات (HUD) */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-5 py-3.5 sm:grid-cols-3">
            <Readout label="القطاع" value={sectorLabel(info.sector)} />
            <Readout label="المساحة" value={formatArea(info.area)} mono />
            <Readout label="رقم القطعة" value={orNA(props.parcel_no)} mono />
            <Readout label="الحي" value={orNA(props.neighborhood)} />
            <Readout label="القضاء" value={orNA(props.district)} />
            {info.investor ? <Readout label="المستثمر" value={info.investor} /> : null}
          </div>

          {/* الأزرار */}
          <div className="flex gap-2 px-5 pb-5">
            <button
              type="button"
              onClick={onView}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary/15 py-2.5 text-xs font-bold text-primary ring-1 ring-inset ring-primary/40 transition hover:bg-primary/25 hover:shadow-[0_0_22px_-6px_rgba(148,175,209,0.9)] active:scale-95"
            >
              <Eye className="size-4" /> عرض
            </button>
            <button
              type="button"
              onClick={onEditGeometry}
              title="تعديل حدود الرسم"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-state-assumed/15 py-2.5 text-xs font-bold text-state-assumed ring-1 ring-inset ring-state-assumed/40 transition hover:bg-state-assumed/25 hover:shadow-[0_0_22px_-6px_rgba(139,111,176,0.9)] active:scale-95"
            >
              <PencilRuler className="size-4" /> الحدود
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
