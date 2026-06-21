"use client";

// م8.3/م8.4/م8.6 · الدوك العائم (§4) — جوال فقط. وضعان متجانسان:
//  - لا ورقة مفتوحة → عمود رأسي على الحافة اليمنى، وتحته قرص «كامل نينوى» ثلاثي الأبعاد منفصل عن صندوق الدوك (عودة للخارطة الكاملة).
//  - ورقة مفتوحة → شريط أفقي يعلو الورقة ويرتفع معها حيّاً (بدل الانزياح الرأسي الشاذّ).
import { motion } from "framer-motion";
import { signOut } from "@/app/actions";
import { LogOut, Maximize2, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SectionDef } from "./sections";
import { useSheetHeight } from "./mobile-sheet-store";
import { requestResetView, requestZoom } from "@/features/map/lib/map-nav-store";

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
        "fixed z-40 flex md:hidden",
        horizontal ? "inset-x-2 flex-row items-center justify-center" : "right-2 top-[44%] flex-col items-center gap-2.5",
      )}
    >
      {/* صندوق الدوك (الأقسام + الخروج) */}
      <div
        className={cn(
          "flex border border-[rgba(148,175,209,0.4)] bg-[hsl(220_38%_14%/0.86)] shadow-[0_12px_40px_-12px_rgba(0,0,0,0.8),0_0_26px_-10px_rgba(148,175,209,0.55)] ring-1 ring-inset ring-white/[0.06] backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          horizontal
            ? "w-full flex-row items-center justify-center gap-0.5 overflow-x-auto rounded-2xl px-2 py-1.5"
            : "max-h-[74vh] flex-col items-center gap-1 overflow-y-auto rounded-2xl p-1.5",
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
      </div>

      {/* زر «كامل نينوى» — قرص ثلاثي الأبعاد بارز منفصل تحت الدوك (الوضع العمودي فقط: عودة للخارطة الكاملة) */}
      {!horizontal ? (
        <button
          type="button"
          data-sfx="off"
          onClick={() => requestResetView()}
          aria-label="كامل نينوى"
          title="العودة إلى كامل نينوى"
          className="grid size-14 shrink-0 place-items-center rounded-full text-[#eaf2ff] ring-1 ring-inset ring-[rgba(159,192,232,0.7)] bg-[radial-gradient(125%_125%_at_50%_16%,rgba(176,205,240,0.6),rgba(139,111,176,0.34)_52%,rgba(17,24,43,0.92))] shadow-[0_10px_24px_-8px_rgba(0,0,0,0.85),0_0_24px_-4px_rgba(159,192,232,0.9),inset_0_1.5px_0_rgba(255,255,255,0.45),inset_0_-3px_6px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-[transform,box-shadow] duration-150 hover:ring-[rgba(159,192,232,0.95)] active:translate-y-0.5 active:shadow-[0_4px_12px_-8px_rgba(0,0,0,0.85),0_0_14px_-4px_rgba(159,192,232,0.8),inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-2px_4px_rgba(0,0,0,0.5)]"
        >
          <Maximize2 className="size-[26px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]" strokeWidth={2} />
        </button>
      ) : null}

      {/* م8.9 · زرّا الزوم +/− — عمود زجاجي كحلي تحت قرص «كامل نينوى» (الوضع العمودي فقط) */}
      {!horizontal ? (
        <div className="flex flex-col overflow-hidden rounded-2xl border border-[rgba(159,192,232,0.5)] bg-[linear-gradient(160deg,hsl(221_40%_17%/0.92),hsl(221_44%_9%/0.92))] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_12px_30px_-12px_rgba(0,0,0,0.85),0_0_22px_-8px_rgba(148,175,209,0.55)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => requestZoom(1)}
            aria-label="تكبير"
            title="تكبير"
            className="grid size-12 place-items-center text-[#eaf2ff] transition active:scale-90 active:bg-[rgba(159,192,232,0.2)]"
          >
            <Plus className="size-5" strokeWidth={2.4} />
          </button>
          <span aria-hidden className="h-px bg-[rgba(159,192,232,0.28)]" />
          <button
            type="button"
            onClick={() => requestZoom(-1)}
            aria-label="تصغير"
            title="تصغير"
            className="grid size-12 place-items-center text-[#eaf2ff] transition active:scale-90 active:bg-[rgba(159,192,232,0.2)]"
          >
            <Minus className="size-5" strokeWidth={2.4} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
