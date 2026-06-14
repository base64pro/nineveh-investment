// الرئيسية = الهيدبار (داشبورد §هـ.1) فوق · ثم الخريطة (الأرضية) + السايدبار. تخطيط عمودي مرن (يتكيّف مع ارتفاع الهيدبار المتجاوب).
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/features/shell/app-sidebar";
import { Headbar } from "@/features/shell/headbar";
import { MobileKpis } from "@/features/shell/mobile-kpis";
import { SearchOverlay } from "@/features/search/search-overlay";
import { SettingsApplier } from "@/features/settings/settings-applier";
import { ConnectivityBanner } from "@/components/connectivity-banner";
import { SfxEvents } from "@/components/ui/sfx-events";
import { ViewportFix } from "@/components/viewport-fix";
import { InstallHint } from "@/components/install-hint";
import { MobileSearchBar } from "@/components/mobile-search-bar";
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
      {/* الارتفاع = منطقة العرض المرئية (--app-h يضبطها VisualViewport فوق الكيبورد)، fallback dvh — ثبات صارم */}
      <main className="flex w-screen flex-col overflow-hidden" style={{ height: "var(--app-h, 100dvh)" }}>
        {/* الهيدبار — في سياق التدفّق، يأخذ ارتفاعه الطبيعي (يلتفّ على الجوال بلا تمرير أفقي) */}
        <div className="relative z-30 shrink-0">
          <Headbar />
        </div>

        {/* منطقة المحتوى — الخريطة تملأها. الجوال: عرض كامل (right-0). الديسكتوب: تترك 80px يميناً للسايدبار (md:right-20). */}
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-y-0 left-0 right-0 md:right-20">
            <InvestmentMap />
          </div>
          <MobileKpis />
          <AppSidebar userEmail={user?.email ?? null} />
          <SearchOverlay />
          <SettingsApplier />
          <ConnectivityBanner />
          <SfxEvents />
          <ViewportFix />
          {/* §8 شريط بحث سفلي + §2.3 إرشاد تثبيت ناعم — جوال فقط */}
          <MobileSearchBar />
          <InstallHint />
        </div>
      </main>
    </RoleProvider>
  );
}
