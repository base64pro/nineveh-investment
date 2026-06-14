"use client";

// م8.2 · إرشاد تثبيت ناعم (غير حاجب — قرار المالك): يظهر فقط على جوال iOS داخل Safari (غير مثبّت)،
// ويُتجاهَل دائماً (localStorage). النظام يبقى يعمل في المتصفّح (§ب.4) — هذا مجرّد دعوة لطيفة للتثبيت.
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Share, X } from "lucide-react";

const KEY = "pwa-hint-dismissed";

export function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const dismissed = window.localStorage.getItem(KEY) === "1";
    if (isMobile && isIOS && !standalone && !dismissed) {
      const t = window.setTimeout(() => setShow(true), 1700);
      return () => window.clearTimeout(t);
    }
  }, []);

  const dismiss = (): void => {
    setShow(false);
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* تجاهل */
    }
  };

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          style={{ bottom: "calc(var(--sab) + 3.75rem)" }}
          className="pointer-events-auto fixed inset-x-3 z-[55] flex items-center gap-3 overflow-hidden rounded-2xl border border-[rgba(148,175,209,0.4)] bg-[hsl(221_42%_10%/0.92)] px-3 py-2.5 shadow-[0_18px_50px_-16px_rgba(0,0,0,0.9),0_0_30px_-10px_rgba(148,175,209,0.5)] ring-1 ring-inset ring-white/[0.06] backdrop-blur-xl md:hidden"
        >
          {/* خط توهّج علوي بهوية النظام */}
          <span aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(207,227,255,0.8)] to-transparent" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={34} height={34} className="size-[34px] shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 text-right leading-tight">
            <div className="truncate text-[12.5px] font-bold text-foreground">ثبّت التطبيق على شاشتك الرئيسية</div>
            <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
              <span>اضغط</span>
              <Share className="size-3 text-[#9fc0e8]" />
              <span>ثم «أضِف إلى الشاشة الرئيسية»</span>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="تجاهل"
            className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground ring-1 ring-inset ring-white/10 transition hover:bg-white/10 hover:text-foreground active:scale-90"
          >
            <X className="size-4" />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
