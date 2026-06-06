"use client";

import { useState } from "react";
import { LogOut, X } from "lucide-react";
import { signOut } from "@/app/actions";
import { useRealtimeSync } from "@/lib/data/realtime";
import { useCounts } from "@/lib/data/use-counts";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { SECTIONS } from "./sections";

export function AppSidebar({ userEmail }: { userEmail: string | null }) {
  useRealtimeSync(); // المصدر الواحد: انعكاس فوري لأي تغيير
  const { data: counts } = useCounts();
  const [active, setActive] = useState<string | null>(null);

  const activeSection = SECTIONS.find((s) => s.id === active) ?? null;

  return (
    <>
      {/* اللوحة — overlay إلى يسار الشريط (تُبنى أقسامها في م2.2) */}
      {activeSection ? (
        <aside className="absolute inset-y-0 right-14 z-20 w-[360px] max-w-[85vw] overflow-y-auto border-s border-border bg-card/95 shadow-xl backdrop-blur">
          <header className="sticky top-0 flex items-center justify-between border-b border-border bg-card/95 p-3">
            <h2 className="text-sm font-bold">{activeSection.label}</h2>
            <button
              type="button"
              onClick={() => setActive(null)}
              aria-label="إغلاق"
              className="rounded p-1 transition hover:bg-accent"
            >
              <X className="size-4" />
            </button>
          </header>
          <div className="space-y-3 p-4 text-sm">
            {activeSection.table && counts ? (
              <p>
                العدد:{" "}
                <span className="font-semibold">{formatNumber(counts[activeSection.table] ?? 0)}</span>
              </p>
            ) : null}
            <p className="text-muted-foreground">{activeSection.note}</p>
          </div>
        </aside>
      ) : null}

      {/* الشريط — يمين الشاشة (§هـ.1) */}
      <nav className="absolute inset-y-0 right-0 z-30 flex w-14 flex-col items-center gap-1 border-s border-border bg-card/90 py-2 backdrop-blur">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const isActive = active === s.id;
          const count = s.table && counts ? counts[s.table] : undefined;
          return (
            <button
              key={s.id}
              type="button"
              title={s.label}
              aria-label={s.label}
              onClick={() => setActive(isActive ? null : s.id)}
              className={cn(
                "relative flex size-10 items-center justify-center rounded-md transition",
                isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              <Icon className="size-5" />
              {typeof count === "number" && count > 0 ? (
                <span className="absolute -bottom-0.5 end-0 rounded bg-secondary px-1 text-[9px] leading-tight text-secondary-foreground">
                  {formatNumber(count)}
                </span>
              ) : null}
            </button>
          );
        })}

        <form action={signOut} className="mt-auto">
          <button
            type="submit"
            title={userEmail ? `تسجيل الخروج · ${userEmail}` : "تسجيل الخروج"}
            aria-label="تسجيل الخروج"
            className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent"
          >
            <LogOut className="size-5" />
          </button>
        </form>
      </nav>
    </>
  );
}
