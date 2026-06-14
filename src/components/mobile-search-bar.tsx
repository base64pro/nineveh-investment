"use client";

// م8.2 · شريط بحث سفلي ثابت (جوال فقط) — في متناول الإبهام. النقر يفتح لوحة البحث الفائق الحالية (§هـ.2)
// بلا أي تغيير وظيفي. أبقِ بحث الهيدبار للديسكتوب (md:flex). paddingBottom=var(--sab) يحترم home-indicator.
// يُخفى عند فتح ورقة سفلية (تغطّيه) — يحافظ على نظافة المشهد.

import { Search } from "lucide-react";
import { openSearch } from "@/features/search/search-store";
import { useSheetHeight } from "@/features/shell/mobile-sheet-store";

export function MobileSearchBar() {
  const sheetOpen = useSheetHeight() > 0;
  if (sheetOpen) return null;
  return (
    <div
      style={{ paddingBottom: "var(--sab)" }}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-3 pb-2 pt-2 md:hidden"
    >
      <button
        type="button"
        onClick={openSearch}
        aria-label="ابحث في نينوى"
        className="pointer-events-auto flex h-[52px] w-full items-center gap-2.5 rounded-2xl border border-[rgba(148,175,209,0.45)] bg-[hsl(221_42%_10%/0.92)] px-4 text-muted-foreground shadow-[0_-6px_28px_-12px_rgba(0,0,0,0.85),0_0_24px_-10px_rgba(148,175,209,0.5)] ring-1 ring-inset ring-white/[0.06] backdrop-blur-xl transition active:scale-[0.99]"
      >
        <Search className="size-5 shrink-0 text-[#9fc0e8]" />
        <span className="flex-1 truncate text-right text-[13px]">ابحث في نينوى…</span>
      </button>
    </div>
  );
}
