"use client";

// م7.9 · تصدير PDF لبطاقة قطعة بنقرة (طلب معتمد) — يستهلك مسار تقرير القطعة الخادمي القائم (scope=parcel).
import { toast } from "sonner";

export async function exportParcelPdf(kind: string, id: string | number, title: string | null): Promise<void> {
  const name = (title ?? "").trim() || "قطعة";
  const t = toast.loading(`يولِّد تقرير «${name}»…`);
  try {
    const res = await fetch(`/api/pdf/parcel?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(String(id))}&scope=parcel`);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("صدر تقرير القطعة PDF", { id: t });
  } catch {
    toast.error("تعذّر تصدير PDF — حاول مجدداً", { id: t });
  }
}
