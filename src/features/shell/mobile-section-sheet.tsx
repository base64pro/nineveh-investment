"use client";

// م8.2/م8.3 · الورقة السفلية للجوال (§6) — للفرص/الرخص: تستضيف اللوحة كما هي بلا تغيير منطقي، بنقطتَي
// التقام «65%»/«موسّع» وسحب نابض ساحر (transform فقط). أرضية زجاجية هولوكرامية. تمرير «منصبّ»:
// البطاقة في المنتصف تكبر والمجاورة تصغر تدريجياً (coverflow). نقر زر الموقع ← يطير ثم تنغلق الورقة تلقائياً.
// والملء الكامل (MobileFullscreen) لبقية الأقسام — يحترم ارتفاع المنطقة المرئية (--app-h) فيثبت إطاره فوق الكيبورد.

import { useEffect, useRef } from "react";
import { animate, motion, useDragControls, useMotionValue, type PanInfo } from "framer-motion";
import { X, type LucideIcon } from "lucide-react";
import { onFlyTo } from "@/features/map/lib/map-nav-store";
import { setSheetHeight } from "./mobile-sheet-store";

const SPRING = { type: "spring" as const, stiffness: 300, damping: 32 };

// م8.9 · تمرير الورقة السفلية: **زخم حرّ كامل كقسم الشركات** (أُزيل scroll-snap الذي كان يكبح الزخم
// ويمنع الوصول لآخر بطاقة)، مع **حشو سفلي** يضمن ظهور آخر بطاقة فوق حافة الورقة (كانت تنحجب).
function useFreeScroll(rootRef: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const apply = (): boolean => {
      const scroller = root.querySelector<HTMLElement>(".overflow-y-auto");
      if (!scroller) return false;
      scroller.style.scrollSnapType = "none"; // لا التقام — انسياب وزخم حرّ بلا تباطؤ قسري
      scroller.style.paddingBottom = "3.5rem"; // ضمان وصول آخر بطاقة فوق الحافة (مساحة تمرير زائدة)
      return true;
    };
    if (apply()) return;
    // حاوية التمرير تظهر مع تركيب اللوحة — راقبها وطبّق فور ظهورها
    const mo = new MutationObserver(() => {
      if (apply()) mo.disconnect();
    });
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [rootRef]);
}

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
  // مرساة bottom:0 · الارتفاع المرئي = expanded − y. الانبثاق التلقائي = 65% من الشاشة (منطقة تمرير أوسع
  // والخريطة أظهر فوقها)، والموسّع ≈ 90% للسحب لأعلى. (السحب لأسفل من 65% ← إغلاق.)
  const dimsRef = useRef<{ expanded: number; half: number } | null>(null);
  if (dimsRef.current === null) {
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    // م8.9 · سقف الارتفاع: عند الرفع الكامل يستقرّ شريط التابات (الدوك الأفقي) أسفل الشريط العلوي
    // (الهيدبار + مؤشّرات KPI) بفجوة 8px مطابقة تماماً للفجوة بين الشريط والورقة — فلا يدخل تحت الهيدبار.
    const DOCK_BAR_H = 58; // ارتفاع شريط التابات الأفقي (أزرار size-11 + حشو)
    const GAP = 8;
    const topBottom =
      typeof document !== "undefined" ? (document.querySelector("[data-kpibar]")?.getBoundingClientRect().bottom ?? h * 0.16) : h * 0.16;
    const capExpanded = Math.round(h - topBottom - DOCK_BAR_H - 2 * GAP);
    const expanded = Math.max(Math.round(h * 0.5), Math.min(Math.round(h * 0.9), capExpanded));
    dimsRef.current = { expanded, half: Math.min(Math.round(h * 0.65), expanded) };
  }
  const dims = dimsRef.current;
  const snapHalf = dims.expanded - dims.half;
  const y = useMotionValue(dims.expanded); // يبدأ مخفيّاً ثم ينزلق إلى الانبثاق التلقائي (65%)
  const dragControls = useDragControls();
  const rootRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useFreeScroll(rootRef);

  const report = (): void => setSheetHeight(Math.max(0, dims.expanded - y.get()));

  // فتح: انزلاق ساحر إلى «نصف=50%» + تنظيف المتجر عند الإغلاق
  useEffect(() => {
    const c = animate(y, snapHalf, { ...SPRING, onUpdate: report });
    return () => {
      c.stop();
      setSheetHeight(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // اللحظة البصرية (§6 — معدّلة بطلب): أي طيران لقطعة ← الورقة تنغلق تلقائياً (لا تنبثق بطاقة الصور)
  useEffect(() => {
    return onFlyTo(() => onCloseRef.current());
  }, []);

  const onDragEnd = (_: unknown, info: PanInfo): void => {
    const cur = y.get();
    if (cur > snapHalf + 50 && info.velocity.y > 400) {
      animate(y, dims.expanded + 40, { ...SPRING, onUpdate: report, onComplete: () => onCloseRef.current() });
      return;
    }
    const goHalf = cur > snapHalf / 2 || info.velocity.y > 350;
    animate(y, goHalf ? snapHalf : 0, { ...SPRING, onUpdate: report });
  };

  const startDrag = (e: React.PointerEvent): void => dragControls.start(e);

  return (
    <motion.div
      ref={rootRef}
      style={{ y, height: dims.expanded }}
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: dims.expanded + 40 }}
      dragElastic={0.05}
      onDrag={report}
      onDragEnd={onDragEnd}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      className="fixed inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-[1.75rem] border border-b-0 border-[rgba(159,192,232,0.5)] bg-[hsl(221_42%_9%/0.86)] shadow-[0_-22px_60px_-18px_rgba(0,0,0,0.92),0_0_50px_-12px_rgba(148,175,209,0.55)] ring-1 ring-inset ring-white/[0.07] backdrop-blur-2xl md:hidden"
    >
      {/* وهج هولوكرامي علوي ساحر يطفو على رأس الورقة */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(70%_120%_at_50%_-30%,rgba(148,175,209,0.25),transparent_70%)]"
      />
      <span aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(207,227,255,0.85)] to-transparent" />

      {/* منطقة السحب: المقبض + الرأس المكثّف (إفساح أكبر للبطاقات) — الإغلاق يوقف الانتشار كي لا يبدأ سحباً */}
      <div onPointerDown={startDrag} className="relative shrink-0 cursor-grab touch-none active:cursor-grabbing">
        <div className="flex flex-col items-center pt-2">
          <span className="h-1.5 w-11 rounded-full bg-white/30 shadow-[0_0_8px_-1px_rgba(255,255,255,0.4)]" />
        </div>
        <header className="flex items-center justify-between gap-2 px-4 pb-1.5 pt-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[linear-gradient(150deg,rgba(159,192,232,0.26),rgba(139,111,176,0.14))] text-[#cfe3ff] ring-1 ring-inset ring-[rgba(159,192,232,0.45)]">
              <Icon className="size-[15px]" />
            </span>
            <h2 className="truncate text-sm font-bold tracking-tight">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="إغلاق"
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground ring-1 ring-inset ring-border/50 transition hover:bg-accent hover:text-foreground active:scale-90"
          >
            <X className="size-4" />
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
      // الارتفاع = المنطقة المرئية (--app-h يضبطها VisualViewport فوق الكيبورد) — يثبت الإطار عند تحرير نص الاستشارة
      style={{ paddingTop: "var(--sat)", paddingBottom: "var(--sab)", height: "var(--app-h, 100dvh)" }}
      className="fixed inset-x-0 top-0 z-50 flex flex-col bg-[hsl(221_40%_9%/0.98)] backdrop-blur-2xl md:hidden"
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
