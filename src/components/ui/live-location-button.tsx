"use client";

import { Navigation } from "lucide-react";

/** زرّ «الموقع المباشر» — أبيض احترافي مدمج بجانب الاسم/القطاع؛ يوقف انتشار النقر (لا يطوي البطاقة). */
export function LiveLocationButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title="الموقع المباشر"
      aria-label="الموقع المباشر"
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-white shadow-sm ring-1 ring-inset ring-white/30 transition hover:scale-105 hover:bg-white/25 hover:ring-white/50 active:scale-95"
    >
      <Navigation className="size-3.5" />
    </button>
  );
}
