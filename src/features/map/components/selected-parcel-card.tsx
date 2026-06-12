"use client";

// م7.4 · بطاقة القطعة المحدَّدة (زجاجية عائمة §هـ.4): معرض صور المشروع + البيانات المفتاحية + أزرار سريعة.
// تظهر عند تحديد قطعة على الخريطة — الناقص «غير متوفّر» (§ح).

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, ChevronLeft, Eye, ImageOff, Pencil, PencilRuler, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatArea, orNA } from "@/lib/display";
import { sectorLabel } from "@/lib/sectors";
import { StateBadge } from "@/features/parcels/state-badge";
import { useParcelPhotos } from "@/features/parcels/photos/photo-lib";
import type { ParcelKind } from "../lib/map-nav-store";
import type { ParcelProps } from "../lib/use-map-parcels";
import type { ParcelState } from "@/types/entities";

const GLASS = "border border-[rgba(148,175,209,0.45)] bg-[hsl(220_36%_15%_/_0.94)] shadow-[0_14px_44px_-14px_rgba(0,0,0,0.8),0_0_28px_-8px_rgba(148,175,209,0.55)] backdrop-blur";

export interface SelectedEntityInfo {
  sector: string | null;
  area: number | null;
  investor: string | null;
}

export function SelectedParcelCard({
  props,
  info,
  onView,
  onEdit,
  onEditGeometry,
  onClose,
}: {
  props: ParcelProps;
  info: SelectedEntityInfo;
  onView: () => void;
  onEdit: () => void;
  onEditGeometry: () => void;
  onClose: () => void;
}) {
  const kind = props.kind as ParcelKind;
  const { data: photos = [] } = useParcelPhotos(kind, props.entity_id);
  const [idx, setIdx] = useState(0);
  const safeIdx = photos.length ? Math.min(idx, photos.length - 1) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -24, y: "-50%", scale: 0.97 }}
      animate={{ opacity: 1, x: 0, y: "-50%", scale: 1 }}
      exit={{ opacity: 0, x: -24, y: "-50%", scale: 0.97 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      // جانب الخريطة (حافتها اليسرى) · وسط الشاشة عمودياً (y عبر framer — يملك transform) · فوق الواجهة المحيطة
      className={cn("fixed end-4 top-1/2 z-[95] w-72 overflow-hidden rounded-2xl sm:w-80", GLASS)}
    >
      {/* معرض الصور */}
      <div className="relative h-36 w-full bg-[rgba(148,175,209,0.07)] sm:h-40">
        <AnimatePresence mode="wait">
          {photos.length ? (
            <motion.img
              key={photos[safeIdx]!.id}
              src={photos[safeIdx]!.url}
              alt={`صورة المشروع ${safeIdx + 1}`}
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="size-full object-cover"
            />
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
              <ImageOff className="size-6 opacity-60" />
              <span className="text-[10px]">لا صور بعد — أضفها من نافذة القطعة</span>
            </motion.div>
          )}
        </AnimatePresence>
        {photos.length > 1 ? (
          <>
            <button type="button" aria-label="السابقة" onClick={() => setIdx((i) => (i - 1 + photos.length) % photos.length)} className="absolute end-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65 active:scale-90">
              <ChevronRight className="size-4" />
            </button>
            <button type="button" aria-label="التالية" onClick={() => setIdx((i) => (i + 1) % photos.length)} className="absolute start-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65 active:scale-90">
              <ChevronLeft className="size-4" />
            </button>
            <div className="absolute inset-x-0 bottom-1.5 flex justify-center gap-1">
              {photos.map((p, i) => (
                <button key={p.id} type="button" aria-label={`صورة ${i + 1}`} onClick={() => setIdx(i)} className={cn("h-1.5 rounded-full transition-all", i === safeIdx ? "w-4 bg-white" : "w-1.5 bg-white/50")} />
              ))}
            </div>
          </>
        ) : null}
        <button type="button" onClick={onClose} aria-label="إغلاق" title="إغلاق" className="absolute end-1.5 top-1.5 grid size-8 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65 active:scale-90">
          <X className="size-4" />
        </button>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[hsl(220_36%_12%_/_0.85)] to-transparent" />
      </div>

      {/* البيانات المفتاحية */}
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="min-w-0 flex-1 truncate text-sm font-bold leading-snug" title={props.label}>{orNA(props.label)}</h4>
          <StateBadge state={props.state as ParcelState} />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>القطاع: <b className="text-foreground/90">{sectorLabel(info.sector)}</b></span>
          <span>المساحة: <b className="tabular-nums text-foreground/90">{formatArea(info.area)}</b></span>
          {props.parcel_no ? <span>قطعة: <b className="tabular-nums text-foreground/90">{props.parcel_no}</b></span> : null}
          {props.neighborhood ? <span>حي: <b className="text-foreground/90">{props.neighborhood}</b></span> : null}
          {info.investor ? <span className="w-full truncate">المستثمر: <b className="text-foreground/90">{info.investor}</b></span> : null}
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <button type="button" onClick={onView} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary/15 py-2 text-[11px] font-bold text-primary ring-1 ring-inset ring-primary/40 transition hover:bg-primary/25 active:scale-95">
            <Eye className="size-3.5" /> عرض
          </button>
          <button type="button" onClick={onEdit} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-secondary/50 py-2 text-[11px] font-bold ring-1 ring-inset ring-border/50 transition hover:bg-accent active:scale-95">
            <Pencil className="size-3.5" /> تعديل
          </button>
          <button type="button" onClick={onEditGeometry} title="تعديل حدود الرسم" className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-state-assumed/15 py-2 text-[11px] font-bold text-state-assumed ring-1 ring-inset ring-state-assumed/40 transition hover:bg-state-assumed/25 active:scale-95">
            <PencilRuler className="size-3.5" /> الحدود
          </button>
        </div>
      </div>
    </motion.div>
  );
}
