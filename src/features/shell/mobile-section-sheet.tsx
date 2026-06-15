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

// تمرير «منصبّ» (coverflow): البطاقة الأقرب لمركز الحاوية أكبر وأوضح، والأبعد أصغر وأخفت — حركة جرافيكية مميّزة.
function useFocusedScroll(rootRef: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let scroller: HTMLElement | null = null;
    let raf = 0;
    let ro: ResizeObserver | null = null;
    // البؤرة = أعلى-وسط المنطقة المرئية (40%) لا منتصف الحاوية — لأنّ الحاوية أطول من المساحة المرئية
    // (الورقة بارتفاع «موسّع» مزاحة بـtransform). الحشوة العلوية الصغيرة تُبرز البطاقة الأولى، والسفلية الكبيرة
    // (أغلبها خارج الشاشة) تتيح للأخيرة بلوغ البؤرة — فكلّ البطاقات تتمركز وتبرز عند تمريرها.
    const visibleH = (rect: DOMRect): number => Math.max(120, Math.min(rect.bottom, window.innerHeight) - rect.top);
    const FOCAL = 0.4; // نسبة البؤرة من أعلى المنطقة المرئية
    const applyPadding = (): void => {
      if (!scroller) return;
      const rect = scroller.getBoundingClientRect();
      const firstLi = scroller.querySelector<HTMLElement>("ul > li");
      const cardH = firstLi ? firstLi.getBoundingClientRect().height : 88;
      const focalOffset = visibleH(rect) * FOCAL;
      const padTop = `${Math.max(8, Math.round(focalOffset - cardH / 2))}px`;
      const padBottom = `${Math.max(8, Math.round(scroller.clientHeight - focalOffset - cardH / 2))}px`;
      if (scroller.style.paddingTop !== padTop) scroller.style.paddingTop = padTop;
      if (scroller.style.paddingBottom !== padBottom) scroller.style.paddingBottom = padBottom;
    };
    const apply = (): void => {
      raf = 0;
      if (!scroller) return;
      const rect = scroller.getBoundingClientRect();
      const vH = visibleH(rect);
      const focalY = rect.top + vH * FOCAL; // أعلى-وسط المرئي
      const half = vH * 0.55 || 1;
      scroller.querySelectorAll<HTMLElement>("ul > li").forEach((li) => {
        const r = li.getBoundingClientRect();
        const t = Math.min(1, Math.abs(r.top + r.height / 2 - focalY) / half);
        li.style.transformOrigin = "center";
        li.style.transition = "transform 0.2s cubic-bezier(0.22,1,0.36,1), opacity 0.2s ease-out";
        li.style.transform = `scale(${(1 - t * 0.17).toFixed(3)})`;
        li.style.opacity = (1 - t * 0.52).toFixed(2);
      });
    };
    const onScroll = (): void => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const mo = new MutationObserver(() => {
      applyPadding();
      onScroll();
    });
    // أرجئ الربط حتى تظهر حاوية التمرير (اللوحة تُركَّب مع الورقة)
    const timers: number[] = [];
    timers.push(
      window.setTimeout(() => {
        scroller = root.querySelector<HTMLElement>(".overflow-y-auto");
        if (!scroller) return;
        applyPadding();
        scroller.addEventListener("scroll", onScroll, { passive: true });
        mo.observe(scroller, { childList: true, subtree: true });
        ro = new ResizeObserver(() => {
          applyPadding();
          onScroll();
        });
        ro.observe(scroller);
        apply();
        // المنطقة المرئية تتغيّر بالـtransform (حركة الفتح) لا بحجم الحاوية، فلا يلتقطها ResizeObserver —
        // أعِد حساب الحشوة/المقياس بعد استقرار حركة الفتح.
        timers.push(
          window.setTimeout(() => {
            applyPadding();
            apply();
          }, 380),
          window.setTimeout(() => {
            applyPadding();
            apply();
          }, 780),
        );
      }, 60),
    );
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      scroller?.removeEventListener("scroll", onScroll);
      mo.disconnect();
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
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
    dimsRef.current = { expanded: Math.round(h * 0.9), half: Math.round(h * 0.65) };
  }
  const dims = dimsRef.current;
  const snapHalf = dims.expanded - dims.half;
  const y = useMotionValue(dims.expanded); // يبدأ مخفيّاً ثم ينزلق إلى الانبثاق التلقائي (65%)
  const dragControls = useDragControls();
  const rootRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useFocusedScroll(rootRef);

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
