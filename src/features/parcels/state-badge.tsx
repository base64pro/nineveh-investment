import { cn } from "@/lib/utils";
import type { ParcelState } from "@/types/entities";

// الحالات الخمس بألوانها + ملء شفّاف + حدّ + توهّج خفيف (هولوكرامي §هـ.3).
const LABEL: Record<ParcelState, string> = {
  announced: "معلَنة",
  "in-progress": "قيد الإنجاز",
  completed: "منجزة",
  withdrawn: "مسحوبة",
  assumed: "مفترضة",
};

const STYLE: Record<ParcelState, string> = {
  announced: "bg-state-announced/15 text-state-announced ring-state-announced/40 shadow-[0_0_12px_-2px] shadow-state-announced/50",
  "in-progress": "bg-state-inprogress/15 text-state-inprogress ring-state-inprogress/40 shadow-[0_0_12px_-2px] shadow-state-inprogress/50",
  completed: "bg-state-completed/15 text-state-completed ring-state-completed/40 shadow-[0_0_12px_-2px] shadow-state-completed/50",
  withdrawn: "bg-state-withdrawn/15 text-state-withdrawn ring-state-withdrawn/40 shadow-[0_0_12px_-2px] shadow-state-withdrawn/50",
  assumed: "bg-state-assumed/15 text-state-assumed ring-state-assumed/40 shadow-[0_0_12px_-2px] shadow-state-assumed/50",
};

export function StateBadge({ state }: { state: ParcelState }) {
  return (
    <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1", STYLE[state])}>
      {LABEL[state]}
    </span>
  );
}
