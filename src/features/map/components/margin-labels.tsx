"use client";

// م8.8 · بطاقات التسمية الهولوكرامية خارج حدود نينوى (§هـ.4): في العرض الواسع (كامل نينوى) لكلّ قطعة مرسومة
// خطّ قائد رفيع من مركزها إلى بطاقة زجاجية باسمها في هامش الخريطة، موزّعة على الجوانب الأربعة بلا تداخل
// (تكديس بتباعد ثابت يُضغط عند الكثرة)، تتلاشى بالزوم إن (تسليم نظيف لتسميات الدبوس القريبة).
// النقر = طيران للقطعة + فتح نافذتها (يُدار في investment-map).

import type { ParcelKind } from "../lib/map-nav-store";

export const MCARD_W = 126;
export const MCARD_H = 26;
const GAP = 12; // مسافة البطاقة عن حافة صندوق نينوى المُسقَط
const PAD = 8; // هامش أدنى عن حافة الشاشة

export interface MarginCand {
  key: string;
  name: string;
  kind: ParcelKind;
  entityId: string;
  lng: number;
  lat: number;
  ax: number; // مركز القطعة المُسقَط (x)
  ay: number;
}
export interface MarginItem extends MarginCand {
  cardX: number;
  cardY: number;
  side: "l" | "r" | "t" | "b";
}
export interface ScreenBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** توزيع البطاقات على الجوانب الأربعة (حسب زاوية المركز عن مركز نينوى)، وتكديس مرتّب بلا تداخل لكل جهة. */
export function layoutMarginLabels(cands: MarginCand[], box: ScreenBox, W: number, H: number): MarginItem[] {
  if (!cands.length) return [];
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const groups: Record<"l" | "r" | "t" | "b", MarginCand[]> = { l: [], r: [], t: [], b: [] };
  for (const c of cands) {
    const a = Math.atan2(c.ay - cy, c.ax - cx); // x→يمين · y→أسفل
    const side =
      a >= -Math.PI / 4 && a < Math.PI / 4 ? "r" : a >= Math.PI / 4 && a < (3 * Math.PI) / 4 ? "b" : a >= (-3 * Math.PI) / 4 && a < -Math.PI / 4 ? "t" : "l";
    groups[side].push(c);
  }
  const out: MarginItem[] = [];

  // الجانبان الرأسيان (يسار/يمين): تكديس عمودي مرتّب بالـay
  const availH = Math.max(MCARD_H, H - 2 * PAD);
  const vCap = Math.max(1, Math.floor(availH / (MCARD_H + 6)));
  for (const side of ["l", "r"] as const) {
    let arr = groups[side].slice().sort((p, q) => p.ay - q.ay);
    if (arr.length > vCap) arr = arr.slice(0, vCap); // كبح عند تجاوز السعة (تبقى الدبابيس/النبضات)
    const n = arr.length;
    if (!n) continue;
    const slot = Math.min(MCARD_H + 10, availH / n); // يُضغط التباعد عند الكثرة
    const startY = Math.max(PAD, Math.min(cy - (slot * n) / 2, H - PAD - slot * n));
    const cardX = side === "l" ? Math.max(4, box.minX - GAP - MCARD_W) : Math.min(W - MCARD_W - 4, box.maxX + GAP);
    arr.forEach((c, i) => out.push({ ...c, cardX, cardY: Math.round(startY + i * slot), side }));
  }

  // الجانبان الأفقيان (أعلى/أسفل): تكديس أفقي مرتّب بالـax
  const availW = Math.max(MCARD_W, W - 2 * PAD);
  const hCap = Math.max(1, Math.floor(availW / (MCARD_W + 6)));
  for (const side of ["t", "b"] as const) {
    let arr = groups[side].slice().sort((p, q) => p.ax - q.ax);
    if (arr.length > hCap) arr = arr.slice(0, hCap);
    const n = arr.length;
    if (!n) continue;
    const slot = Math.min(MCARD_W + 12, availW / n);
    const startX = Math.max(PAD, Math.min(cx - (slot * n) / 2, W - PAD - slot * n));
    const cardY = side === "t" ? Math.max(PAD, box.minY - GAP - MCARD_H) : Math.min(H - MCARD_H - PAD, box.maxY + GAP);
    arr.forEach((c, i) => out.push({ ...c, cardX: Math.round(startX + i * slot), cardY, side }));
  }
  return out;
}

function leaderPath(it: MarginItem): string {
  const { ax, ay, cardX, cardY } = it;
  const midY = cardY + MCARD_H / 2;
  const midX = cardX + MCARD_W / 2;
  if (it.side === "l") {
    const ex = cardX + MCARD_W;
    const e = (ax + ex) / 2;
    return `M ${ax} ${ay} L ${e} ${ay} L ${e} ${midY} L ${ex} ${midY}`;
  }
  if (it.side === "r") {
    const ex = cardX;
    const e = (ax + ex) / 2;
    return `M ${ax} ${ay} L ${e} ${ay} L ${e} ${midY} L ${ex} ${midY}`;
  }
  if (it.side === "t") {
    const ey = cardY + MCARD_H;
    const e = (ay + ey) / 2;
    return `M ${ax} ${ay} L ${ax} ${e} L ${midX} ${e} L ${midX} ${ey}`;
  }
  const ey = cardY;
  const e = (ay + ey) / 2;
  return `M ${ax} ${ay} L ${ax} ${e} L ${midX} ${e} L ${midX} ${ey}`;
}

export function MarginLabels({ items, opacity, onOpen }: { items: MarginItem[]; opacity: number; onOpen: (it: MarginItem) => void }) {
  if (!items.length || opacity <= 0.01) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[12] overflow-hidden" style={{ opacity }}>
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full overflow-visible">
        {items.map((it) => (
          <path
            key={`ln-${it.key}`}
            d={leaderPath(it)}
            fill="none"
            stroke="rgba(159,192,232,0.55)"
            strokeWidth="1.2"
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 3px rgba(159,192,232,0.5))" }}
          />
        ))}
        {items.map((it) => (
          <circle key={`d-${it.key}`} cx={it.ax} cy={it.ay} r={2.6} fill="#9fc0e8" style={{ filter: "drop-shadow(0 0 4px #9fc0e8)" }} />
        ))}
      </svg>
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          data-sfx="off"
          onClick={() => onOpen(it)}
          title={it.name}
          className="pointer-events-auto absolute flex items-center overflow-hidden rounded-full border border-[rgba(159,192,232,0.5)] bg-[hsl(221_42%_10%/0.85)] px-2.5 text-[10px] font-semibold text-[#dbe7fb] shadow-[0_5px_16px_-5px_rgba(0,0,0,0.85),0_0_14px_-5px_rgba(148,175,209,0.75)] ring-1 ring-inset ring-white/10 backdrop-blur-md transition hover:border-[rgba(159,192,232,0.95)] hover:bg-[hsl(221_42%_13%/0.92)] active:scale-95"
          style={{ left: it.cardX, top: it.cardY, width: MCARD_W, height: MCARD_H }}
        >
          <span className="truncate">{it.name}</span>
        </button>
      ))}
    </div>
  );
}
