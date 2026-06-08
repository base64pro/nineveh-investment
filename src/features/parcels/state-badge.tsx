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

const COLOR: Record<ParcelState, string> = {
  announced: "bg-state-announced/15 text-state-announced ring-state-announced/40",
  "in-progress": "bg-state-inprogress/15 text-state-inprogress ring-state-inprogress/40",
  completed: "bg-state-completed/15 text-state-completed ring-state-completed/40",
  withdrawn: "bg-state-withdrawn/15 text-state-withdrawn ring-state-withdrawn/40",
  assumed: "bg-state-assumed/15 text-state-assumed ring-state-assumed/40",
};

const GLOW: Record<ParcelState, string> = {
  announced: "shadow-[0_0_12px_-2px] shadow-state-announced/50",
  "in-progress": "shadow-[0_0_12px_-2px] shadow-state-inprogress/50",
  completed: "shadow-[0_0_12px_-2px] shadow-state-completed/50",
  withdrawn: "shadow-[0_0_12px_-2px] shadow-state-withdrawn/50",
  assumed: "shadow-[0_0_12px_-2px] shadow-state-assumed/50",
};

export function StateBadge({ state, glow = true }: { state: ParcelState; glow?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
        COLOR[state],
        glow && GLOW[state],
      )}
    >
      {LABEL[state]}
    </span>
  );
}
