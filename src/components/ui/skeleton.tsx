import { cn } from "@/lib/utils";

/** مؤشّر تحميل سلس (§ز.1). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted/60", className)} />;
}
