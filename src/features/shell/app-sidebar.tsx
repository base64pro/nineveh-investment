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
import { ReportsPanel } from "@/features/reports/reports-panel";
import { SettingsPanel } from "@/features/settings/settings-panel";
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
            className="absolute inset-y-0 right-20 z-20 flex w-[480px] max-w-[92vw] flex-col border-l border-l-[rgba(148,175,209,0.5)] bg-[hsl(220_36%_18%_/_0.96)] shadow-[-4px_0_18px_-6px_rgba(148,175,209,0.55),0_12px_36px_-12px_rgba(0,0,0,0.55)] backdrop-blur"
          >
          <header className="relative flex items-center justify-between gap-2 border-b border-border bg-card p-3">
            <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[rgba(148,175,209,0.65)] to-transparent" />
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
              title="إغلاق"
              className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground ring-1 ring-inset ring-border/50 transition hover:bg-accent hover:text-foreground hover:ring-border active:scale-90"
            >
              <X className="size-5" />
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
            ) : activeSection.id === "reports" ? (
              <ReportsPanel />
            ) : activeSection.id === "settings" ? (
              <SettingsPanel />
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

      {/* الشريط — يمين الشاشة (§هـ.1) · م7.6: زجاجي متدرّج + مؤشّر نشط منزلق + توهّجات */}
      <nav className="absolute inset-y-0 right-0 z-30 flex w-20 flex-col items-center gap-1.5 border-l border-l-[rgba(148,175,209,0.5)] bg-[linear-gradient(180deg,hsl(220_38%_16%/0.96),hsl(220_36%_11%/0.94))] py-3 shadow-[-4px_0_22px_-6px_rgba(148,175,209,0.55)] backdrop-blur">
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-[rgba(148,175,209,0.7)] to-transparent" />
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
              onClick={() => {
                if (s.id === "licenses" && !isActive) setLicenseStatus(""); // فتح جديد من الشريط ← فلتر نظيف (لا فلتر عالق)
                setActive(isActive ? null : s.id);
              }}
              className={cn(
                "group relative flex size-14 items-center justify-center rounded-xl transition-all duration-200",
                isActive
                  ? "bg-[linear-gradient(135deg,rgba(148,175,209,0.22),rgba(139,111,176,0.14))] text-foreground shadow-[0_0_22px_-6px_rgba(148,175,209,0.8)] ring-1 ring-inset ring-[rgba(148,175,209,0.55)]"
                  : "text-foreground/70 hover:bg-white/6 hover:text-foreground",
              )}
            >
              {/* المؤشّر الضوئي المنزلق بين الأقسام */}
              {isActive ? (
                <motion.span
                  layoutId="rail-active"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="absolute inset-y-2 left-0.5 w-[3px] rounded-full bg-gradient-to-b from-[#C7A24E] via-[#94afd1] to-[#8B6FB0] shadow-[0_0_10px_1px_rgba(148,175,209,0.9)]"
                />
              ) : null}
              <Icon className={cn("size-9 transition-transform duration-200 group-hover:scale-110", isActive && "drop-shadow-[0_0_8px_rgba(148,175,209,0.8)]")} />
              {typeof count === "number" && count > 0 ? (
                <span className="absolute -bottom-0.5 end-0 rounded-full bg-[hsl(220_36%_11%/0.92)] px-1.5 text-[9px] font-bold leading-tight text-[#cfe3ff] ring-1 ring-inset ring-[rgba(148,175,209,0.45)]">
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
