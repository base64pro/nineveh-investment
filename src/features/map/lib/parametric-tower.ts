// م9.7.1و+ · برج سكني بارامتري واقعي مودرن (هندسة إجرائية) — مُواءَم من تصاميم فيكتور حقيقية وبحث تصميم متقدّم.
// هولوكرامي لكن مُعتِم: هيكل فولاذي مضاء (تظليل 3D حقيقي) + زجاج أزرق منبعث بنغمتين + نوافذ مضيئة متناثرة
// (سماوية + قليل دافئ = حياة وتنوّع لوني) + حلقة تتويج مميِّزة. النبضات الأرضية تنتشر من قلبه نحو حدوده وهو فوقها.
// الأبعاد بالمتر (Z رأسي)، مركزه (0,0). الارتفاع/الطوابق يُلائَمان تلقائياً من البصمة.

export interface Mesh3 {
  positions: Float32Array;
  normals: Float32Array;
}
export interface TowerMeshes {
  body: Mesh3; // الهيكل (مضاء) — بوديوم/أعمدة/شُرفات/بارابيت/بنتهاوس
  glassA: Mesh3; // زجاج سماوي فاتح منبعث (نغمة 1)
  glassB: Mesh3; // زجاج أزرق غامق منبعث (نغمة 2) — تفاوت ألواح
  winCool: Mesh3; // نوافذ مضيئة سماوية متناثرة (حياة)
  winWarm: Mesh3; // نوافذ مضيئة دافئة قليلة (تنوّع لوني)
  accent: Mesh3; // حلقة/خطوط مميِّزة منبعثة (هوية)
  height: number;
}

type Buf = { P: number[]; N: number[] };
const buf = (): Buf => ({ P: [], N: [] });
const freeze = (b: Buf): Mesh3 => ({ positions: new Float32Array(b.P), normals: new Float32Array(b.N) });

const FLOOR_H = 3.3; // ارتفاع الطابق (م)
const PODIUM_H = 6.0; // بوديوم/لوبي
const ROOF_H = 6.5; // منطقة التتويج (بارابيت + بنتهاوس)
const PLINTH_H = 1.1; // قاعدة أرضية

function pushQuad(b: Buf, a: number[], bb: number[], c: number[], d: number[], n: number[]): void {
  for (const v of [a, bb, c, a, c, d]) {
    b.P.push(v[0]!, v[1]!, v[2]!);
    b.N.push(n[0]!, n[1]!, n[2]!);
  }
}

