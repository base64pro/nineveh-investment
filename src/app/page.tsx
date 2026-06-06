// الرئيسية = الخريطة (الواجهة المحورية §هـ.1). محميّة بـmiddleware.
// الهيدبار الفعلي والأقسام لاحقاً؛ هنا تراكب مؤقّت للعنوان والخروج.
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import InvestmentMap from "@/features/map/components/investment-map";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <InvestmentMap />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 p-3">
        <span className="pointer-events-auto rounded-md border border-border bg-card/80 px-3 py-1.5 text-sm font-medium backdrop-blur">
          نظام إدارة الاستثمار في نينوى
        </span>
        <form action={signOut} className="pointer-events-auto">
          <button className="rounded-md border border-border bg-card/80 px-3 py-1.5 text-sm backdrop-blur transition hover:bg-accent">
            خروج{user?.email ? ` · ${user.email}` : ""}
          </button>
        </form>
      </div>
    </main>
  );
}
