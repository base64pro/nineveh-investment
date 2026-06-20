"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Maximize2, X } from "lucide-react";
import { requestResetView } from "@/features/map/lib/map-nav-store";
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
import { SECTIONS, type SectionDef } from "./sections";
import { useRole } from "@/features/auth/role-context";
import { MobileDock } from "./mobile-dock";
import { MobileSectionSheet, MobileFullscreen } from "./mobile-section-sheet";

// أقسام محظورة على المستخدم الثاني (م8.1): تصميم فرصة + الإعدادات.
const VIEWER_HIDDEN = new Set(["opportunity-design", "settings"]);

// جسم اللوحة لكل قسم — مصدر واحد يُعاد استخدامه في الديسكتوب (aside) والجوال (ورقة/ملء شاشة) بلا تكرار منطق.
function PanelBody({
  section,
  licenseStatus,
  setLicenseStatus,
  counts,
}: {
  section: SectionDef;
  licenseStatus: string;
  setLicenseStatus: (s: string) => void;
  counts: Record<string, number> | undefined;
}) {
  switch (section.id) {
    case "legal-advisor":
      return <LegalAdvisorPanel />;
    case "opportunities":
      return <OpportunitiesPanel />;
    case "licenses":
      return <LicensesPanel status={licenseStatus} setStatus={setLicenseStatus} />;
    case "companies":
      return <CompaniesPanel />;
    case "criteria":
      return <CriteriaPanel />;
    case "opportunity-design":
      return <AssumedPanel />;
    case "reports":
      return <ReportsPanel />;
    case "settings":
      return <SettingsPanel />;
    default:
      return (
        <div className="space-y-3 p-4 text-sm">
          {section.table && counts ? (
            <p>
              العدد: <span className="font-semibold">{formatNumber(counts[section.table] ?? 0)}</span>
            </p>
          ) : null}
          <p className="text-muted-foreground">{section.note}</p>
        </div>
      );
  }
}

