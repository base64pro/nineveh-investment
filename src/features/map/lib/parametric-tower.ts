// م9.7.1ج · توليد برج سكني بارامتري واقعي (هندسة إجرائية) — مبنيّ على بحث النِّسب المعمارية.
// يُخرِج شبكتين: «الجسم» (أزرق غامق، مضاء — يقرأ ككتلة صلبة) و«النوافذ» (مربّعات سماوية منبعثة على الواجهات).
// الأبعاد بالمتر (محور Z رأسي)، مركزه (0,0) — يُرسى عند مركز القطعة. الارتفاع/الطوابق يُشتقّان تلقائياً من البصمة (ملاءمة).

export interface Mesh3 {
  positions: Float32Array;
  normals: Float32Array;
}
export interface TowerMeshes {
  body: Mesh3;
  windows: Mesh3;
  height: number;
}

const FLOOR_H = 3.2; // ارتفاع الطابق (م)
const PODIUM_H = 5.5; // بوديوم (أرضي/لوبي)
const ROOF_H = 4.5; // تتويج

function pushQuad(P: number[], N: number[], a: number[], b: number[], c: number[], d: number[], n: number[]): void {
  for (const v of [a, b, c, a, c, d]) {
    P.push(v[0]!, v[1]!, v[2]!);
    N.push(n[0]!, n[1]!, n[2]!);
  }
}

function pushBox(P: number[], N: number[], w: number, d: number, z0: number, z1: number): void {
  const x = w / 2;
  const y = d / 2;
  pushQuad(P, N, [-x, -y, z0], [x, -y, z0], [x, -y, z1], [-x, -y, z1], [0, -1, 0]);
  pushQuad(P, N, [x, -y, z0], [x, y, z0], [x, y, z1], [x, -y, z1], [1, 0, 0]);
  pushQuad(P, N, [x, y, z0], [-x, y, z0], [-x, y, z1], [x, y, z1], [0, 1, 0]);
  pushQuad(P, N, [-x, y, z0], [-x, -y, z0], [-x, -y, z1], [-x, y, z1], [-1, 0, 0]);
  pushQuad(P, N, [-x, -y, z1], [x, -y, z1], [x, y, z1], [-x, y, z1], [0, 0, 1]); // سقف
}

/** يولّد برجاً من بصمة w×d (متر). الارتفاع/الطوابق تلقائية (سلندرنس ~6، محدودة 28..110م). */
export function generateTower(wMeters: number, dMeters: number): TowerMeshes {
  const ref = Math.max(wMeters, dMeters);
  const totalH = Math.max(28, Math.min(110, ref * 6));
  const shaftTop = totalH - ROOF_H;
  const floors = Math.max(4, Math.floor((shaftTop - PODIUM_H) / FLOOR_H));
  const sw = wMeters;
  const sd = dMeters; // الجذع = البصمة
  const pw = wMeters * 1.08;
  const pd = dMeters * 1.08; // بوديوم أعرض قليلاً
  const cw = sw * 0.66;
  const cd = sd * 0.66; // تتويج أضيق

  const bP: number[] = [];
  const bN: number[] = [];
  pushBox(bP, bN, pw, pd, 0, PODIUM_H); // بوديوم
  pushBox(bP, bN, sw, sd, PODIUM_H, shaftTop); // الجذع
  pushBox(bP, bN, cw, cd, shaftTop, totalH); // تتويج

  // النوافذ: شبكة (أعمدة × طوابق) على وجوه الجذع الأربعة، مربّعات بارزة قليلاً.
  const wP: number[] = [];
  const wN: number[] = [];
  const out = 0.15;
  // along = "x" → الوجهان العموديّان على Y (يمتدّان على X بعرض sw)؛ "y" → العموديّان على X (يمتدّان على Y بعرض sd).
  const addWindows = (along: "x" | "y", sign: number): void => {
    const faceW = along === "x" ? sw : sd;
    const cols = Math.max(3, Math.round(faceW / 3.2));
    const cell = faceW / cols;
    const winW = cell * 0.58;
    const winH = FLOOR_H * 0.5;
    for (let c = 0; c < cols; c++) {
      const t = -faceW / 2 + (c + 0.5) * cell;
      for (let f = 0; f < floors; f++) {
        const z0 = PODIUM_H + f * FLOOR_H + (FLOOR_H - winH) / 2;
        const z1 = z0 + winH;
        if (along === "x") {
          const yy = sign * (sd / 2 + out);
          pushQuad(wP, wN, [t - winW / 2, yy, z0], [t + winW / 2, yy, z0], [t + winW / 2, yy, z1], [t - winW / 2, yy, z1], [0, sign, 0]);
        } else {
          const xx = sign * (sw / 2 + out);
          pushQuad(wP, wN, [xx, t - winW / 2, z0], [xx, t + winW / 2, z0], [xx, t + winW / 2, z1], [xx, t - winW / 2, z1], [sign, 0, 0]);
        }
      }
    }
  };
  addWindows("x", -1);
  addWindows("x", 1);
  addWindows("y", -1);
  addWindows("y", 1);

  return {
    body: { positions: new Float32Array(bP), normals: new Float32Array(bN) },
    windows: { positions: new Float32Array(wP), normals: new Float32Array(wN) },
    height: totalH,
  };
}

// م9.7.1هـ · حلقات أرضية متوهّجة منبعثة (deck) تنبعث من مركز البرج وتملأ القطعة — تُرسَم فوق الأرضية
// الهولوكرامية وتحت البرج، فتبدو واضحة بارزة على القمر الصناعي. مسطّحة على مستوى الأرض (z صغير فوق الأرضية).
export function generateGroundRings(maxRadius: number, count = 4): Mesh3 {
  const P: number[] = [];
  const N: number[] = [];
  const segs = 72; // نعومة الدائرة
  const z = 0.6; // فوق الأرضية قليلاً (يتفادى تنازع العمق مع الأرضية)
  const gap = maxRadius / count;
  const halfW = Math.max(0.45, gap * 0.16); // نصف سماكة شريط الحلقة (خطّ رفيع متوهّج)
  for (let i = 1; i <= count; i++) {
    const r = gap * i;
    const ri = r - halfW;
    const ro = r + halfW;
    for (let s = 0; s < segs; s++) {
      const a0 = (s / segs) * Math.PI * 2;
      const a1 = ((s + 1) / segs) * Math.PI * 2;
      const c0 = Math.cos(a0);
      const s0 = Math.sin(a0);
      const c1 = Math.cos(a1);
      const s1 = Math.sin(a1);
      pushQuad(P, N, [ri * c0, ri * s0, z], [ro * c0, ro * s0, z], [ro * c1, ro * s1, z], [ri * c1, ri * s1, z], [0, 0, 1]);
    }
  }
  return { positions: new Float32Array(P), normals: new Float32Array(N) };
}
