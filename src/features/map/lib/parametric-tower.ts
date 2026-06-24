// م9.7.1و+ · برج سكني بارامتري واقعي مودرن (هندسة إجرائية) — مُواءَم من تصاميم فيكتور حقيقية وبحث تصميم متقدّم.
// هولوكرامي لكن مُعتِم: هيكل فولاذي مضاء (تظليل 3D حقيقي) + زجاج أزرق منبعث بنغمتين + نوافذ مضيئة متناثرة
// (سماوية + قليل دافئ = حياة وتنوّع لوني) + حلقة تتويج مميِّزة. النبضات الأرضية تنتشر من قلبه نحو حدوده وهو فوقها.
// الأبعاد بالمتر (Z رأسي)، مركزه (0,0). الارتفاع/الطوابق يُلائَمان تلقائياً من البصمة.

export interface Mesh3 {
  positions: Float32Array;
  normals: Float32Array;
}
// م9.7.3 · «ملحق» = شبكة مرفق/عنصر إضافي بلونه وخامته (باركات/حدائق/أشجار/قبّة...) — تُرسَم بطبقة مستقلّة.
export interface Extra {
  mesh: Mesh3;
  color: [number, number, number, number];
  lit: boolean; // مضاء (تظليل) أو منبعث (توهّج)
}
export interface TowerMeshes {
  body: Mesh3; // الهيكل (مضاء) — بوديوم/أعمدة/شُرفات/بارابيت/بنتهاوس
  glassA: Mesh3; // زجاج سماوي فاتح منبعث (نغمة 1)
  glassB: Mesh3; // زجاج أزرق غامق منبعث (نغمة 2) — تفاوت ألواح
  winCool: Mesh3; // نوافذ مضيئة سماوية متناثرة (حياة)
  winWarm: Mesh3; // نوافذ مضيئة دافئة قليلة (تنوّع لوني)
  accent: Mesh3; // حلقة/خطوط مميِّزة منبعثة (هوية)
  extras?: Extra[]; // م9.7.3 · مرافق وملحقات (لكلّ نوع) — باركات/حدائق/أشجار/قبّة/ساحة...
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

// م9.7.3 · مكوّنات منحنية/مرافق — رباعيّ بنواظم لكلّ رأس (سطح ناعم).
function pushQuadVN(b: Buf, v: number[][], n: number[][]): void {
  for (const i of [0, 1, 2, 0, 2, 3]) {
    b.P.push(v[i]![0]!, v[i]![1]!, v[i]![2]!);
    b.N.push(n[i]![0]!, n[i]![1]!, n[i]![2]!);
  }
}
/** أسطوانة رأسية ناعمة (نواظم شعاعيّة) — جذوع/أعمدة/سواري. */
function cylinder(b: Buf, cx: number, cy: number, r: number, z0: number, z1: number, seg = 9): void {
  for (let s = 0; s < seg; s++) {
    const a0 = (s / seg) * Math.PI * 2;
    const a1 = ((s + 1) / seg) * Math.PI * 2;
    const c0 = Math.cos(a0);
    const s0 = Math.sin(a0);
    const c1 = Math.cos(a1);
    const s1 = Math.sin(a1);
    pushQuadVN(
      b,
      [[cx + r * c0, cy + r * s0, z0], [cx + r * c1, cy + r * s1, z0], [cx + r * c1, cy + r * s1, z1], [cx + r * c0, cy + r * s0, z1]],
      [[c0, s0, 0], [c1, s1, 0], [c1, s1, 0], [c0, s0, 0]],
    );
  }
}
/** مخروط (تاج شجرة). */
function cone(b: Buf, cx: number, cy: number, r: number, z0: number, z1: number, seg = 8): void {
  for (let s = 0; s < seg; s++) {
    const a0 = (s / seg) * Math.PI * 2;
    const a1 = ((s + 1) / seg) * Math.PI * 2;
    const c0 = Math.cos(a0);
    const s0 = Math.sin(a0);
    const c1 = Math.cos(a1);
    const s1 = Math.sin(a1);
    b.P.push(cx + r * c0, cy + r * s0, z0, cx + r * c1, cy + r * s1, z0, cx, cy, z1);
    for (let k = 0; k < 3; k++) b.N.push((c0 + c1) * 0.4, (s0 + s1) * 0.4, 0.5);
  }
}
/** شجرة (جذع + تاجان مخروطيّان) في خانتي الخامة الممرَّرتين. */
function tree(trunk: Buf, crown: Buf, cx: number, cy: number, h: number): void {
  cylinder(trunk, cx, cy, h * 0.06, 0, h * 0.42, 6);
  cone(crown, cx, cy, h * 0.32, h * 0.34, h * 0.82, 8);
  cone(crown, cx, cy, h * 0.24, h * 0.66, h, 8);
}
/** قبو زجاجيّ (أتريوم) — قوس ممدّد على X بنُعومة شعاعيّة. */
function barrelVault(b: Buf, cx: number, cy: number, lenX: number, halfW: number, baseZ: number, riseH: number, segs = 16): void {
  const x0 = cx - lenX / 2;
  const x1 = cx + lenX / 2;
  const pt = (t: number) => {
    const th = Math.PI * t;
    return { y: cy + halfW * Math.cos(th), z: baseZ + riseH * Math.sin(th), ny: Math.cos(th), nz: Math.sin(th) };
  };
  for (let i = 0; i < segs; i++) {
    const A = pt(i / segs);
    const B = pt((i + 1) / segs);
    pushQuadVN(b, [[x0, A.y, A.z], [x1, A.y, A.z], [x1, B.y, B.z], [x0, B.y, B.z]], [[0, A.ny, A.nz], [0, A.ny, A.nz], [0, B.ny, B.nz], [0, B.ny, B.nz]]);
  }
}
/** موقف سيّارات: بلاطات أفقيّة بصفوف وممرّات ضمن مستطيل. */
function parkingLot(b: Buf, x0: number, x1: number, y0: number, y1: number): void {
  const stallW = 2.7;
  const stallL = 5.0;
  const aisle = 6.0;
  const z = 0.06;
  for (let y = y0; y + stallL <= y1; y += stallL + aisle) {
    for (let x = x0; x + stallW <= x1; x += stallW) {
      pushQuad(b, [x + 0.12, y + 0.12, z], [x + stallW - 0.12, y + 0.12, z], [x + stallW - 0.12, y + stallL - 0.2, z], [x + 0.12, y + stallL - 0.2, z], [0, 0, 1]);
    }
  }
}
/** رقعة مستلقية (عشب/ساحة). */
function flatRect(b: Buf, x0: number, x1: number, y0: number, y1: number, z = 0.04): void {
  pushQuad(b, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, 1]);
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
  const bx = W2 * 0.92; // عرض الشرفة (هامش زاوية يمنع التداخل)
  const balDepth = 1.35; // عمق الشرفة (بارزة وواضحة)

