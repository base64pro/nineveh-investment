// إشارات القطع (deck.gl IconLayer): مرساة زجاجية هولوكرامية تنبت من مركز القطعة —
// هالة طيف + قرص زجاجي ثلاثي الأبعاد ببريق ولمعة + إطار مزدوج + ساق إبري متدرّج + نقطة تثبيت متوهّجة.
// تُولَّد على المتصفّح (canvas) مرّة وتُخزَّن. الأبعاد والمرساة ثابتة → نفس الحجم والموضع على الخريطة.

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

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(hex: string, amt: number, toWhite: boolean): string {
  const [r, g, b] = rgb(hex);
  const t = toWhite ? 255 : 0;
  return `rgb(${Math.round(r + (t - r) * amt)}, ${Math.round(g + (t - g) * amt)}, ${Math.round(b + (t - b) * amt)})`;
}
function rgba(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function makePin(color: string): PinIcon {
  const W = 46;
  const H = 60;
  const dpr = 3; // أحدّ للشاشات عالية الكثافة
  const canvas = document.createElement("canvas");
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { url: "", width: W, height: H, anchorX: W / 2, anchorY: H, mask: false };
  ctx.scale(dpr, dpr);

  const cx = W / 2;
  const orbR = 12.5;
  const ring = 2.6;
  const orbCY = orbR + ring + 3; // مركز القرص أعلى الإشارة
  const tipY = H - 2.5; // نقطة التثبيت على القطعة

  const light = mix(color, 0.55, true);
  const lighter = mix(color, 0.78, true);
  const dark = mix(color, 0.4, false);

  // 1) هالة طيفية ناعمة حول القرص (توهّج هولوكرامي)
  const aura = ctx.createRadialGradient(cx, orbCY, orbR * 0.5, cx, orbCY, orbR + 8);
  aura.addColorStop(0, rgba(color, 0.42));
  aura.addColorStop(0.6, rgba(color, 0.16));
  aura.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(cx, orbCY, orbR + 8, 0, Math.PI * 2);
  ctx.fill();

  // 2) نقطة التثبيت على القطعة: ظلّ بيضوي + حلقة متوهّجة + لبّ مضيء (إحساس «مغروزة»)
  ctx.fillStyle = rgba(color, 0.32);
  ctx.beginPath();
  ctx.ellipse(cx, tipY + 0.5, 4.6, 1.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(color, 0.85);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.ellipse(cx, tipY, 3.1, 1.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, tipY, 1.25, 0, Math.PI * 2);
  ctx.fill();

  // 3) الساق الإبري المتدرّج (أعرض عند القرص، يدقّ نحو نقطة التثبيت) — حافتان بيضاوان ولبّ ملوّن
  const stemTop = orbCY + orbR - 1;
  const path = new Path2D();
  path.moveTo(cx - 2.6, stemTop);
  path.lineTo(cx + 2.6, stemTop);
  path.lineTo(cx + 1.0, tipY);
  path.lineTo(cx - 1.0, tipY);
  path.closePath();
  const stemGrad = ctx.createLinearGradient(0, stemTop, 0, tipY);
  stemGrad.addColorStop(0, "#ffffff");
  stemGrad.addColorStop(0.5, light);
  stemGrad.addColorStop(1, "#ffffff");
  ctx.fillStyle = stemGrad;
  ctx.fill(path);
  // خطّ بريق زجاجي على الساق
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx - 0.4, stemTop + 1);
  ctx.lineTo(cx - 0.2, tipY - 1);
  ctx.stroke();

  // 4) القرص الزجاجي: قاعدة متوهّجة ثم تدرّج كروي ثلاثي الأبعاد (إضاءة من أعلى-يسار)
  ctx.save();
  ctx.shadowColor = rgba(color, 0.9);
  ctx.shadowBlur = 8;
  const bead = ctx.createRadialGradient(cx - 4.5, orbCY - 5, 1, cx, orbCY + 2, orbR);
  bead.addColorStop(0, lighter);
  bead.addColorStop(0.42, light);
  bead.addColorStop(0.82, color);
  bead.addColorStop(1, dark);
  ctx.fillStyle = bead;
  ctx.beginPath();
  ctx.arc(cx, orbCY, orbR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 5) شريط بريق زجاجي علوي (انعكاس) — قوس مضيء أعلى القرص
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, orbCY, orbR, 0, Math.PI * 2);
  ctx.clip();
  const sheen = ctx.createLinearGradient(0, orbCY - orbR, 0, orbCY);
  sheen.addColorStop(0, "rgba(255,255,255,0.55)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.ellipse(cx, orbCY - orbR * 0.45, orbR * 0.72, orbR * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 6) لمعة نقطية حادّة (specular glint) أعلى-يسار
  const glint = ctx.createRadialGradient(cx - 4.2, orbCY - 4.6, 0, cx - 4.2, orbCY - 4.6, 3.2);
  glint.addColorStop(0, "rgba(255,255,255,0.95)");
  glint.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glint;
  ctx.beginPath();
  ctx.arc(cx - 4.2, orbCY - 4.6, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // 7) الإطار المزدوج الهولوكرامي: حلقة لونية لامعة خارجاً + حلقة بيضاء داخلها
  ctx.strokeStyle = rgba(color, 0.95);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(cx, orbCY, orbR + ring - 0.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = ring;
  ctx.beginPath();
  ctx.arc(cx, orbCY, orbR + ring / 2 - 0.2, 0, Math.PI * 2);
  ctx.stroke();

  // 8) حلقة عدسة داخلية خافتة (عمق)
  ctx.strokeStyle = rgba(dark, 0.5);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.arc(cx, orbCY, orbR - 2.4, 0, Math.PI * 2);
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
