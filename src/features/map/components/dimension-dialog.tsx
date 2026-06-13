"use client";

// م7.1 · حوار «رسم بأبعاد» — موقع منقور + أبعاد بالمتر (مستطيل عرض×طول · مربّع ضلع · دائرة نصف قطر)
// ← مضلّع مضبوط جغرافياً (حساب turf حتمي، لا تقدير).

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Circle, Ruler, Square, SquareDashed, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEscClose } from "@/components/ui/use-esc-close";
import { cn } from "@/lib/utils";

export type DimShape = "rectangle" | "square" | "circle";

const SHAPES: { id: DimShape; label: string; Icon: typeof Square }[] = [
  { id: "rectangle", label: "مستطيل", Icon: SquareDashed },
  { id: "square", label: "مربّع", Icon: Square },
  { id: "circle", label: "دائرة", Icon: Circle },
];

const INPUT = "w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring";

export function DimensionDialog({
  onSubmit,
  onClose,
}: {
  onSubmit: (shape: DimShape, a: number, b: number) => void;
  onClose: () => void;
}) {
  const [shape, setShape] = useState<DimShape>("rectangle");
  const [a, setA] = useState("100");
  const [b, setB] = useState("100");
  useEscClose(true, onClose);

  const na = Number(a);
  const nb = Number(b);
  const validA = Number.isFinite(na) && na >= 1 && na <= 50_000;
  const validB = shape !== "rectangle" || (Number.isFinite(nb) && nb >= 1 && nb <= 50_000);
  const valid = validA && validB;

  const aLabel = shape === "circle" ? "نصف القطر (متر)" : shape === "square" ? "طول الضلع (متر)" : "العرض (متر)";

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <motion.div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
        className="relative z-10 w-full max-w-xs rounded-2xl border border-border/80 bg-gradient-to-b from-card to-card/85 p-4 shadow-2xl shadow-[0_0_50px_-12px] shadow-state-assumed/40"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-bold"><Ruler className="size-4 text-state-assumed" /> رسم بأبعاد دقيقة</h3>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="grid size-8 place-items-center rounded-full text-muted-foreground ring-1 ring-inset ring-border/50 transition hover:bg-accent hover:text-foreground active:scale-90">
            <X className="size-4" />
          </button>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-1">
          {SHAPES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setShape(s.id)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition",
                shape === s.id ? "bg-state-assumed/20 text-state-assumed ring-1 ring-inset ring-state-assumed/50" : "bg-secondary/40 text-muted-foreground hover:bg-accent",
              )}
            >
              <s.Icon className="size-4" /> {s.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div className="space-y-1">
            <label className="block text-[11px] text-muted-foreground">{aLabel}</label>
            <input type="number" inputMode="decimal" min={1} max={50000} value={a} onChange={(e) => setA(e.target.value)} className={INPUT} />
          </div>
          {shape === "rectangle" ? (
            <div className="space-y-1">
              <label className="block text-[11px] text-muted-foreground">الطول (متر)</label>
              <input type="number" inputMode="decimal" min={1} max={50000} value={b} onChange={(e) => setB(e.target.value)} className={INPUT} />
            </div>
          ) : null}
        </div>

        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">يُرسَم الشكل مضبوطاً جغرافياً حول الموقع المنقور.</p>

        <div className="mt-3 flex gap-2">
          <Button type="button" disabled={!valid} onClick={() => onSubmit(shape, na, shape === "rectangle" ? nb : na)} className="flex-1">
            ارسم
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
