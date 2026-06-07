"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE = { md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-3xl" } as const;

/**
 * مودال عائم وسط الشاشة كاملةً — عبر بوّابة إلى body (يتجاوز أيّ transform/blur للسايدبار).
 * حركة سلسة + توهّج هولوكرامي (§هـ.3).
 */
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
  size?: keyof typeof SIZE;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
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
              "relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl",
              "border border-border/80 bg-gradient-to-b from-card to-card/85 shadow-2xl shadow-[0_0_60px_-12px] shadow-primary/30",
              SIZE[size],
            )}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <header className="flex items-center justify-between border-b border-border/70 bg-gradient-to-l from-primary/10 to-transparent p-4">
              <h3 className="text-base font-bold tracking-tight">{title}</h3>
              <button type="button" onClick={onClose} aria-label="إغلاق" className="rounded-md p-1 transition hover:bg-accent">
                <X className="size-4" />
              </button>
            </header>
            <div className="overflow-y-auto p-5">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
