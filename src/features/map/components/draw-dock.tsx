"use client";

// م7.1 · شريط الرسم العائم (استوديو الرسم §هـ.4) — وضعيات: مضلّع · مستطيل · مربّع · دائرة · بأبعاد · تحرير.
// زجاجي موحّد ملائم للمس · مساحة حيّة توضيحية أثناء الرسم (المساحة الرسمية من البيانات — قرار سابق).

import { AnimatePresence, motion } from "framer-motion";
import { Check, Circle, Hexagon, MousePointerSquareDashed, Ruler, Square, SquareDashed, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

export type DrawModeId = "off" | "polygon" | "rectangle" | "square" | "circle" | "dimensions" | "edit";

const MODES: { id: Exclude<DrawModeId, "off">; label: string; hint: string; Icon: LucideIcon }[] = [
  { id: "polygon", label: "مضلّع", hint: "نقاط حرّة — أغلق على الأولى", Icon: Hexagon },
  { id: "rectangle", label: "مستطيل", hint: "نقرة ثم اسحب", Icon: SquareDashed },
  { id: "square", label: "مربّع", hint: "ارسم مستطيلاً — يُضبَط مربّعاً تلقائياً", Icon: Square },
  { id: "circle", label: "دائرة", hint: "المركز ثم اسحب نصف القطر", Icon: Circle },
  { id: "dimensions", label: "بأبعاد", hint: "انقر الموقع ثم أدخل الأبعاد بالمتر", Icon: Ruler },
  { id: "edit", label: "تحرير", hint: "انقر قطعة مرسومة لتعديل حدودها", Icon: MousePointerSquareDashed },
];

const GLASS = "border border-[rgba(148,175,209,0.45)] bg-[hsl(220_36%_15%_/_0.92)] shadow-[0_8px_28px_-10px_rgba(0,0,0,0.7),0_0_22px_-8px_rgba(148,175,209,0.5)] backdrop-blur";

export function DrawDock({
  mode,
  onMode,
  liveAreaM2,
  editingLabel,
  savingEdit,
  onSaveEdit,
  onCancel,
}: {
  mode: DrawModeId;
  onMode: (m: Exclude<DrawModeId, "off">) => void;
  liveAreaM2: number | null;
  editingLabel: string | null;
  savingEdit: boolean;
  onSaveEdit: () => void;
  onCancel: () => void;
}) {
  const active = mode !== "off";
  const editingActive = editingLabel !== null;

  return (
    <div className="absolute start-3 top-16 z-10 flex flex-col items-start gap-2">
      <div className={cn("flex flex-col gap-0.5 rounded-2xl p-1.5", GLASS)}>
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
              <m.Icon className="size-4.5" style={{ width: 18, height: 18 }} />
              <span className="text-[8px] leading-none">{m.label}</span>
            </button>
          );
        })}
        <AnimatePresence>
          {active ? (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              type="button"
              onClick={onCancel}
              title="إنهاء/إلغاء الرسم (Esc)"
              aria-label="إلغاء الرسم"
              className="mt-0.5 flex size-11 items-center justify-center rounded-xl border-t border-border/40 text-state-withdrawn transition hover:bg-state-withdrawn/15 active:scale-95"
            >
              <X style={{ width: 18, height: 18 }} />
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>

      {/* المساحة الحيّة (توضيحية) */}
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

      {/* شريط حفظ التحرير */}
      <AnimatePresence>
        {editingActive ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={cn("flex items-center gap-1.5 rounded-xl p-1.5", GLASS)}
          >
            <span className="max-w-36 truncate ps-1 text-[10px] text-muted-foreground" title={editingLabel ?? ""}>
              تحرير: <b className="text-foreground/90">{editingLabel}</b>
            </span>
            <button
              type="button"
              disabled={savingEdit}
              onClick={onSaveEdit}
              className="flex h-9 items-center gap-1 rounded-lg bg-state-completed/20 px-2.5 text-[11px] font-bold text-state-completed ring-1 ring-inset ring-state-completed/50 transition hover:bg-state-completed/30 active:scale-95 disabled:opacity-50"
            >
              <Check className="size-3.5" /> {savingEdit ? "يحفظ…" : "حفظ الحدود"}
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
