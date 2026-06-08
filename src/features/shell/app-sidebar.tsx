"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, X } from "lucide-react";
import { signOut } from "@/app/actions";
import { useRealtimeSync } from "@/lib/data/realtime";
import { useCounts } from "@/lib/data/use-counts";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { OpportunitiesPanel } from "@/features/opportunities/opportunities-panel";
import { LicensesPanel } from "@/features/licenses/licenses-panel";
import { LicenseStatusCounters } from "@/features/licenses/status-counters";
import { CompaniesPanel } from "@/features/companies/companies-panel";
import { CriteriaPanel } from "@/features/criteria/criteria-panel";
import { AssumedPanel } from "@/features/assumed/assumed-panel";
import { LegalAdvisorPanel } from "@/features/legal-advisor/legal-advisor-panel";
import { ParcelModals } from "@/features/parcels/parcel-modals";
import { onOpenSection } from "./shell-store";
import { SECTIONS } from "./sections";

export function AppSidebar({ userEmail }: { userEmail: string | null }) {
  useRealtimeSync(); // المصدر الواحد: انعكاس فوري لأي تغيير
  const { data: counts } = useCounts();
  const [active, setActive] = useState<string | null>(null);
  const [licenseStatus, setLicenseStatus] = useState("");

  // فتح قسم من الهيدبار/البحث (§هـ.1 · النقر على مؤشّر ← مصدره)
  useEffect(
    () =>
      onOpenSection((id, status) => {
        setActive(id);
        if (id === "licenses" && status) setLicenseStatus(status);
      }),
    [],
  );

  const activeSection = SECTIONS.find((s) => s.id === active) ?? null;
  const ActiveIcon = activeSection?.icon;

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
            className="absolute bottom-0 right-20 top-12 z-20 flex w-[480px] max-w-[92vw] flex-col border-l border-l-[rgba(148,175,209,0.5)] bg-[hsl(220_36%_18%_/_0.96)] shadow-[-4px_0_18px_-6px_rgba(148,175,209,0.55),0_12px_36px_-12px_rgba(0,0,0,0.55)] backdrop-blur"
          >
          <header className="flex items-center justify-between gap-2 border-b border-border bg-card p-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {ActiveIcon ? (
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[rgba(148,175,209,0.16)] text-foreground ring-1 ring-inset ring-foreground/15">
                  <ActiveIcon className="size-4" />
                </span>
              ) : null}
              <h2 className="truncate text-base font-bold tracking-tight">{activeSection.label}</h2>
            </div>
            <button
              type="button"
              onClick={() => setActive(null)}
              aria-label="إغلاق"
              className="shrink-0 rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </header>
          <div className="min-h-0 flex-1">
            {activeSection.id === "legal-advisor" ? (
              <LegalAdvisorPanel />
            ) : activeSection.id === "opportunities" ? (
              <OpportunitiesPanel />
            ) : activeSection.id === "licenses" ? (
              <LicensesPanel status={licenseStatus} setStatus={setLicenseStatus} />
            ) : activeSection.id === "companies" ? (
              <CompaniesPanel />
            ) : activeSection.id === "criteria" ? (
              <CriteriaPanel />
            ) : activeSection.id === "opportunity-design" ? (
              <AssumedPanel />
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
        {activeSection?.id === "licenses" ? (
          <LicenseStatusCounters key="lic-counters" status={licenseStatus} onSelect={setLicenseStatus} />
        ) : null}
      </AnimatePresence>

      {/* الشريط — يمين الشاشة (§هـ.1) */}
      <nav className="absolute bottom-0 right-0 top-12 z-30 flex w-20 flex-col items-center gap-1.5 border-l border-l-[rgba(148,175,209,0.5)] bg-card/90 py-3 shadow-[-4px_0_18px_-6px_rgba(148,175,209,0.55)] backdrop-blur">
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

      {/* نوافذ القطعة المفترضة العامّة (تُفتح من الخريطة: بعد الرسم / من الإشارة) */}
      <ParcelModals />
    </>
  );
}
