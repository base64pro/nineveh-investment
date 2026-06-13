"use client";

// م7.8 · عارض الصور الكبير (Lightbox): نافذة منبثقة فوق كل شيء — تكبير (عجلة/أزرار حتى ×6)،
// سحب للتحريك عند التكبير، تنقّل بين الصور، عدّاد، إغلاق بـEsc/نقر الخلفية.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import type { ParcelPhoto } from "./photo-lib";

const MIN_Z = 1;
const MAX_Z = 6;

export function PhotoLightbox({
  photos,
  startIndex,
  onClose,
}: {
  photos: ParcelPhoto[];
  startIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(Math.min(startIndex, Math.max(0, photos.length - 1)));
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);

  const reset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const go = useCallback(
    (dir: 1 | -1) => {
      if (photos.length < 2) return;
      setIdx((i) => (i + dir + photos.length) % photos.length);
      reset();
    },
    [photos.length, reset],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(1);
      else if (e.key === "ArrowRight") go(-1);
      else if (e.key === "+") setZoom((z) => Math.min(MAX_Z, z + 0.5));
      else if (e.key === "-") setZoom((z) => Math.max(MIN_Z, z - 0.5));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  const photo = photos[Math.min(idx, photos.length - 1)];
  if (!photo) return null;

  const CTRL =
    "grid size-10 place-items-center rounded-full bg-white/8 text-foreground ring-1 ring-inset ring-white/15 backdrop-blur transition hover:bg-white/15 active:scale-90";

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex flex-col bg-[hsl(221_45%_5%/0.94)] backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="عارض صور المشروع"
      onClick={onClose}
    >
      {/* شريط علوي: عدّاد + أدوات التكبير + إغلاق */}
      <div className="relative z-10 flex items-center gap-2 p-3" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="إغلاق" title="إغلاق (Esc)" className={CTRL}>
          <X className="size-5" />
        </button>
        <span className="rounded-full bg-white/8 px-3 py-1.5 text-xs font-bold tabular-nums text-foreground/90 ring-1 ring-inset ring-white/15">
          {formatNumber(idx + 1)} / {formatNumber(photos.length)}
        </span>
        <span className="flex-1" />
        <button type="button" onClick={() => setZoom((z) => Math.max(MIN_Z, z - 0.5))} aria-label="تصغير" title="تصغير (-)" className={CTRL}>
          <Minus className="size-4" />
        </button>
        <span className="w-14 text-center text-xs font-bold tabular-nums text-foreground/85">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((z) => Math.min(MAX_Z, z + 0.5))} aria-label="تكبير" title="تكبير (+)" className={CTRL}>
          <Plus className="size-4" />
        </button>
        <button type="button" onClick={reset} aria-label="إعادة الضبط" title="إعادة الضبط" className={CTRL}>
          <RotateCcw className="size-4" />
        </button>
      </div>

      {/* الصورة — عجلة للتكبير، سحب للتحريك عند التكبير */}
      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => {
          e.preventDefault();
          setZoom((z) => Math.min(MAX_Z, Math.max(MIN_Z, z - Math.sign(e.deltaY) * 0.4)));
        }}
        onPointerDown={(e) => {
          if (zoom <= 1) return;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          dragRef.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d) return;
          setPan({ x: d.px + (e.clientX - d.sx), y: d.py + (e.clientY - d.sy) });
        }}
        onPointerUp={() => (dragRef.current = null)}
        onPointerCancel={() => (dragRef.current = null)}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={photo.id}
            src={photo.url}
            alt={`صورة المشروع ${idx + 1}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            draggable={false}
            className={cn("absolute left-1/2 top-1/2 max-h-full max-w-full select-none object-contain", zoom > 1 ? "cursor-grab active:cursor-grabbing" : "")}
            style={{ transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})` }}
          />
        </AnimatePresence>

        {photos.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="السابقة"
              onClick={() => go(1)}
              className="absolute end-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white ring-1 ring-inset ring-white/15 backdrop-blur transition hover:bg-black/65 active:scale-90"
            >
              <ChevronRight className="size-5" />
            </button>
            <button
              type="button"
              aria-label="التالية"
              onClick={() => go(-1)}
              className="absolute start-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white ring-1 ring-inset ring-white/15 backdrop-blur transition hover:bg-black/65 active:scale-90"
            >
              <ChevronLeft className="size-5" />
            </button>
          </>
        ) : null}
      </div>

      {/* شريط مصغّرات سفلي */}
      {photos.length > 1 ? (
        <div className="relative z-10 flex justify-center gap-1.5 p-3" onClick={(e) => e.stopPropagation()}>
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              aria-label={`صورة ${i + 1}`}
              onClick={() => {
                setIdx(i);
                reset();
              }}
              className={cn(
                "h-12 w-16 overflow-hidden rounded-lg ring-2 transition",
                i === idx ? "ring-[#9fc0e8] shadow-[0_0_14px_-2px_rgba(159,192,232,0.8)]" : "opacity-55 ring-transparent hover:opacity-90",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </motion.div>,
    document.body,
  );
}
