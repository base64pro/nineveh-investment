"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * حقل تصفية combobox أنيق: منسدلة منبثقة بالكامل عند كل نقرة (لا تتقلّص للعنصر المحدّد)،
 * خيار «الكل» دائماً، تصفية أثناء الكتابة فقط، تمرير رشيق وحركة سلسة، تنقّل بلوحة المفاتيح.
 */
export function FilterCombo({
  value,
  onChange,
  options,
  placeholder,
  allLabel = "الكل",
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // عند النقر/الفتح: كل الخيارات. أثناء الكتابة فقط: تصفية بالاحتواء.
  const list = useMemo(() => {
    const v = value.trim();
    if (!typing || v === "") return options;
    const lower = v.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(lower));
  }, [value, options, typing]);

  const items = useMemo(() => [allLabel, ...list], [allLabel, list]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function commit(v: string) {
    onChange(v);
    setOpen(false);
    setTyping(false);
  }

  function openAll() {
    setOpen(true);
    setTyping(false);
    setHighlight(0);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openAll();
      else setHighlight((h) => Math.min(h + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = items[highlight];
      if (sel !== undefined) commit(highlight === 0 ? "" : sel);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setTyping(true); setHighlight(0); }}
        onFocus={openAll}
        onClick={openAll}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        className="w-full rounded-lg border border-input bg-background/60 px-2 py-1.5 pe-6 outline-none transition focus:ring-2 focus:ring-ring"
      />
      <ChevronDown
        className={cn("pointer-events-none absolute end-1.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
        aria-hidden
      />
      <AnimatePresence>
        {open ? (
          <motion.ul
            id={listId}
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="scroll-slim absolute start-0 z-50 mt-1 max-h-56 w-full min-w-[9rem] overflow-y-auto rounded-lg border border-border/80 bg-popover/95 p-1 text-xs shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)] ring-1 ring-inset ring-foreground/5 backdrop-blur"
          >
            {items.map((label, i) => {
              const isAll = i === 0;
              const selected = isAll ? value.trim() === "" : value.trim() === label;
              const active = i === highlight;
              return (
                <li
                  key={isAll ? "__all__" : label}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => { e.preventDefault(); commit(isAll ? "" : label); }}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 transition-colors",
                    active ? "bg-accent text-foreground" : "text-foreground/90",
                    isAll && !active && "text-muted-foreground",
                  )}
                >
                  <span className="truncate">{label}</span>
                  {selected ? <Check className="size-3.5 shrink-0 text-primary" /> : null}
                </li>
              );
            })}
            {list.length === 0 ? (
              <li className="px-2.5 py-1.5 text-muted-foreground">لا تطابق</li>
            ) : null}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
