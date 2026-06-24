"use client";

// م9.7.1ب · منسدلة اختيار النموذج البارامتري للقطعة المفترضة (الخارطة الاستثمارية):
// النوع (برج/مول/فندق أو تلقائي) + العدد (1/N) + التوزيع — للمدير. يُعرَض هذا النموذج الإجرائيّ
// على القطعة ما لم يُرفع مجسّم glb/STL (الذي له الأولويّة في العرض — م9.3ب).

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Blocks, Loader2 } from "lucide-react";
import type { ParcelKind } from "@/features/map/lib/map-nav-store";
import type { ModelKind } from "@/features/map/lib/parametric-tower";
import { clearParcelParametric, type ParametricDistribution, upsertParcelParametric, useParcelParametric } from "./model-lib";

const KINDS: { v: ModelKind | "auto"; label: string }[] = [
  { v: "auto", label: "تلقائي (حسب الاسم)" },
  { v: "tower", label: "برج سكني" },
  { v: "mall", label: "مول تجاري" },
  { v: "hotel", label: "فندق ٥ نجوم" },
];
const DISTS: { v: ParametricDistribution; label: string }[] = [
  { v: "grid", label: "شبكة" },
  { v: "row", label: "صفّ" },
  { v: "scatter", label: "متناثر" },
];
const selCls = "rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring";

export function ParametricSection({ kind, refId, readOnly }: { kind: ParcelKind; refId: string; readOnly: boolean }) {
  const { data: cfg, isLoading } = useParcelParametric(kind, refId);
  const qc = useQueryClient();
  const [mk, setMk] = useState<ModelKind | "auto">("auto");
  const [count, setCount] = useState(1);
  const [dist, setDist] = useState<ParametricDistribution>("grid");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMk(cfg?.modelKind ?? "auto");
    setCount(cfg?.count ?? 1);
    setDist(cfg?.distribution ?? "grid");
  }, [cfg]);

  function invalidate(): void {
    void qc.invalidateQueries({ queryKey: ["parcel_parametric"] });
  }

  async function save(): Promise<void> {
    setBusy(true);
    const res =
      mk === "auto"
        ? await clearParcelParametric(kind, refId)
        : await upsertParcelParametric(kind, refId, { modelKind: mk, count: Math.max(1, Math.min(24, count)), distribution: dist });
    setBusy(false);
    if (res.ok) {
      toast.success("حُفِظ إعداد المجسّم — سينعكس على الخريطة");
      invalidate();
    } else {
      const errMsg = (res as { error?: string }).error;
      toast.error(errMsg ?? "تعذّر الحفظ");
    }
  }

  return (
    <section className="rounded-xl border border-border/60 bg-background/40 p-3.5">
      <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-primary/80">
        <Blocks className="size-3.5" /> المجسّم البارامتري
      </h4>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">يُحمّل الإعداد…</p>
      ) : readOnly ? (
        <p className="text-[11px] text-muted-foreground">
          النوع: {KINDS.find((k) => k.v === (cfg?.modelKind ?? "auto"))?.label}
          {cfg && cfg.count > 1 ? ` · ${cfg.count} مجسّمات (${DISTS.find((d) => d.v === cfg.distribution)?.label})` : ""}
        </p>
      ) : (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground">النوع</span>
              <select value={mk} onChange={(e) => setMk(e.target.value as ModelKind | "auto")} className={selCls}>
                {KINDS.map((k) => (
                  <option key={k.v} value={k.v}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            {mk !== "auto" ? (
              <>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">العدد</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={24}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value) || 1)}
                    className="w-16 rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                {count > 1 ? (
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground">التوزيع</span>
                    <select value={dist} onChange={(e) => setDist(e.target.value as ParametricDistribution)} className={selCls}>
                      {DISTS.map((d) => (
                        <option key={d.v} value={d.v}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-primary/90 px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground transition hover:bg-primary disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
              حفظ
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">يُعرَض هذا النموذج الإجرائيّ على القطعة ما لم يُرفع مجسّم glb/STL (له الأولويّة). «تلقائي» = حسب اسم القطعة.</p>
        </div>
      )}
    </section>
  );
}
