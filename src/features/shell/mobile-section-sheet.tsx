"use client";

// م8.2 · الورقة السفلية للجوال (§6) — للفرص/الرخص: تستضيف اللوحة كما هي بلا تغيير منطقي، بنقطتَي التقام
// «نصف»/«موسّع» وسحب نابض (transform فقط — صفر اهتزاز). تبثّ ارتفاعها الحيّ لمتجر الورقة (يستهلكه camera
// padding للخريطة §5 وقصّ بطاقة الصور §9). «اللحظة البصرية»: أي طيران لقطعة ← الورقة تنزل إلى «نصف».
// والملء الكامل (MobileFullscreen) لبقية الأقسام.

import { useEffect, useState } from "react";
import { animate, motion, useDragControls, useMotionValue, type PanInfo } from "framer-motion";
import { X, type LucideIcon } from "lucide-react";
import { onFlyTo } from "@/features/map/lib/map-nav-store";
import { setSheetHeight } from "./mobile-sheet-store";

const SPRING = { type: "spring" as const, stiffness: 320, damping: 34 };

export function MobileSectionSheet({
  title,
  Icon,
  onClose,
  children,
}: {
  title: string;
  Icon: LucideIcon;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // أبعاد ثابتة من ارتفاع الشاشة عند التركيب (الوضع عمودي فقط — لا حاجة لإعادة الحساب). مرساة bottom:0،
  // والارتفاع المرئي = expanded - y (y إزاحة لأسفل تُخفي الجزء السفلي). نصف ≈ 44% · موسّع ≈ 78%.
  const [dims] = useState(() => {
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    return { expanded: Math.round(h * 0.78), half: Math.round(h * 0.44) };
  });
  const snapHalf = dims.expanded - dims.half;
  const y = useMotionValue(dims.expanded); // يبدأ مخفيّاً تماماً ثم ينزلق إلى «نصف»
  const dragControls = useDragControls();

  const report = (): void => setSheetHeight(Math.max(0, dims.expanded - y.get()));

  // فتح: انزلاق إلى «نصف» (مرّة واحدة عند التركيب) + تنظيف المتجر عند الإغلاق
  useEffect(() => {
    const c = animate(y, snapHalf, { ...SPRING, onUpdate: report });
    return () => {
      c.stop();
      setSheetHeight(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // اللحظة البصرية (§6): أي طيران لقطعة ← الورقة تنزل إلى «نصف» (إن كانت موسّعة)
  useEffect(() => {
    return onFlyTo(() => {
      animate(y, snapHalf, { ...SPRING, onUpdate: report });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDragEnd = (_: unknown, info: PanInfo): void => {
    const cur = y.get();
    // سحب قويّ لأسفل من «نصف» ← إغلاق
    if (cur > snapHalf + 50 && info.velocity.y > 400) {
      animate(y, dims.expanded + 40, { ...SPRING, onUpdate: report, onComplete: onClose });
      return;
    }
    const goHalf = cur > snapHalf / 2 || info.velocity.y > 350;
    animate(y, goHalf ? snapHalf : 0, { ...SPRING, onUpdate: report });
  };

  const startDrag = (e: React.PointerEvent): void => dragControls.start(e);

  return (
    <motion.div
      style={{ y, height: dims.expanded }}
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: dims.expanded + 40 }}
      dragElastic={0.04}
      onDrag={report}
      onDragEnd={onDragEnd}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      className="fixed inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-3xl border border-b-0 border-[rgba(148,175,209,0.4)] bg-[hsl(221_40%_10%/0.97)] shadow-[0_-18px_50px_-16px_rgba(0,0,0,0.9),0_0_40px_-12px_rgba(148,175,209,0.45)] ring-1 ring-inset ring-white/[0.06] backdrop-blur-2xl md:hidden"
    >
      {/* منطقة السحب: المقبض + الرأس (الإغلاق يوقف الانتشار كي لا يبدأ سحباً) */}
      <div onPointerDown={startDrag} className="shrink-0 cursor-grab touch-none active:cursor-grabbing">
        <div className="flex flex-col items-center pt-2">
          <span className="h-1.5 w-12 rounded-full bg-white/25" />
        </div>
        <header className="relative flex items-center justify-between gap-2 px-4 py-2.5">
          <span aria-hidden className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-[rgba(148,175,209,0.55)] to-transparent" />
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[rgba(148,175,209,0.16)] text-foreground ring-1 ring-inset ring-foreground/15">
              <Icon className="size-4" />
            </span>
            <h2 className="truncate text-[15px] font-bold tracking-tight">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="إغلاق"
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground ring-1 ring-inset ring-border/50 transition hover:bg-accent hover:text-foreground active:scale-90"
          >
            <X className="size-5" />
          </button>
        </header>
      </div>
      {/* الجسم — اللوحة تُدير تمريرها الداخلي (مطابق للديسكتوب) */}
      <div className="min-h-0 flex-1 overscroll-contain" style={{ paddingBottom: "var(--sab)" }}>
        {children}
      </div>
    </motion.div>
  );
}

export function MobileFullscreen({
  title,
  Icon,
  onClose,
  children,
}: {
  title: string;
  Icon: LucideIcon;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24, transition: { duration: 0.18 } }}
      transition={SPRING}
      style={{ paddingTop: "var(--sat)", paddingBottom: "var(--sab)" }}
      className="fixed inset-0 z-50 flex flex-col bg-[hsl(221_40%_9%/0.98)] backdrop-blur-2xl md:hidden"
    >
      <header className="relative flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card/60 px-4 py-3">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[rgba(148,175,209,0.65)] to-transparent" />
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[rgba(148,175,209,0.16)] text-foreground ring-1 ring-inset ring-foreground/15">
            <Icon className="size-[18px]" />
          </span>
          <h2 className="truncate text-base font-bold tracking-tight">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground ring-1 ring-inset ring-border/50 transition hover:bg-accent hover:text-foreground active:scale-90"
        >
          <X className="size-5" />
        </button>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </motion.div>
  );
}
