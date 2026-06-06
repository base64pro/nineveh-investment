import { cn } from "@/lib/utils";
import type { ParcelState } from "@/types/entities";

// الحالات الخمس بألوانها (§هـ.3).
const LABEL: Record<ParcelState, string> = {
  announced: "معلَنة",
  "in-progress": "قيد الإنجاز",
  completed: "منجزة",
  withdrawn: "مسحوبة",
  assumed: "مفترضة",
};

const STYLE: Record<ParcelState, string> = {
  announced: "bg-state-announced/15 text-state-announced ring-state-announced/40",
  "in-progress": "bg-state-inprogress/15 text-state-inprogress ring-state-inprogress/40",
  completed: "bg-state-completed/15 text-state-completed ring-state-completed/40",
  withdrawn: "bg-state-withdrawn/15 text-state-withdrawn ring-state-withdrawn/40",
  assumed: "bg-state-assumed/15 text-state-assumed ring-state-assumed/40",
};

export function StateBadge({ state }: { state: ParcelState }) {
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs ring-1", STYLE[state])}>
      {LABEL[state]}
    </span>
  );
}
