"use client";

import { type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** مودال عائم وسط الشاشة — حركة سلسة + توهّج هولوكرامي (§هـ.3). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className={cn(
              "relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-xl",
              "border border-border bg-gradient-to-b from-card to-card/85 shadow-2xl shadow-[0_0_48px_-12px] shadow-primary/30",
              size === "lg" ? "max-w-2xl" : "max-w-lg",
            )}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <header className="flex items-center justify-between border-b border-border/70 p-4">
              <h3 className="text-base font-bold tracking-tight">{title}</h3>
              <button type="button" onClick={onClose} aria-label="إغلاق" className="rounded-md p-1 transition hover:bg-accent">
                <X className="size-4" />
              </button>
            </header>
            <div className="overflow-y-auto p-4">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
