"use client";

// م7.3 · حوارا الطبقة المحرَّرة: إنشاء تسمية (نقطة هنا / منطقة تُرسَم) + تحرير/حذف تسمية قائمة.

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { MapPinned, Tag, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combo } from "@/components/ui/combo";
import { useEscClose } from "@/components/ui/use-esc-close";
import { cn } from "@/lib/utils";
import { ELEMENT_TYPES } from "../lib/annotation-types";

const INPUT = "w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const TYPE_OPTIONS = ELEMENT_TYPES.map((t) => ({ value: t.value, label: t.label }));

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEscClose(true, onClose);
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <motion.div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
        className="relative z-10 w-full max-w-xs rounded-2xl border border-border/80 bg-gradient-to-b from-card to-card/85 p-4 shadow-2xl shadow-[0_0_50px_-12px] shadow-primary/40"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-bold"><MapPinned className="size-4 text-primary/80" /> {title}</h3>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="grid size-8 place-items-center rounded-full text-muted-foreground ring-1 ring-inset ring-border/50 transition hover:bg-accent hover:text-foreground active:scale-90">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </div>,
    document.body,
  );
}

/** إنشاء تسمية عند موقع منقور: نقطة هنا، أو الانتقال لرسم حدود المنطقة. */
export function AnnotateCreateDialog({
  onPoint,
  onArea,
  onClose,
  saving,
}: {
  onPoint: (name: string, type: string) => void;
  onArea: (name: string, type: string) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("landmark");
  const [scope, setScope] = useState<"point" | "area">("point");
  const valid = name.trim().length > 0;

  return (
    <Shell title="تسمية على الخريطة" onClose={onClose}>
      <div className="space-y-2.5">
        <div className="space-y-1">
          <label className="block text-[11px] text-muted-foreground">الاسم *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثل: مقاطعة الرشيدية · جامع النوري…" className={INPUT} autoFocus />
        </div>
        <div className="space-y-1">
          <label className="block text-[11px] text-muted-foreground">النوع</label>
          <Combo value={type} onChange={setType} options={TYPE_OPTIONS} ariaLabel="نوع العنصر" />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            { id: "point", label: "نقطة هنا", desc: "في الموقع المنقور" },
            { id: "area", label: "منطقة", desc: "أرسم حدودها الآن" },
          ] as const).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScope(s.id)}
              className={cn(
                "rounded-xl px-2 py-2 text-start transition",
                scope === s.id ? "bg-primary/15 ring-1 ring-inset ring-primary/50" : "bg-secondary/40 hover:bg-accent",
              )}
            >
              <span className="block text-[12px] font-bold">{s.label}</span>
              <span className="block text-[10px] text-muted-foreground">{s.desc}</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          <Tag className="me-1 inline size-3" /> تصبح التسمية من بياناتك: تظهر على الخريطة وتُعثَر بالبحث الفائق بأولوية عليا.
        </p>
        <div className="flex gap-2 pt-1">
          <Button type="button" disabled={!valid || saving} onClick={() => (scope === "point" ? onPoint(name, type) : onArea(name, type))} className="flex-1">
            {saving ? "جارٍ الحفظ…" : scope === "point" ? "احفظ النقطة" : "ابدأ رسم الحدود"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
        </div>
      </div>
    </Shell>
  );
}

/** تحرير/حذف تسمية قائمة (نقر التسمية على الخريطة). */
export function AnnotateEditDialog({
  initialName,
  initialType,
  onSave,
  onDelete,
  onClose,
  saving,
}: {
  initialName: string;
  initialType: string;
  onSave: (name: string, type: string) => void;
  onDelete: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [type, setType] = useState(initialType || "landmark");
  const valid = name.trim().length > 0;

  return (
    <Shell title="تحرير التسمية" onClose={onClose}>
      <div className="space-y-2.5">
        <div className="space-y-1">
          <label className="block text-[11px] text-muted-foreground">الاسم *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT} autoFocus />
        </div>
        <div className="space-y-1">
          <label className="block text-[11px] text-muted-foreground">النوع</label>
          <Combo value={type} onChange={setType} options={TYPE_OPTIONS} ariaLabel="نوع العنصر" />
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="button" disabled={!valid || saving} onClick={() => onSave(name, type)} className="flex-1">
            {saving ? "جارٍ الحفظ…" : "حفظ"}
          </Button>
          <Button type="button" variant="danger" disabled={saving} onClick={onDelete} aria-label="حذف التسمية" title="حذف التسمية">
            <Trash2 className="size-4" />
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
        </div>
      </div>
    </Shell>
  );
}
