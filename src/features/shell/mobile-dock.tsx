"use client";

// م8.2 · الدوك العائم (§4) — جوال فقط: شريط زجاجي عمودي يطفو على الحافة اليمنى الفعلية فوق الخريطة
// (الخريطة تظهر خلفه). يحوي نفس أقسام SECTIONS بعد فلترة الأدوار (تُمرَّر جاهزة) + زر الخروج.
// يعلو الورقة السفلية عند فتحها (يُزاح لأعلى بمقدار نصف ارتفاعها الحيّ).
import { motion } from "framer-motion";
import { signOut } from "@/app/actions";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SectionDef } from "./sections";
import { useSheetHeight } from "./mobile-sheet-store";

export function MobileDock({
  sections,
  active,
  onSelect,
  userEmail,
}: {
  sections: readonly SectionDef[];
  active: string | null;
  onSelect: (id: string) => void;
  userEmail: string | null;
}) {
  const sheetH = useSheetHeight();
  return (
    <div
      style={{ transform: `translateY(calc(-50% - ${sheetH / 2}px))`, paddingRight: "var(--sar)" }}
      className="fixed right-2 top-1/2 z-40 flex max-h-[72vh] flex-col items-center gap-1 overflow-y-auto rounded-2xl border border-[rgba(148,175,209,0.4)] bg-[hsl(220_38%_14%/0.84)] p-1.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.8),0_0_26px_-10px_rgba(148,175,209,0.55)] ring-1 ring-inset ring-white/[0.06] backdrop-blur-xl [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
    >
      {sections.map((s) => {
        const Icon = s.icon;
        const isActive = active === s.id;
        return (
          <button
            key={s.id}
            type="button"
            aria-label={s.label}
            title={s.label}
            onClick={() => onSelect(s.id)}
            className={cn(
              "group relative grid size-12 shrink-0 place-items-center rounded-2xl transition active:scale-90",
              isActive ? "text-[#cfe3ff]" : "text-foreground/65 hover:bg-white/[0.06]",
            )}
          >
            {/* مؤشّر نشط منزلق (موشن جرافيك) — يطفو زنبركياً بين الأقسام مع توهّج هولوكرامي */}
            {isActive ? (
              <motion.span
                layoutId="mobile-dock-active"
                transition={{ type: "spring", stiffness: 440, damping: 32, mass: 0.7 }}
                className="absolute inset-0 rounded-2xl bg-[linear-gradient(150deg,rgba(159,192,232,0.36),rgba(139,111,176,0.2))] ring-1 ring-inset ring-[rgba(159,192,232,0.65)] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_20px_-3px_rgba(159,192,232,0.95)]"
              />
            ) : null}
            <Icon
              className={cn(
                "relative size-[25px] transition-transform duration-200 group-hover:scale-110",
                isActive ? "drop-shadow-[0_0_9px_rgba(159,192,232,0.95)]" : "",
              )}
              strokeWidth={1.7}
            />
          </button>
        );
      })}
      <span aria-hidden className="my-0.5 h-px w-7 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <form action={signOut}>
        <button
          type="submit"
          aria-label="تسجيل الخروج"
          title={userEmail ? `تسجيل الخروج · ${userEmail}` : "تسجيل الخروج"}
          className="group grid size-12 shrink-0 place-items-center rounded-2xl text-muted-foreground transition hover:bg-[rgba(181,97,106,0.12)] hover:text-[#e2a9b0] active:scale-90"
        >
          <LogOut className="size-[25px] transition-transform duration-200 group-hover:scale-110" strokeWidth={1.7} />
        </button>
      </form>
    </div>
  );
}
