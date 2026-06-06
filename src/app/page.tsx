// صفحة مؤقّتة للتحقّق من السقالة (السمة الكحلية · RTL · Readex Pro · ألوان الحالات).
// الواجهة الفعلية (الخريطة والأقسام) تُبنى في المراحل اللاحقة.

const STATES = [
  { label: "معلَنة", className: "bg-state-announced" },
  { label: "قيد الإنجاز", className: "bg-state-inprogress" },
  { label: "منجزة", className: "bg-state-completed" },
  { label: "مسحوبة", className: "bg-state-withdrawn" },
  { label: "مفترضة", className: "bg-state-assumed" },
] as const;

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-bold tracking-tight">نظام إدارة الاستثمار في نينوى</h1>
      <p className="text-muted-foreground">الأساس (م0) — السقالة جاهزة.</p>
      <ul className="flex flex-wrap items-center justify-center gap-4">
        {STATES.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span className={`size-4 rounded-full ${s.className}`} aria-hidden />
            <span>{s.label}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
