"use client";

// م8.3/م8.4 · الدوك العائم (§4) — جوال فقط. وضعان متجانسان:
//  - لا ورقة مفتوحة → عمود رأسي على الحافة اليمنى + زر «كامل نينوى» الدائري تحته (عودة للخارطة الكاملة).
//  - ورقة مفتوحة → شريط أفقي يعلو الورقة ويرتفع معها حيّاً (بدل الانزياح الرأسي الشاذّ).
import { motion } from "framer-motion";
import { signOut } from "@/app/actions";
import { LogOut, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SectionDef } from "./sections";
import { useSheetHeight } from "./mobile-sheet-store";
import { requestResetView } from "@/features/map/lib/map-nav-store";

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
  const horizontal = sheetH > 0; // ورقة مفتوحة → شريط أفقي يعلوها

  return (
    <div
      style={horizontal ? { bottom: `${sheetH + 8}px` } : { transform: "translateY(-50%)", paddingRight: "var(--sar)" }}
      className={cn(
        "fixed z-40 flex border border-[rgba(148,175,209,0.4)] bg-[hsl(220_38%_14%/0.86)] shadow-[0_12px_40px_-12px_rgba(0,0,0,0.8),0_0_26px_-10px_rgba(148,175,209,0.55)] ring-1 ring-inset ring-white/[0.06] backdrop-blur-xl [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden",
        horizontal
          ? "inset-x-2 flex-row items-center justify-center gap-0.5 overflow-x-auto rounded-2xl px-2 py-1.5"
          : "right-2 top-1/2 max-h-[82vh] flex-col items-center gap-1 overflow-y-auto rounded-2xl p-1.5",
      )}
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
              "group relative grid size-11 shrink-0 place-items-center rounded-2xl transition active:scale-90",
              isActive ? "text-[#cfe3ff]" : "text-foreground/65 hover:bg-white/[0.06]",
            )}
          >
            {isActive ? (
              <motion.span
                layoutId="mobile-dock-active"
                transition={{ type: "spring", stiffness: 440, damping: 32, mass: 0.7 }}
                className="absolute inset-0 rounded-2xl bg-[linear-gradient(150deg,rgba(159,192,232,0.36),rgba(139,111,176,0.2))] ring-1 ring-inset ring-[rgba(159,192,232,0.65)] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_20px_-3px_rgba(159,192,232,0.95)]"
              />
            ) : null}
            <Icon
              className={cn(
                "relative size-[24px] transition-transform duration-200 group-hover:scale-110",
                isActive ? "drop-shadow-[0_0_9px_rgba(159,192,232,0.95)]" : "",
              )}
              strokeWidth={1.7}
            />
          </button>
        );
      })}

      <span aria-hidden className={cn("shrink-0 bg-gradient-to-r from-transparent via-white/15 to-transparent", horizontal ? "mx-0.5 h-7 w-px" : "my-0.5 h-px w-7")} />

      <form action={signOut}>
        <button
          type="submit"
          aria-label="تسجيل الخروج"
          title={userEmail ? `تسجيل الخروج · ${userEmail}` : "تسجيل الخروج"}
          className="group grid size-11 shrink-0 place-items-center rounded-2xl text-muted-foreground transition hover:bg-[rgba(181,97,106,0.12)] hover:text-[#e2a9b0] active:scale-90"
        >
          <LogOut className="size-[24px] transition-transform duration-200 group-hover:scale-110" strokeWidth={1.7} />
        </button>
      </form>

      {/* زر «كامل نينوى» الدائري — تحت الدوك (الوضع العمودي فقط: تصفّح الخريطة) */}
      {!horizontal ? (
        <>
          <span aria-hidden className="my-0.5 h-px w-7 shrink-0 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <button
            type="button"
            onClick={() => requestResetView()}
            aria-label="كامل نينوى"
            title="العودة إلى كامل نينوى"
            className="group flex shrink-0 flex-col items-center gap-0.5"
          >
            <span className="grid size-11 place-items-center rounded-full bg-[linear-gradient(150deg,rgba(159,192,232,0.24),rgba(139,111,176,0.14))] text-[#cfe3ff] ring-1 ring-inset ring-[rgba(159,192,232,0.55)] shadow-[0_0_16px_-4px_rgba(159,192,232,0.85)] transition group-hover:ring-[rgba(159,192,232,0.85)] group-active:scale-90">
              <Maximize2 className="size-[20px]" strokeWidth={1.8} />
            </span>
            <span className="text-[8px] font-bold leading-tight text-foreground/75">كامل نينوى</span>
          </button>
        </>
      ) : null}
    </div>
  );
}