// صندوق محوريّ من (x0,y0,z0) إلى (x1,y1,z1) بأوجه اختيارية.
function box(b: Buf, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, opts?: { top?: boolean; bottom?: boolean; sides?: boolean }): void {
  const top = opts?.top ?? true;
  const bottom = opts?.bottom ?? true;
  const sides = opts?.sides ?? true;
  if (sides) {
    pushQuad(b, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]); // -y
    pushQuad(b, [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]); // +x
    pushQuad(b, [x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [0, 1, 0]); // +y
    pushQuad(b, [x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [-1, 0, 0]); // -x
  }
  if (top) pushQuad(b, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
  if (bottom) pushQuad(b, [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0], [0, 0, -1]);
}

// تجزئة شبه-عشوائية حتميّة (ثابتة لكل برج — لا وميض عند إعادة التوليد).
function hash2(i: number, j: number): number {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// يلحق محتوى محليّ (واجهة عند y=-perpHalf) بعد تدويره حول Z إلى أحد الأوجه الأربعة.
function rotateAppend(src: Buf, dst: Buf, deg: number): void {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  for (let i = 0; i < src.P.length; i += 3) {
    const x = src.P[i]!;
    const y = src.P[i + 1]!;
    dst.P.push(x * c - y * s, x * s + y * c, src.P[i + 2]!);
    const nx = src.N[i]!;
    const ny = src.N[i + 1]!;
    dst.N.push(nx * c - ny * s, nx * s + ny * c, src.N[i + 2]!);
  }
}

interface FaceBufs {
  body: Buf;
  gA: Buf;
  gB: Buf;
  winC: Buf;
  winW: Buf;
}

// يبني واجهة أماميّة (إطار محليّ: الوجه عند y=-perpHalf، يمتدّ على X بعرض faceW، نحو -Y):
// زجاج بنغمتين/طابق + مونتينات عموديّة + شُرفات بارزة بحاجز زجاجي + نوافذ مضيئة متناثرة.
function buildFace(faceW: number, perpHalf: number, z0: number, z1: number, seed: number, b: FaceBufs): void {
  const W2 = faceW / 2;
  const fy = -perpHalf; // مستوى الوجه
  const go = 0.05; // إزاحة الزجاج أمام الهيكل
  const floors = Math.max(4, Math.floor((z1 - z0) / FLOOR_H));
  const cols = Math.max(2, Math.round(faceW / 3.6));
  const cell = faceW / cols;
  const bx = W2 * 0.9; // عرض الشرفة (هامش زاوية يمنع التداخل)
  const balDepth = 0.95;

  for (let f = 0; f < floors; f++) {
    const fz0 = z0 + f * FLOOR_H;
    const fz1 = fz0 + FLOOR_H;
    const g = f % 2 === 0 ? b.gA : b.gB;
    // لوح الزجاج (وجه مستوٍ نحو -Y)
    pushQuad(g, [-W2, fy - go, fz0], [W2, fy - go, fz0], [W2, fy - go, fz1], [-W2, fy - go, fz1], [0, -1, 0]);
    // شرفة: بلاطة بارزة عند مستوى الطابق + حاجز زجاجي (نغمة متبادلة)
    box(b.body, -bx, bx, fy - balDepth, fy, fz0 - 0.14, fz0);
    const rg = f % 2 === 0 ? b.gB : b.gA;
    box(rg, -bx, bx, fy - balDepth - 0.05, fy - balDepth, fz0, fz0 + 1.0, { top: false, bottom: false });
    // نوافذ مضيئة متناثرة (في النطاق الرؤيوي فوق الحاجز): بعض الخلايا فقط، أغلبها سماوي وقليل دافئ.
    for (let c = 0; c < cols; c++) {
      if (hash2(f + 1, c + 1 + seed) >= 0.22) continue;
      const cx = -W2 + (c + 0.5) * cell;
      const warm = hash2(c + 2, f + 3 + seed) < 0.32;
      const wb = warm ? b.winW : b.winC;
      const ww = cell * 0.5;
      const wz0 = fz0 + FLOOR_H * 0.42;
      const wz1 = wz0 + FLOOR_H * 0.4;
      const yy = fy - go - 0.02; // بارزة قليلاً أمام الزجاج لتظهر
      pushQuad(wb, [cx - ww / 2, yy, wz0], [cx + ww / 2, yy, wz0], [cx + ww / 2, yy, wz1], [cx - ww / 2, yy, wz1], [0, -1, 0]);
    }
  }

  // مونتينات عموديّة (أعمدة هيكليّة رفيعة بارزة) على خطوط الأعمدة.
  for (let cI = 0; cI <= cols; cI++) {
    const x = -W2 + cI * cell;
    box(b.body, x - 0.13, x + 0.13, fy - 0.16, fy + 0.02, z0, z1, { top: false, bottom: false });
  }
}

/** يولّد برجاً مودرن واقعياً من بصمة w×d (متر). الارتفاع/الطوابق تلقائية (نحافة ~6.5، محدودة 30..150م). */
export function generateTower(wMeters: number, dMeters: number): TowerMeshes {
  const w = wMeters;
  const d = dMeters;
  const w2 = w / 2;
  const d2 = d / 2;
  const ref = Math.max(w, d);
  const totalH = Math.max(30, Math.min(150, ref * 6.5));
  const shaftTop = totalH - ROOF_H;
  const shaftZ0 = PODIUM_H;

  const body = buf();
  const gA = buf();
  const gB = buf();
  const winC = buf();
  const winW = buf();
  const accent = buf();

  // — القاعدة —
  box(body, -w2 * 1.18, w2 * 1.18, -d2 * 1.18, d2 * 1.18, 0, PLINTH_H); // بلِنث أرضي
  box(body, -w2 * 1.06, w2 * 1.06, -d2 * 1.06, d2 * 1.06, PLINTH_H, PODIUM_H); // بوديوم/لوبي
  box(gA, -w2 * 1.07, w2 * 1.07, -d2 * 1.07, d2 * 1.07, PLINTH_H + 0.9, PODIUM_H - 1.0, { top: false, bottom: false }); // زجاج اللوبي

  // — نواة جذع صلبة (تمنع الشفافية بين الأوجه) —
  box(body, -w2, w2, -d2, d2, shaftZ0, shaftTop);

  // — الواجهات الأربع —
  const front: FaceBufs = { body: buf(), gA: buf(), gB: buf(), winC: buf(), winW: buf() };
  buildFace(w, d2, shaftZ0, shaftTop, 0, front); // ±y (عرض = w)
  const side: FaceBufs = { body: buf(), gA: buf(), gB: buf(), winC: buf(), winW: buf() };
  buildFace(d, w2, shaftZ0, shaftTop, 50, side); // ±x (عرض = d)
  const place = (fb: FaceBufs, deg: number): void => {
    rotateAppend(fb.body, body, deg);
    rotateAppend(fb.gA, gA, deg);
    rotateAppend(fb.gB, gB, deg);
    rotateAppend(fb.winC, winC, deg);
    rotateAppend(fb.winW, winW, deg);
  };
  place(front, 0);
  place(front, 180);
  place(side, 90);
  place(side, 270);

  // — التتويج —
  box(accent, -w2 - 0.24, w2 + 0.24, -d2 - 0.24, d2 + 0.24, shaftTop - 1.6, shaftTop - 0.8, { top: false, bottom: false }); // حلقة مميِّزة
  box(body, -w2 - 0.12, w2 + 0.12, -d2 - 0.12, d2 + 0.12, shaftTop, shaftTop + 0.8); // بارابيت
  box(body, -w2 * 0.56, w2 * 0.56, -d2 * 0.56, d2 * 0.56, shaftTop + 0.8, totalH); // بنتهاوس ميكانيكي
  box(accent, -w2 * 0.58, w2 * 0.58, -d2 * 0.58, d2 * 0.58, totalH - 0.35, totalH, { top: false, bottom: false }); // خطّ تتويج متوهّج

  return {
    body: freeze(body),
    glassA: freeze(gA),
    glassB: freeze(gB),
    winCool: freeze(winC),
    winWarm: freeze(winW),
    accent: freeze(accent),
    height: totalH,
  };
}

// م9.7.1هـ · حلقات أرضية متوهّجة منبعثة تنبعث من مركز البرج وتملأ القطعة — فوق الأرضية وتحت البرج (بارزة على القمر الصناعي).
export function generateGroundRings(maxRadius: number, count = 4): Mesh3 {
  const P: number[] = [];
  const N: number[] = [];
  const segs = 72;
  const z = 0.6; // فوق الأرضية قليلاً (يتفادى تنازع العمق)
  const gap = maxRadius / count;
  const halfW = Math.max(0.45, gap * 0.16);
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
      P.push(ri * c0, ri * s0, z, ro * c0, ro * s0, z, ro * c1, ro * s1, z, ri * c0, ri * s0, z, ro * c1, ro * s1, z, ri * c1, ri * s1, z);
      for (let k = 0; k < 6; k++) N.push(0, 0, 1);
    }
  }
  return { positions: new Float32Array(P), normals: new Float32Array(N) };
}

// م9.7.1و+ · ظلّ تماسٍ أرضيّ مُخبوز (قرص داكن شفّاف ناعم) أسفل البرج، مُزاح عكس اتجاه الشمس = إيهام ظلّ مُلقى ثلاثيّ.
export function generateContactShadow(radius: number, offX = 0, offY = 0): Mesh3 {
  const P: number[] = [];
  const N: number[] = [];
  const segs = 48;
  const z = 0.08; // أسفل الحلقات (0.6)، فوق الأرضية
  const rx = radius;
  const ry = radius * 0.82; // إهليلج خفيف (اتجاه الظلّ)
  for (let s = 0; s < segs; s++) {
    const a0 = (s / segs) * Math.PI * 2;
    const a1 = ((s + 1) / segs) * Math.PI * 2;
    P.push(offX, offY, z, offX + rx * Math.cos(a0), offY + ry * Math.sin(a0), z, offX + rx * Math.cos(a1), offY + ry * Math.sin(a1), z);
    N.push(0, 0, 1, 0, 0, 1, 0, 0, 1);
  }
  return { positions: new Float32Array(P), normals: new Float32Array(N) };
}
