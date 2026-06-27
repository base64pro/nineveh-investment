"use client";

// م9.10 · نافذة إعداد جولة العرض السينمائيّة — اختيار المواقع (المعروضة كمجسّمات) + وضع حركة الكاميرا + التكرار،
// ثمّ «بدء الجولة». المواقع تأتي من المخزن (تنشرها الخريطة من مجسّماتها المعروضة فعلاً).
import { useEffect, useMemo, useState } from "react";
import { Play, Repeat } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { requestStartTour, useTourLocations } from "@/features/map/lib/map-nav-store";
import { TOUR_MODES } from "@/features/map/lib/tour-engine";

const KIND_LABEL: Record<string, string> = { tower: "برج", mall: "مول", hotel: "فندق" };

export function TourDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const locations = useTourLocations();
  const ordered = useMemo(() => locations, [locations]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<number>(TOUR_MODES[0]?.id ?? 1);
  const [loop, setLoop] = useState(false);

  // عند الفتح: تحديد كلّ المواقع افتراضياً
  useEffect(() => {
    if (open) setSelected(new Set(ordered.map((l) => l.refId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- التهيئة عند الفتح فقط
  }, [open]);

  const toggle = (refId: string): void =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(refId)) next.delete(refId);
      else next.add(refId);
      return next;
    });

  const allSelected = ordered.length > 0 && selected.size === ordered.length;

  const start = (): void => {
    const refIds = ordered.filter((l) => selected.has(l.refId)).map((l) => l.refId);
    if (!refIds.length) return;
    // ملء الشاشة يجب طلبه **متزامناً داخل نقرة المستخدم** (شرط الإيماءة) قبل بدء الجولة.
    try {
      void document.documentElement.requestFullscreen?.();
    } catch {
      /* غير مدعوم (مثل iOS Safari) — تُكمل الجولة بإخفاء الواجهة فقط */
    }
    requestStartTour({ refIds, mode, loop });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="جولة عرض سينمائيّة" size="md">
      <div className="space-y-4">
        {/* المواقع */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold">المواقع المعروضة في الجولة</span>
            {ordered.length > 0 ? (
              <button
                type="button"
                onClick={() => setSelected(new Set(allSelected ? [] : ordered.map((l) => l.refId)))}
                className="text-[11px] font-semibold text-primary transition hover:underline"
              >
                {allSelected ? "إلغاء تحديد الكل" : "تحديد الكل"}
              </button>
            ) : null}
          </div>
          {ordered.length === 0 ? (
            <p className="rounded-lg border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
              لا مواقع بمجسّمات على الخريطة بعد — ارسم حدود قطعة مفترضة لتظهر هنا.
            </p>
          ) : (
            <ul className="scroll-slim grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto">
              {ordered.map((l) => (
                <li key={l.refId}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 transition",
                      selected.has(l.refId) ? "border-primary/50 bg-primary/10" : "border-border/60 bg-background/40 hover:bg-white/[0.04]",
                    )}
                  >
                    <input type="checkbox" checked={selected.has(l.refId)} onChange={() => toggle(l.refId)} className="size-4 accent-primary" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{l.nameAr}</span>
                    <span className="shrink-0 rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">{KIND_LABEL[l.kind] ?? l.kind}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {ordered.length > 0 ? (
            <p className="mt-1.5 text-[10px] tabular-nums text-muted-foreground">
              {selected.size}/{ordered.length} مختارة
            </p>
          ) : null}
        </div>

        {/* وضع حركة الكاميرا */}
        <div>
          <span className="mb-2 block text-sm font-bold">وضع حركة الكاميرا</span>
          <div className="space-y-1.5">
            {TOUR_MODES.map((mo) => (
              <label
                key={mo.id}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2 transition",
                  mode === mo.id ? "border-primary/50 bg-primary/10" : "border-border/60 bg-background/40 hover:bg-white/[0.04]",
                )}
              >
                <input type="radio" name="tour-mode" checked={mode === mo.id} onChange={() => setMode(mo.id)} className="mt-0.5 size-4 accent-primary" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{mo.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">{mo.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* التكرار */}
        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} className="size-4 accent-primary" />
          <Repeat className="size-4 text-primary/70" />
          <span className="text-sm">تكرار الجولة (حلقة مستمرّة حتى الإيقاف)</span>
        </label>

        {/* الأزرار */}
        <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border/60 px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-white/[0.05] hover:text-foreground"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={start}
            disabled={!selected.size}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-[0_0_16px_-4px_rgba(148,175,209,0.9)] transition hover:brightness-110 active:scale-95 disabled:opacity-40"
          >
            <Play className="size-4" /> بدء الجولة
          </button>
        </div>
      </div>
    </Dialog>
  );
}
