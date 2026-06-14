"use client";

// م8.2 · الدوك العائم (§4) — جوال فقط: شريط زجاجي عمودي يطفو على الحافة اليمنى الفعلية فوق الخريطة
// (الخريطة تظهر خلفه). يحوي نفس أقسام SECTIONS بعد فلترة الأدوار (تُمرَّر جاهزة) + زر الخروج.
// يعلو الورقة السفلية عند فتحها (يُزاح لأعلى بمقدار نصف ارتفاعها الحيّ).
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
              "grid size-11 shrink-0 place-items-center rounded-xl transition active:scale-90",
              isActive
                ? "bg-[linear-gradient(155deg,rgba(159,192,232,0.3),rgba(139,111,176,0.16))] text-[#cfe3ff] ring-1 ring-inset ring-[rgba(159,192,232,0.55)] shadow-[0_0_16px_-4px_rgba(159,192,232,0.85)]"
                : "text-foreground/65 hover:bg-white/[0.06]",
            )}
          >
            <Icon className="size-[22px]" strokeWidth={1.7} />
          </button>
        );
      })}
      <span aria-hidden className="my-0.5 h-px w-7 bg-white/10" />
      <form action={signOut}>
        <button
          type="submit"
          aria-label="تسجيل الخروج"
          title={userEmail ? `تسجيل الخروج · ${userEmail}` : "تسجيل الخروج"}
          className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:text-[#e2a9b0] active:scale-90"
        >
          <LogOut className="size-[22px]" strokeWidth={1.7} />
        </button>
      </form>
    </div>
  );
}
