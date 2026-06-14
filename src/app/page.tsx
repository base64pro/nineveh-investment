// الرئيسية = الهيدبار (داشبورد §هـ.1) فوق · ثم الخريطة (الأرضية) + السايدبار. تخطيط عمودي مرن (يتكيّف مع ارتفاع الهيدبار المتجاوب).
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/features/shell/app-sidebar";
import { Headbar } from "@/features/shell/headbar";
import { MobileKpis } from "@/features/shell/mobile-kpis";
import { SearchOverlay } from "@/features/search/search-overlay";
import { SettingsApplier } from "@/features/settings/settings-applier";
import { ConnectivityBanner } from "@/components/connectivity-banner";
import { SfxEvents } from "@/components/ui/sfx-events";
import { RoleProvider, type Role } from "@/features/auth/role-context";
import InvestmentMap from "@/features/map/components/investment-map";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // الدور (م8.1): المدير كامل الصلاحيات؛ من لا صفّ له ← viewer مقيّد (fail-closed).
  let role: Role = "viewer";
  if (user) {
    const { data } = await supabase.from("app_users").select("role").eq("user_id", user.id).maybeSingle<{ role: Role }>();
    role = data?.role === "admin" ? "admin" : "viewer";
  }

  return (
    <RoleProvider role={role}>
      {/* h-dvh = الارتفاع الديناميكي الفعلي (يعالج شريط أدوات iOS المتغيّر) — ثبات صارم بلا قفزات */}
      <main className="flex h-dvh w-screen flex-col overflow-hidden">
        {/* الهيدبار — في سياق التدفّق، يأخذ ارتفاعه الطبيعي (يلتفّ على الجوال بلا تمرير أفقي) */}
        <div className="relative z-30 shrink-0">
          <Headbar />
        </div>

        {/* منطقة المحتوى — الخريطة تملأها وتترك شريطاً (80px) يميناً للسايدبار */}
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-y-0 left-0 right-20">
            <InvestmentMap />
          </div>
          <MobileKpis />
          <AppSidebar userEmail={user?.email ?? null} />
          <SearchOverlay />
          <SettingsApplier />
          <ConnectivityBanner />
          <SfxEvents />
        </div>
      </main>
    </RoleProvider>
  );
}
