"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, X } from "lucide-react";
import { signOut } from "@/app/actions";
import { useRealtimeSync } from "@/lib/data/realtime";
import { useCounts } from "@/lib/data/use-counts";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { OpportunitiesPanel } from "@/features/opportunities/opportunities-panel";
import { SECTIONS } from "./sections";

export function AppSidebar({ userEmail }: { userEmail: string | null }) {
  useRealtimeSync(); // المصدر الواحد: انعكاس فوري لأي تغيير
  const { data: counts } = useCounts();
  const [active, setActive] = useState<string | null>(null);

  const activeSection = SECTIONS.find((s) => s.id === active) ?? null;

  return (
    <>
      {/* اللوحة — overlay إلى يسار الشريط (تُبنى أقسامها في م2.2) */}
      <AnimatePresence>
        {activeSection ? (
          <motion.aside
            key={activeSection.id}
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="absolute inset-y-0 right-20 z-20 flex w-[480px] max-w-[92vw] flex-col border-l border-l-[rgba(148,175,209,0.5)] bg-card/95 shadow-[-4px_0_18px_-6px_rgba(148,175,209,0.55),0_12px_36px_-12px_rgba(0,0,0,0.55)] backdrop-blur"
          >
          <header className="flex items-center justify-between border-b border-border p-3">
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
          <div className="min-h-0 flex-1">
            {activeSection.id === "opportunities" ? (
              <OpportunitiesPanel />
            ) : (
              <div className="space-y-3 p-4 text-sm">
                {activeSection.table && counts ? (
                  <p>
                    العدد:{" "}
                    <span className="font-semibold">{formatNumber(counts[activeSection.table] ?? 0)}</span>
                  </p>
                ) : null}
                <p className="text-muted-foreground">{activeSection.note}</p>
              </div>
            )}
          </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      {/* الشريط — يمين الشاشة (§هـ.1) */}
      <nav className="absolute inset-y-0 right-0 z-30 flex w-20 flex-col items-center gap-1.5 border-l border-l-[rgba(148,175,209,0.5)] bg-card/90 py-3 shadow-[-4px_0_18px_-6px_rgba(148,175,209,0.55)] backdrop-blur">
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
                "relative flex size-14 items-center justify-center rounded-lg transition",
                isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              <Icon className="size-9" />
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
            className="flex size-14 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent"
          >
            <LogOut className="size-9" />
          </button>
        </form>
      </nav>
    </>
  );
}
