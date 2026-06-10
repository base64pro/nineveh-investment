// الرئيسية = الهيدبار (داشبورد §هـ.1) فوق · ثم الخريطة (الأرضية) + السايدبار. تخطيط عمودي مرن (يتكيّف مع ارتفاع الهيدبار المتجاوب).
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/features/shell/app-sidebar";
import { Headbar } from "@/features/shell/headbar";
import { SearchOverlay } from "@/features/search/search-overlay";
import { SettingsApplier } from "@/features/settings/settings-applier";
import InvestmentMap from "@/features/map/components/investment-map";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden">
      {/* الهيدبار — في سياق التدفّق، يأخذ ارتفاعه الطبيعي (يلتفّ على الجوال بلا تمرير أفقي) */}
      <div className="relative z-30 shrink-0">
        <Headbar />
      </div>

      {/* منطقة المحتوى — الخريطة تملأها وتترك شريطاً (80px) يميناً للسايدبار */}
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-y-0 left-0 right-20">
          <InvestmentMap />
        </div>
        <AppSidebar userEmail={user?.email ?? null} />
        <SearchOverlay />
        <SettingsApplier />
      </div>
    </main>
  );
}
