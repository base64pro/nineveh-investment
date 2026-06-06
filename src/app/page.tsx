// الرئيسية = الخريطة (الأرضية §هـ.1) + السايدبار اليمين (§هـ.1). محميّة بـmiddleware.
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/features/shell/app-sidebar";
import InvestmentMap from "@/features/map/components/investment-map";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      {/* الخريطة تملأ المساحة وتترك شريطاً (56px) يميناً للسايدبار — دون لمس مكوّن م1 */}
      <div className="absolute inset-y-0 left-0 right-14">
        <InvestmentMap />
      </div>

      <AppSidebar userEmail={user?.email ?? null} />

      {/* عنوان النظام (تراكب علوي خفيف؛ الهيدبار الفعلي في م5) */}
      <div className="absolute left-3 top-3 z-10">
        <span className="rounded-md border border-border bg-card/80 px-3 py-1.5 text-sm font-medium backdrop-blur">
          نظام إدارة الاستثمار في نينوى
        </span>
      </div>
    </main>
  );
}