  for (let f = 0; f < floors; f++) {
    const fz0 = z0 + f * FLOOR_H;
    const fz1 = fz0 + FLOOR_H;
    const g = f % 2 === 0 ? b.gA : b.gB;
    // لوح الزجاج (وجه مستوٍ نحو -Y)
    pushQuad(g, [-W2, fy - go, fz0], [W2, fy - go, fz0], [W2, fy - go, fz1], [-W2, fy - go, fz1], [0, -1, 0]);
    // شرفة بارزة: بلاطة سميكة عند مستوى الطابق + جانبان + حاجز زجاجي (نغمة متبادلة)
    box(b.body, -bx, bx, fy - balDepth, fy, fz0 - 0.18, fz0);
    const rg = f % 2 === 0 ? b.gB : b.gA;
    box(rg, -bx, bx, fy - balDepth - 0.05, fy - balDepth, fz0, fz0 + 1.1, { top: false, bottom: false });
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

/** يولّد برجاً مودرن واقعياً ذا نكسة علويّة من بصمة w×d (متر). المقياس واقعيّ يلائم محيط الخريطة (لا عملقة): نحافة ~3، محدود 24..62م. */
export function generateTower(wMeters: number, dMeters: number): TowerMeshes {
  const w = wMeters;
  const d = dMeters;
  const w2 = w / 2;
  const d2 = d / 2;
  const ref = Math.max(w, d);
  const totalH = Math.max(64, Math.min(150, ref * 5.5)); // برج كبير بطوابق كثيرة (نحيف مرتفع) — لائق بمعلَم استثماريّ
  const shaftTop = totalH - ROOF_H;
  const shaftZ0 = PODIUM_H;
  const setZ = shaftZ0 + (shaftTop - shaftZ0) * 0.7; // ارتفاع النكسة (الطابق العلوي أضيق)
  const uw = w * 0.8;
  const ud = d * 0.8;
  const uw2 = uw / 2;
  const ud2 = ud / 2;

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

  // — نواتا الجذع الصلبتان (سفليّة عريضة + علويّة أضيق = نكسة مودرن) —
  box(body, -w2, w2, -d2, d2, shaftZ0, setZ);
  box(body, -uw2, uw2, -ud2, ud2, setZ, shaftTop);
  // حاجز شرفة السطح المنكوس (زجاجيّ حول حافة الطابق السفليّ المكشوفة)
  box(gA, -w2, w2, -d2, d2, setZ, setZ + 1.0, { top: false, bottom: false });

  const place = (fb: FaceBufs, deg: number): void => {
    rotateAppend(fb.body, body, deg);
    rotateAppend(fb.gA, gA, deg);
    rotateAppend(fb.gB, gB, deg);
    rotateAppend(fb.winC, winC, deg);
    rotateAppend(fb.winW, winW, deg);
  };
  // — الطابق السفليّ (عريض) —
  const lf: FaceBufs = { body: buf(), gA: buf(), gB: buf(), winC: buf(), winW: buf() };
  buildFace(w, d2, shaftZ0, setZ, 0, lf);
  const ls: FaceBufs = { body: buf(), gA: buf(), gB: buf(), winC: buf(), winW: buf() };
  buildFace(d, w2, shaftZ0, setZ, 50, ls);
  place(lf, 0);
  place(lf, 180);
  place(ls, 90);
  place(ls, 270);
  // — الطابق العلويّ (أضيق) —
  const uf: FaceBufs = { body: buf(), gA: buf(), gB: buf(), winC: buf(), winW: buf() };
  buildFace(uw, ud2, setZ + 1.0, shaftTop, 17, uf);
  const us: FaceBufs = { body: buf(), gA: buf(), gB: buf(), winC: buf(), winW: buf() };
  buildFace(ud, uw2, setZ + 1.0, shaftTop, 67, us);
  place(uf, 0);
  place(uf, 180);
  place(us, 90);
  place(us, 270);

  // — التتويج (على الطابق العلويّ الأضيق) —
  box(accent, -uw2 - 0.24, uw2 + 0.24, -ud2 - 0.24, ud2 + 0.24, shaftTop - 1.6, shaftTop - 0.8, { top: false, bottom: false }); // حلقة مميِّزة
  box(body, -uw2 - 0.12, uw2 + 0.12, -ud2 - 0.12, ud2 + 0.12, shaftTop, shaftTop + 0.7); // بارابيت
  box(body, -uw2 * 0.56, uw2 * 0.56, -ud2 * 0.56, ud2 * 0.56, shaftTop + 0.7, totalH); // بنتهاوس ميكانيكي
  box(accent, -uw2 * 0.58, uw2 * 0.58, -ud2 * 0.58, ud2 * 0.58, totalH - 0.35, totalH, { top: false, bottom: false }); // خطّ تتويج متوهّج

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

// واجهة مول: دعامات صلبة (body) + ستورفرونت زجاجيّ أرضيّ مجزّأ + نوافذ مثقوبة علويّة (لا زجاج كاسح) + بعض الواجهات المضيئة.
function buildMallFace(faceW: number, perpHalf: number, levels: number, lh: number, baseH: number, b: FaceBufs): void {
  const W2 = faceW / 2;
  const fy = -perpHalf;
  const cols = Math.max(3, Math.round(faceW / 7));
  const cell = faceW / cols;
  // دعامات عموديّة صلبة على خطوط الأعمدة (تكسر الزجاج فلا يبدو صندوقاً)
  for (let c = 0; c <= cols; c++) {
    const x = -W2 + c * cell;
    box(b.body, x - 0.3, x + 0.3, fy - 0.14, fy + 0.02, 0.9, baseH, { top: false, bottom: false });
  }
  for (let c = 0; c < cols; c++) {
    const cx = -W2 + (c + 0.5) * cell;
    // ستورفرونت زجاجيّ أرضيّ بين الدعامات
    pushQuad(b.gA, [cx - cell * 0.38, fy - 0.05, 1.1], [cx + cell * 0.38, fy - 0.05, 1.1], [cx + cell * 0.38, fy - 0.05, 0.9 + lh - 0.7], [cx - cell * 0.38, fy - 0.05, 0.9 + lh - 0.7], [0, -1, 0]);
    if (hash2(c + 1, Math.round(perpHalf)) < 0.45) pushQuad(b.winW, [cx - cell * 0.3, fy - 0.07, 1.5], [cx + cell * 0.3, fy - 0.07, 1.5], [cx + cell * 0.3, fy - 0.07, 0.9 + lh - 1.1], [cx - cell * 0.3, fy - 0.07, 0.9 + lh - 1.1], [0, -1, 0]); // فاترينة مضيئة
    // نوافذ مثقوبة علويّة (لكل مستوى) — زجاج محدود لا كاسح
    for (let L = 1; L < levels; L++) {
      const z0 = 0.9 + L * lh + 0.7;
      const z1 = 0.9 + (L + 1) * lh - 1.0;
      pushQuad(b.gB, [cx - cell * 0.3, fy - 0.04, z0], [cx + cell * 0.3, fy - 0.04, z0], [cx + cell * 0.3, fy - 0.04, z1], [cx - cell * 0.3, fy - 0.04, z1], [0, -1, 0]);
    }
  }
}

// م9.7.3 · مول واقعيّ متمايز: كتلة منخفضة عريضة + ستورفرونت + أحزمة لافتات + **قبو زجاجيّ (أتريوم) متوهّج**
// + مرافق حول المبنى ضمن القطعة: **باركات + حدائق + أشجار**. (w,d = بصمة المبنى؛ المرافق تمتدّ حولها.)
export function generateMall(w: number, d: number): TowerMeshes {
  w = Math.min(w, 115); // بصمة مبنى المول (منخفض عريض)
  d = Math.min(d, 95);
  const w2 = w / 2;
  const d2 = d / 2;
  const LH = 5.0;
  const LEVELS = 3;
  const baseH = LEVELS * LH; // ~15م
  const body = buf();
  const gA = buf();
  const gB = buf();
  const winC = buf();
  const winW = buf();
  const accent = buf();

  box(body, -w2 * 1.03, w2 * 1.03, -d2 * 1.03, d2 * 1.03, 0, 0.9); // قاعدة
  box(body, -w2, w2, -d2, d2, 0.9, baseH); // الكتلة الصلبة الرئيسة

  const place = (fb: FaceBufs, deg: number): void => {
    rotateAppend(fb.body, body, deg);
    rotateAppend(fb.gA, gA, deg);
    rotateAppend(fb.gB, gB, deg);
    rotateAppend(fb.winC, winC, deg);
    rotateAppend(fb.winW, winW, deg);
  };
  const lf: FaceBufs = { body: buf(), gA: buf(), gB: buf(), winC: buf(), winW: buf() };
  buildMallFace(w, d2, LEVELS, LH, baseH, lf);
  const ls: FaceBufs = { body: buf(), gA: buf(), gB: buf(), winC: buf(), winW: buf() };
  buildMallFace(d, w2, LEVELS, LH, baseH, ls);
  place(lf, 0);
  place(lf, 180);
  place(ls, 90);
  place(ls, 270);

  for (let L = 1; L < LEVELS; L++) {
    const z = 0.9 + L * LH;
    box(accent, -w2 - 0.08, w2 + 0.08, -d2 - 0.08, d2 + 0.08, z - 0.3, z + 0.02, { top: false, bottom: false }); // أحزمة لافتات
  }
  // مدخل + مظلّة متوهّجة (على -y)
  const ew = w * 0.16;
  box(gA, -ew, ew, -d2 - 3.4, -d2 + 0.2, 0.9, baseH * 0.86, { bottom: false });
  box(accent, -ew - 0.45, ew + 0.45, -d2 - 3.8, -d2, baseH * 0.5, baseH * 0.55, { top: false, bottom: false });
  box(body, -w2 - 0.12, w2 + 0.12, -d2 - 0.12, d2 + 0.12, baseH, baseH + 0.8); // بارابيت

  // — المرافق (extras): قبو زجاجيّ + باركات + حدائق + أشجار حول المبنى —
  const sx = w2 * 1.7; // نصف امتداد الموقع
  const sy = d2 * 1.7;
  const dome = buf();
  barrelVault(dome, 0, 0, w * 0.5, d * 0.2, baseH + 0.4, 7.5, 18); // أتريوم مركزيّ
  const parking = buf();
  parkingLot(parking, -w2 * 0.96, w2 * 0.96, -sy, -d2 - 4); // باركات أمام
  parkingLot(parking, -w2 * 0.96, w2 * 0.96, d2 + 4, sy); // باركات خلف
  const lawn = buf();
  flatRect(lawn, -sx, -w2 - 3, -sy, sy); // حديقة يسار
  flatRect(lawn, w2 + 3, sx, -sy, sy); // حديقة يمين
  const trunk = buf();
  const crown = buf();
  for (let i = 0; i < 12; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const tx = side * (w2 + 3 + (sx - w2 - 3) * (0.2 + 0.6 * hash2(i + 1, 3)));
    const ty = -sy + 5 + (2 * sy - 10) * hash2(i + 2, 7);
    tree(trunk, crown, tx, ty, 9);
  }

  return {
    body: freeze(body),
    glassA: freeze(gA),
    glassB: freeze(gB),
    winCool: freeze(winC),
    winWarm: freeze(winW),
    accent: freeze(accent),
    extras: [
      { mesh: freeze(parking), color: [62, 66, 76, 255], lit: true }, // أسفلت
      { mesh: freeze(lawn), color: [66, 116, 60, 255], lit: true }, // عشب
      { mesh: freeze(trunk), color: [98, 74, 52, 255], lit: true },
      { mesh: freeze(crown), color: [52, 110, 56, 255], lit: true },
      { mesh: freeze(dome), color: [150, 225, 255, 235], lit: false }, // أتريوم متوهّج
    ],
    height: baseH + 8,
  };
}

// م9.7.2 · فندق 5 نجوم: بوديوم فخم بزجاج لوبي وبورت-كوشير + برج نزلاء أنيق (إيقاع نوافذ/شرفات) + سكاي لاونج متوهّج وتتويج.
export function generateHotel(w: number, d: number): TowerMeshes {
  const w2 = w / 2;
  const d2 = d / 2;
  const ref = Math.max(w, d);
  const podiumH = 9.0; // بوديوم مستويان فخمان
  const towerTop = Math.max(30, Math.min(58, ref * 3.0)); // مقياس واقعيّ
  const tw = w * 0.62;
  const td = d * 0.62;
  const tw2 = tw / 2;
  const td2 = td / 2;
  const body = buf();
  const gA = buf();
  const gB = buf();
  const winC = buf();
  const winW = buf();
  const accent = buf();

  // بوديوم فخم
  box(body, -w2 * 1.12, w2 * 1.12, -d2 * 1.12, d2 * 1.12, 0, 1.0);
  box(body, -w2, w2, -d2, d2, 1.0, podiumH);
  box(gA, -w2 - 0.04, w2 + 0.04, -d2 - 0.04, d2 + 0.04, 1.6, podiumH - 1.2, { top: false, bottom: false }); // زجاج اللوبي
  box(accent, -w2 - 0.06, w2 + 0.06, -d2 - 0.06, d2 + 0.06, podiumH - 0.5, podiumH, { top: false, bottom: false }); // حزام علوي
  // بورت-كوشير (مظلّة مدخل بأعمدة على -y)
  box(accent, -w * 0.26, w * 0.26, -d2 - 5.0, -d2 + 0.2, 3.4, 3.9, { top: false, bottom: false });
  box(body, -w * 0.24, -w * 0.21, -d2 - 4.7, -d2 - 4.4, 0, 3.4);
  box(body, w * 0.21, w * 0.24, -d2 - 4.7, -d2 - 4.4, 0, 3.4);
  // برج النزلاء (إيقاع نوافذ/شرفات أنيق) عبر buildFace
  box(body, -tw2, tw2, -td2, td2, podiumH, towerTop); // نواة البرج
  const place = (fb: FaceBufs, deg: number): void => {
    rotateAppend(fb.body, body, deg);
    rotateAppend(fb.gA, gA, deg);
    rotateAppend(fb.gB, gB, deg);
    rotateAppend(fb.winC, winC, deg);
    rotateAppend(fb.winW, winW, deg);
  };
  const f: FaceBufs = { body: buf(), gA: buf(), gB: buf(), winC: buf(), winW: buf() };
  buildFace(tw, td2, podiumH, towerTop, 5, f);
  const s: FaceBufs = { body: buf(), gA: buf(), gB: buf(), winC: buf(), winW: buf() };
  buildFace(td, tw2, podiumH, towerTop, 55, s);
  place(f, 0);
  place(f, 180);
  place(s, 90);
  place(s, 270);
  // تتويج: سكاي لاونج زجاجيّ + حلقة متوهّجة + بارابيت
  box(gA, -tw2 - 0.06, tw2 + 0.06, -td2 - 0.06, td2 + 0.06, towerTop - 3.0, towerTop - 0.5, { top: false, bottom: false });
  box(accent, -tw2 - 0.2, tw2 + 0.2, -td2 - 0.2, td2 + 0.2, towerTop - 0.6, towerTop + 0.1, { top: false, bottom: false });
  box(body, -tw2 - 0.1, tw2 + 0.1, -td2 - 0.1, td2 + 0.1, towerTop + 0.1, towerTop + 0.8);
  return { body: freeze(body), glassA: freeze(gA), glassB: freeze(gB), winCool: freeze(winC), winWarm: freeze(winW), accent: freeze(accent), height: towerTop + 0.8 };
}

export type ModelKind = "tower" | "mall" | "hotel";
/** موزّع توليد النموذج حسب القطاع/النوع. */
export function generateModel(kind: ModelKind, w: number, d: number): TowerMeshes {
  if (kind === "mall") return generateMall(w, d);
  if (kind === "hotel") return generateHotel(w, d);
  return generateTower(w, d);
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
