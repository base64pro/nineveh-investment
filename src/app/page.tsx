// الرئيسية = الهيدبار (داشبورد §هـ.1) + الخريطة (الأرضية) + السايدبار اليمين. محميّة بـmiddleware.
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/features/shell/app-sidebar";
import { Headbar } from "@/features/shell/headbar";
import { SearchOverlay } from "@/features/search/search-overlay";
import InvestmentMap from "@/features/map/components/investment-map";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      {/* الهيدبار — شريط علوي كامل = داشبورد، والمحتوى تحته */}
      <div className="absolute inset-x-0 top-0 z-40">
        <Headbar />
      </div>

      {/* الخريطة تملأ ما تحت الهيدبار وتترك شريطاً (80px) يميناً للسايدبار — دون لمس مكوّن م1 */}
      <div className="absolute bottom-0 left-0 right-20 top-14">
        <InvestmentMap />
      </div>

      <AppSidebar userEmail={user?.email ?? null} />
      <SearchOverlay />
    </main>
  );
}
