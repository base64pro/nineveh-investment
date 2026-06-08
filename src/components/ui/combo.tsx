"use client";

// منسدلة أنيقة موحّدة (بتصميم FilterCombo) — للاختيار من قيم {value,label} مع تصفية وتنقّل لوحة المفاتيح.
// allowCustom: يسمح بكتابة قيمة حرّة (للحقول ذات الاقتراحات + الإدخال الحرّ بلا تأليف).

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboOption {
  value: string;
  label: string;
}

export function Combo({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  disabled = false,
  allowCustom = false,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ComboOption[];
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  allowCustom?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const currentLabel = useMemo(() => {
    const found = options.find((o) => o.value === value);
    if (found) return found.label;
    return allowCustom ? value : "";
  }, [options, value, allowCustom]);

  const list = useMemo(() => {
    if (!editing || draft.trim() === "") return options;
    const q = draft.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, editing, draft]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) commitClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, draft]);

  function commitClose() {
    if (editing && allowCustom) {
      const t = draft.trim();
      if (t !== "") onChange(t);
    }
    setOpen(false);
    setEditing(false);
  }

  function commit(v: string) {
    onChange(v);
    setOpen(false);
    setEditing(false);
  }

  function openAll() {
    if (disabled) return;
    setOpen(true);
    setEditing(false);
    setDraft("");
    setHighlight(0);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openAll();
      else setHighlight((h) => Math.min(h + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = list[highlight];
      if (sel) commit(sel.value);
      else if (allowCustom && draft.trim()) commit(draft.trim());
    } else if (e.key === "Escape") {
      setOpen(false);
      setEditing(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        value={editing ? draft : currentLabel}
        readOnly={!allowCustom}
        disabled={disabled}
        onChange={(e) => {
          if (!allowCustom) return;
          setDraft(e.target.value);
          setEditing(true);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={openAll}
        onClick={openAll}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        className={cn(
          "w-full rounded-lg border border-input bg-background/60 px-2 py-1.5 pe-6 text-sm outline-none transition focus:ring-2 focus:ring-ring disabled:cursor-default disabled:opacity-60",
          allowCustom ? "cursor-text" : "cursor-pointer",
        )}
      />
      <ChevronDown
        className={cn(
          "pointer-events-none absolute end-1.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground transition-transform duration-200",
          open && "rotate-180",
        )}
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
            {list.map((o, i) => {
              const selected = o.value === value;
              const active = i === highlight;
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(o.value);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 transition-colors",
                    active ? "bg-accent text-foreground" : "text-foreground/90",
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {selected ? <Check className="size-3.5 shrink-0 text-primary" /> : null}
                </li>
              );
            })}
            {list.length === 0 ? <li className="px-2.5 py-1.5 text-muted-foreground">لا تطابق</li> : null}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
