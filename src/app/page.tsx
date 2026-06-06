// الرئيسية (محميّة بـmiddleware). الواجهة الفعلية (الخريطة والأقسام) تُبنى لاحقاً.
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

const STATES = [
  { label: "معلَنة", className: "bg-state-announced" },
  { label: "قيد الإنجاز", className: "bg-state-inprogress" },
  { label: "منجزة", className: "bg-state-completed" },
  { label: "مسحوبة", className: "bg-state-withdrawn" },
  { label: "مفترضة", className: "bg-state-assumed" },
] as const;

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-bold tracking-tight">نظام إدارة الاستثمار في نينوى</h1>
      <p className="text-muted-foreground">الأساس (م0) — جاهز.</p>
      {user ? <p className="text-sm">مُسجَّل الدخول: {user.email}</p> : null}

      <ul className="flex flex-wrap items-center justify-center gap-4">
        {STATES.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span className={`size-4 rounded-full ${s.className}`} aria-hidden />
            <span>{s.label}</span>
          </li>
        ))}
      </ul>

      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md border border-border px-4 py-2 text-sm transition hover:bg-accent"
        >
          تسجيل الخروج
        </button>
      </form>
    </main>
  );
}
