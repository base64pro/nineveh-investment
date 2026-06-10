"use client";

// عرض منسّق متقدّم لإجابات المستشار: عناوين · قوائم · غامق · **استشهادات مميَّزة** كرقائق.

import { Fragment, type ReactNode } from "react";
import { Scale } from "lucide-react";

// نمط الاستشهاد: (قانون/نظام/تعليمات) رقم/سنة [· المادة/م. رقم[/بند]]
const CITATION =
  /(?:قانون|نظام|تعليمات|تعليمة)\s+\d+\s*\/\s*\d+(?:\s*·?\s*(?:المادة|م\.?)\s*\d+(?:\s*\/\s*[^\s،.؛)]+)?)?/g;

function highlightCitations(text: string, kb: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = new RegExp(CITATION);
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(<Fragment key={`${kb}t${i}`}>{text.slice(last, m.index)}</Fragment>);
    out.push(
      <span
        key={`${kb}c${i}`}
        className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-primary/12 px-1.5 py-0.5 align-baseline text-[0.82em] font-semibold text-primary ring-1 ring-inset ring-primary/25"
      >
        <Scale className="size-3 shrink-0" />
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) out.push(<Fragment key={`${kb}t${i}`}>{text.slice(last)}</Fragment>);
  return out;
}

function inline(text: string, kb: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).flatMap<ReactNode>((s, i) =>
    s.startsWith("**") && s.endsWith("**")
      ? [
          <strong key={`${kb}b${i}`} className="font-bold text-foreground">
            {highlightCitations(s.slice(2, -2), `${kb}b${i}`)}
          </strong>,
        ]
      : highlightCitations(s, `${kb}s${i}`),
  );
}

export function AdvisorAnswer({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let k = 0;

  const flush = (): void => {
    if (!bullets.length) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={`u${k++}`} className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-foreground/90">
            <span className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-primary/60" />
            <span className="min-w-0">{inline(it, `u${k}i${i}`)}</span>
          </li>
        ))}
      </ul>,
    );
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const b = /^[-•*]\s+(.+)$/.exec(line);
    if (b) {
      bullets.push(b[1]!);
      continue;
    }
    flush();
    const headerBold = /^\*\*(.+?)\*\*:?$/.exec(line);
    const headerColon = line.endsWith(":") && line.length <= 48 && !line.includes("**");
    if (headerBold) {
      blocks.push(
        <p key={`h${k++}`} className="pt-0.5 text-sm font-bold text-primary/90">
          {highlightCitations(headerBold[1]!, `h${k}`)}
        </p>,
      );
    } else if (headerColon) {
      blocks.push(
        <p key={`h${k++}`} className="pt-0.5 text-sm font-bold text-primary/90">
          {inline(line, `h${k}`)}
        </p>,
      );
    } else {
      blocks.push(
        <p key={`p${k++}`} className="text-sm leading-relaxed text-foreground/90">
          {inline(line, `p${k}`)}
        </p>,
      );
    }
  }
  flush();

  return <div className="space-y-2.5">{blocks}</div>;
}
