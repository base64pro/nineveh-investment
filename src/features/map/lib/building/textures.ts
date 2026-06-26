// م9.8 (الأساس البصريّ) · خامات إجرائيّة (Canvas) — حتميّة، تُولَّد مرّة وتُخبّأ كـdataURL، عميل فقط.
// تُضاعَف بلون القناة وإضاءتها في SimpleMeshLayer (لذا الأساس فاتح ~أبيض والتفاصيل أغمق = مفاصل/شبكات/خطوط).
// كلّها قابلة للتبليط (seamless) لتتكرّر بسلاسة عبر إحداثيّات UV (إسقاط ثلاثيّ المحاور في freeze).
const cache = new Map<string, string>();
const S = 256;

function build(name: string, draw: (ctx: CanvasRenderingContext2D) => void): string | undefined {
  if (typeof document === "undefined") return undefined; // SSR — لا خامات على الخادم
  const hit = cache.get(name);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext("2d");
  if (!ctx) return undefined;
  draw(ctx);
  const url = cv.toDataURL();
  cache.set(name, url);
  return url;
}

// تجزئة حتميّة بسيطة [0,1) (لا Math.random — نمط ثابت بين الجلسات).
const h = (i: number, j: number): number => {
  const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** خامة واجهة بأساس **أبيض** (تحفظ لون القناة عند الضرب) + نوافذ بمونتينات داكنة + فواصل طوابق — لا تُرمّد اللون. */
function drawFacade(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#ffffff"; // أبيض = يحفظ لون الهيكل كاملاً
  ctx.fillRect(0, 0, S, S);
  const cols = 4;
  const rows = 4;
  const cw = S / cols;
  const rh = S / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = "rgba(150,180,205,0.5)"; // لوح زجاج (مزرقّ خفيف يضرب لون القناة)
      ctx.fillRect(c * cw + 5, r * rh + 6, cw - 10, rh - 12);
    }
  }
  ctx.strokeStyle = "rgba(40,46,58,0.7)"; // مونتينات داكنة واضحة
  ctx.lineWidth = 4;
  for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(c * cw, 0); ctx.lineTo(c * cw, S); ctx.stroke(); }
  ctx.lineWidth = 5;
  for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * rh); ctx.lineTo(S, r * rh); ctx.stroke(); } // فواصل طوابق داكنة
}

/** خامة زجاج: قاعدة ساطعة + خطوط انعكاس عموديّة + فواصل طوابق أفقيّة خفيفة. */
function drawGlass(ctx: CanvasRenderingContext2D): void {
  const grd = ctx.createLinearGradient(0, 0, S, 0);
  grd.addColorStop(0, "#eef6fb");
  grd.addColorStop(0.5, "#ffffff");
  grd.addColorStop(1, "#e6f0f8");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 6;
  for (let k = 0; k < 5; k++) { const x = (k + 0.5) * (S / 5) + h(k, 3) * 10; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke(); } // انعكاسات عموديّة
  ctx.strokeStyle = "rgba(150,170,190,0.35)";
  ctx.lineWidth = 1.5;
  for (let r = 1; r < 4; r++) { ctx.beginPath(); ctx.moveTo(0, r * (S / 4)); ctx.lineTo(S, r * (S / 4)); ctx.stroke(); } // فواصل طوابق
}

/** خامة بلاط بورسلين أبيض لامع: بلاطات بيضاء كبيرة + مفاصل دقيقة واضحة + بريق قطريّ قويّ. */
function drawTile(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, S, S);
  const n = 3; // بلاطات أكبر (أنظف)
  const tw = S / n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const g = 248 + Math.round(h(r + 1, c + 1) * 7);
      ctx.fillStyle = `rgb(${g},${g},${Math.min(255, g + 1)})`;
      ctx.fillRect(c * tw + 1, r * tw + 1, tw - 2, tw - 2); // بلاطة بيضاء
    }
  }
  ctx.strokeStyle = "rgba(150,152,156,0.6)"; // مفاصل واضحة دقيقة
  ctx.lineWidth = 2;
  for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(i * tw, 0); ctx.lineTo(i * tw, S); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * tw); ctx.lineTo(S, i * tw); ctx.stroke(); }
  const gl = ctx.createLinearGradient(0, 0, S, S);
  gl.addColorStop(0, "rgba(255,255,255,0.3)");
  gl.addColorStop(0.5, "rgba(245,248,252,0)");
  gl.addColorStop(1, "rgba(255,255,255,0.22)");
  ctx.fillStyle = gl;
  ctx.fillRect(0, 0, S, S); // بريق قويّ
}

/** خامة معدن مصقول: قاعدة رماديّة فاتحة + خطوط فرشاة أفقيّة دقيقة. */
function drawMetal(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#dfe3e8";
  ctx.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 2) {
    const g = 210 + Math.round(h(y, 1) * 38);
    ctx.strokeStyle = `rgba(${g},${g},${g + 4},0.5)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(S, y + 0.5);
    ctx.stroke();
  }
}

/** خامة أسفلت: قاعدة فاتحة (لتضاعف بلون الأسفلت الداكن) + نثار حبيبيّ حتميّ. */
function drawAsphalt(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#e6e6e6";
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i++) {
    const x = h(i, 1) * S;
    const y = h(i, 2) * S;
    const g = 150 + Math.round(h(i, 3) * 80);
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.fillRect(x, y, 1.4, 1.4); // حبيبة
  }
}

const DRAW: Record<string, (ctx: CanvasRenderingContext2D) => void> = {
  facade: drawFacade,
  glass: drawGlass,
  tile: drawTile,
  metal: drawMetal,
  asphalt: drawAsphalt,
};

/** يُعيد dataURL لخامة إجرائيّة مخبّأة (أو undefined على الخادم/خامة مجهولة). */
export function getTexture(name: string): string | undefined {
  const draw = DRAW[name];
  if (!draw) return undefined;
  return build(name, draw);
}
