// إشارات القطع (deck.gl IconLayer): ساق ينبت من مركز القطعة وفي قمّته قرص ثلاثي الأبعاد بلون الحالة.
// تُولَّد على المتصفّح (canvas) مرّة وتُخزَّن. حجم ثابت بالبكسل → ظاهرة من أبعد زوم.

export type PinIcon = {
  url: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  mask: false;
};

const STATE_HEX: Record<string, string> = {
  announced: "#C7A24E",
  "in-progress": "#5775A8",
  completed: "#5E977A",
  withdrawn: "#B5616A",
  assumed: "#8B6FB0",
};

function lighten(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 70);
  const g = Math.min(255, ((n >> 8) & 255) + 70);
  const b = Math.min(255, (n & 255) + 70);
  return `rgb(${r}, ${g}, ${b})`;
}

function makePin(color: string): PinIcon {
  const W = 46;
  const H = 60;
  const dpr = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { url: "", width: W, height: H, anchorX: W / 2, anchorY: H, mask: false };
  ctx.scale(dpr, dpr);
  const cx = W / 2;
  const ring = 3;
  const orbR = 13;
  const orbCY = orbR + ring + 2;
  // الساق الأبيض الواضح (يتّصل بالحلقة)
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, orbCY + orbR);
  ctx.lineTo(cx, H - 3);
  ctx.stroke();
  // اللبّ بلون النوع (تدرّج كروي ثلاثي الأبعاد) + توهّج
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 9;
  const grad = ctx.createRadialGradient(cx - 4, orbCY - 4, 1.5, cx, orbCY, orbR);
  grad.addColorStop(0, lighten(color));
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, orbCY, orbR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // الحلقة البيضاء تحاوط القرص بأناقة
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = ring;
  ctx.beginPath();
  ctx.arc(cx, orbCY, orbR + ring / 2, 0, Math.PI * 2);
  ctx.stroke();
  return { url: canvas.toDataURL(), width: W, height: H, anchorX: cx, anchorY: H, mask: false };
}

let cache: Record<string, PinIcon> | null = null;
export function getPinIcons(): Record<string, PinIcon> {
  if (cache) return cache;
  if (typeof document === "undefined") return {};
  cache = {};
  for (const [state, color] of Object.entries(STATE_HEX)) cache[state] = makePin(color);
  return cache;
}