export function AppSidebar({ userEmail }: { userEmail: string | null }) {
  useRealtimeSync(); // المصدر الواحد: انعكاس فوري لأي تغيير
  const { data: counts } = useCounts();
  const { isViewer } = useRole();
  const sections = isViewer ? SECTIONS.filter((s) => !VIEWER_HIDDEN.has(s.id)) : SECTIONS;
  const [active, setActive] = useState<string | null>(null);
  const [licenseStatus, setLicenseStatus] = useState("");
  // الجوال (< md): يقرّر مسار العرض (ورقة سفلية/ملء شاشة) بدل لوحة الديسكتوب — يمنع تركيب اللوحة مرّتين.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = (): void => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // فتح قسم من الهيدبار/البحث/المؤشّرات (§هـ.1 · النقر على مؤشّر ← مصدره)
  useEffect(
    () =>
      onOpenSection((id, status) => {
        setActive(id);
        if (id === "licenses" && status) setLicenseStatus(status);
      }),
    [],
  );

  const activeSection = sections.find((s) => s.id === active) ?? null;
  const ActiveIcon = activeSection?.icon;
  const isSheetSection = activeSection?.id === "opportunities" || activeSection?.id === "licenses";

  // اختيار قسم من الشريط/الدوك (إعادة استخدام لمنطق الفلتر النظيف للرخص)
  const selectSection = (id: string): void => {
    if (id === "licenses" && active !== id) setLicenseStatus(""); // فتح جديد ← فلتر نظيف (لا فلتر عالق)
    setActive(active === id ? null : id);
  };

  return (
    <>
      {/* ===== الديسكتوب (md+): لوحة جانبية overlay + عدّادات الرخص ===== */}
      {!isMobile ? (
        <AnimatePresence>
          {activeSection ? (
            <motion.aside
              key={activeSection.id}
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="absolute inset-y-0 right-20 z-20 flex w-[480px] max-w-[calc(100vw-5rem)] flex-col border-l border-l-[rgba(148,175,209,0.5)] bg-[hsl(220_36%_18%_/_0.96)] shadow-[-4px_0_18px_-6px_rgba(148,175,209,0.55),0_12px_36px_-12px_rgba(0,0,0,0.55)] backdrop-blur lg:inset-y-3 lg:right-[6.5rem] lg:max-w-[calc(100vw-9rem)] lg:overflow-hidden lg:rounded-2xl lg:border lg:border-[rgba(148,175,209,0.5)]"
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
                <PanelBody section={activeSection} licenseStatus={licenseStatus} setLicenseStatus={setLicenseStatus} counts={counts} />
              </div>
            </motion.aside>
          ) : null}
          {activeSection?.id === "licenses" ? (
            <LicenseStatusCounters key="lic-counters" status={licenseStatus} onSelect={setLicenseStatus} />
          ) : null}
        </AnimatePresence>
      ) : (
        /* ===== الجوال (< md): ورقة سفلية للفرص/الرخص، وملء شاشة لبقية الأقسام ===== */
        <AnimatePresence>
          {activeSection && isSheetSection ? (
            <MobileSectionSheet key={activeSection.id} title={activeSection.label} Icon={activeSection.icon} onClose={() => setActive(null)}>
              <PanelBody section={activeSection} licenseStatus={licenseStatus} setLicenseStatus={setLicenseStatus} counts={counts} />
            </MobileSectionSheet>
          ) : activeSection ? (
            <MobileFullscreen key={activeSection.id} title={activeSection.label} Icon={activeSection.icon} onClose={() => setActive(null)}>
              <PanelBody section={activeSection} licenseStatus={licenseStatus} setLicenseStatus={setLicenseStatus} counts={counts} />
            </MobileFullscreen>
          ) : null}
        </AnimatePresence>
      )}

      {/* الشريط — يمين الشاشة (§هـ.1) · ديسكتوب فقط (md+) · م7.6: زجاجي متدرّج + مؤشّر نشط منزلق */}
      <nav className="absolute inset-y-0 right-0 z-30 hidden w-20 flex-col items-center gap-1.5 border-l border-l-[rgba(148,175,209,0.5)] bg-[linear-gradient(180deg,hsl(220_38%_16%/0.96),hsl(220_36%_11%/0.94))] py-3 shadow-[-4px_0_22px_-6px_rgba(148,175,209,0.55)] backdrop-blur md:flex lg:top-3 lg:bottom-[5.5rem] lg:right-3 lg:rounded-2xl lg:border lg:border-[rgba(148,175,209,0.5)] lg:py-4 lg:shadow-[0_18px_50px_-16px_rgba(0,0,0,0.85),0_0_40px_-12px_rgba(148,175,209,0.5)] lg:ring-1 lg:ring-inset lg:ring-white/[0.06]">
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-[rgba(148,175,209,0.7)] to-transparent lg:hidden" />
        {sections.map((s) => {
          const Icon = s.icon;
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              type="button"
              title={s.label}
              aria-label={s.label}
              onClick={() => selectSection(s.id)}
              className={cn(
                "group relative flex h-[64px] w-[72px] flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200",
                isActive ? "text-foreground" : "text-foreground/65 hover:text-foreground",
              )}
            >
              {/* المؤشّر الضوئي الأحادي (ثلجي) — ينزلق بنعومة زنبركية بين الأقسام */}
              {isActive ? (
                <motion.span
                  layoutId="rail-active"
                  transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
                  className="absolute inset-y-2.5 left-1 w-1 rounded-full bg-[#9fc0e8] shadow-[0_0_12px_2px_rgba(159,192,232,0.85)]"
                />
              ) : null}
              {/* بلاطة الأيقونة الزجاجية المتقدّمة — تتوهّج عند النشاط/المرور */}
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-[11px] transition-all duration-200",
                  isActive
                    ? "bg-[linear-gradient(155deg,rgba(159,192,232,0.28),rgba(139,111,176,0.16))] ring-1 ring-inset ring-[rgba(159,192,232,0.55)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_16px_-4px_rgba(159,192,232,0.85)]"
                    : "bg-white/[0.03] ring-1 ring-inset ring-white/8 group-hover:bg-white/[0.07] group-hover:ring-[rgba(148,175,209,0.4)]",
                )}
              >
                <Icon
                  className={cn(
                    "size-[25px] transition-all duration-200 group-hover:scale-110",
                    isActive ? "text-[#cfe3ff] drop-shadow-[0_0_8px_rgba(159,192,232,0.95)]" : "",
                  )}
                  strokeWidth={1.7}
                />
              </span>
              <span className={cn("text-[9.5px] font-semibold leading-none tracking-tight", isActive ? "text-foreground" : "text-foreground/60 group-hover:text-foreground/85")}>
                {s.short}
              </span>
            </button>
          );
        })}

        <form action={signOut} className="mt-auto">
          <button
            type="submit"
            title={userEmail ? `تسجيل الخروج · ${userEmail}` : "تسجيل الخروج"}
            aria-label="تسجيل الخروج"
            className="group flex h-[60px] w-[72px] flex-col items-center justify-center gap-1 rounded-xl text-muted-foreground transition hover:text-[#e2a9b0]"
          >
            <span className="grid size-9 place-items-center rounded-[11px] bg-white/[0.03] ring-1 ring-inset ring-white/8 transition-all duration-200 group-hover:bg-[rgba(181,97,106,0.14)] group-hover:ring-[rgba(181,97,106,0.4)]">
              <LogOut className="size-[25px] transition-transform duration-200 group-hover:scale-110" strokeWidth={1.7} />
            </span>
            <span className="text-[9.5px] font-semibold leading-none tracking-tight">خروج</span>
          </button>
        </form>
      </nav>

      {/* م8.8 · قرص «كامل نينوى» ثلاثي الأبعاد على الحاسوب (lg) — أسفل الدوك العائم، كنسخة الجوال. data-sfx=off: صوت طيران فقط */}
      <button
        type="button"
        data-sfx="off"
        onClick={() => requestResetView()}
        aria-label="كامل نينوى"
        title="العودة إلى كامل نينوى"
        className="absolute bottom-3 right-6 z-40 hidden size-14 place-items-center rounded-full text-[#eaf2ff] ring-1 ring-inset ring-[rgba(159,192,232,0.7)] bg-[radial-gradient(125%_125%_at_50%_16%,rgba(176,205,240,0.6),rgba(139,111,176,0.34)_52%,rgba(17,24,43,0.92))] shadow-[0_10px_24px_-8px_rgba(0,0,0,0.85),0_0_24px_-4px_rgba(159,192,232,0.9),inset_0_1.5px_0_rgba(255,255,255,0.45),inset_0_-3px_6px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-[transform,box-shadow] duration-150 hover:ring-[rgba(159,192,232,0.95)] active:translate-y-0.5 active:shadow-[0_4px_12px_-8px_rgba(0,0,0,0.85),0_0_14px_-4px_rgba(159,192,232,0.8),inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-2px_4px_rgba(0,0,0,0.5)] lg:grid"
      >
        <Maximize2 className="size-[26px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]" strokeWidth={2} />
      </button>

      {/* الدوك العائم — جوال فقط (يحوي نفس الأقسام المفلترة بالأدوار) */}
      <MobileDock sections={sections} active={active} onSelect={selectSection} userEmail={userEmail} />

      {/* نوافذ القطعة المفترضة العامّة (تُفتح من الخريطة: بعد الرسم / من الإشارة) */}
      <ParcelModals />
    </>
  );
}
