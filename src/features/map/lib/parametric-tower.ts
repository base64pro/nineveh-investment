// م9.7.1ج/و · توليد برج سكني بارامتري واقعي (هندسة إجرائية) — مواءَم من تصاميم فيكتور حقيقية
// (شُرفات سكنية + زجاج أزرق ستائري + مونتينات + بوديوم + تتويج بحلقة مميِّزة)، منسجم مع الأزرق الرقمي الهولوكرامي.
// أربع شبكات حسب الخامة: body (مضاء داكن) · glassA/glassB (زجاج أزرق منبعث بنغمتين) · accent (حلقة مميِّزة منبعثة).
// الأبعاد بالمتر (Z رأسي)، مركزه (0,0). الارتفاع/الطوابق يُلائَمان تلقائياً من البصمة.

export interface Mesh3 {
  positions: Float32Array;
  normals: Float32Array;
}
export interface TowerMeshes {
  body: Mesh3; // الهيكل المضاء (بوديوم/أعمدة/شُرفات/بارابيت/بنتهاوس)
  glassA: Mesh3; // زجاج فاتح منبعث (نغمة 1)
  glassB: Mesh3; // زجاج غامق منبعث (نغمة 2) — تفاوت الألواح = انعكاس واقعي
  accent: Mesh3; // حلقة/خطوط مميِّزة منبعثة (هوية زرقاء)
  height: number;
}

type Buf = { P: number[]; N: number[] };
const buf = (): Buf => ({ P: [], N: [] });
const freeze = (b: Buf): Mesh3 => ({ positions: new Float32Array(b.P), normals: new Float32Array(b.N) });

const FLOOR_H = 3.3; // ارتفاع الطابق (م)
const PODIUM_H = 6.0; // بوديوم/لوبي
const ROOF_H = 6.5; // منطقة التتويج (بارابيت + بنتهاوس)
const PLINTH_H = 1.1; // قاعدة أرضية

function pushQuad(P: number[], N: number[], a: number[], b: number[], c: number[], d: number[], n: number[]): void {
  for (const v of [a, b, c, a, c, d]) {
    P.push(v[0]!, v[1]!, v[2]!);
    N.push(n[0]!, n[1]!, n[2]!);
  }
}

// صندوق محوريّ من زاوية (x0,y0,z0) إلى (x1,y1,z1) بأوجه اختيارية (نفس اصطلاح اللفّ المُختبَر).
function box(b: Buf, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, opts?: { top?: boolean; bottom?: boolean; sides?: boolean }): void {
  const top = opts?.top ?? true;
  const bottom = opts?.bottom ?? true;
  const sides = opts?.sides ?? true;
  const { P, N } = b;
  if (sides) {
    pushQuad(P, N, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]); // -y
    pushQuad(P, N, [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]); // +x
    pushQuad(P, N, [x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [0, 1, 0]); // +y
    pushQuad(P, N, [x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [-1, 0, 0]); // -x
  }
  if (top) pushQuad(P, N, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
  if (bottom) pushQuad(P, N, [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0], [0, 0, -1]);
}

// يلحق محتوى مخزَّن محليّاً (واجهة أماميّة عند y=-perpHalf) بعد تدويره حول Z إلى أحد الأوجه الأربعة.
function rotateAppend(src: Buf, dst: Buf, deg: number): void {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  for (let i = 0; i < src.P.length; i += 3) {
    const x = src.P[i]!;
    const y = src.P[i + 1]!;
    const z = src.P[i + 2]!;
    dst.P.push(x * c - y * s, x * s + y * c, z);
    const nx = src.N[i]!;
    const ny = src.N[i + 1]!;
    const nz = src.N[i + 2]!;
    dst.N.push(nx * c - ny * s, nx * s + ny * c, nz);
  }
}

// يبني واجهة أماميّة واحدة (في إطار محليّ: مستوى الوجه عند y=-perpHalf، يمتدّ على X بعرض faceW، نحو الخارج -Y)
// مُخرِجاً في خانات الخامات: زجاج بنغمتين + مونتينات + شُرفات بحاجز زجاجي.
function buildFace(faceW: number, perpHalf: number, z0: number, z1: number, b: { body: Buf; gA: Buf; gB: Buf }): void {
  const W2 = faceW / 2;
  const fy = -perpHalf; // مستوى الوجه
  const go = 0.04; // إزاحة الزجاج أمام الهيكل قليلاً
  const floors = Math.max(4, Math.floor((z1 - z0) / FLOOR_H));
  const cols = Math.max(2, Math.round(faceW / 3.6));
  const cell = faceW / cols;

  // زجاج ستائري لكل طابق بنغمتين متناوبتين (انعكاس واقعي) + حاجز شرفة زجاجي أمامه.
  for (let f = 0; f < floors; f++) {
    const fz0 = z0 + f * FLOOR_H;
    const fz1 = fz0 + FLOOR_H;
    const g = f % 2 === 0 ? b.gA : b.gB;
    // لوح الزجاج (وجه مستوٍ نحو -Y)
    pushQuad(g.P, g.N, [-W2, fy - go, fz0], [W2, fy - go, fz0], [W2, fy - go, fz1], [-W2, fy - go, fz1], [0, -1, 0]);
    // شرفة: بلاطة بارزة عند مستوى الطابق + حاجز زجاجي
    const bx = W2 * 0.9;
    const balDepth = 0.95;
    box(b.body, -bx, bx, fy - balDepth, fy, fz0 - 0.14, fz0, { bottom: true }); // بلاطة الشرفة (بارزة)
    // حاجز زجاجي عند الحافة الأماميّة للبلاطة
    const rg = f % 2 === 0 ? b.gB : b.gA;
    box(rg, -bx, bx, fy - balDepth - 0.05, fy - balDepth, fz0, fz0 + 1.0, { top: false, bottom: false });
  }

  // مونتينات عموديّة (أعمدة هيكليّة رفيعة بارزة على الزجاج) على خطوط الأعمدة.
  for (let cI = 0; cI <= cols; cI++) {
    const x = -W2 + cI * cell;
    box(b.body, x - 0.13, x + 0.13, fy - 0.16, fy + 0.02, z0, z1, { top: false, bottom: false });
  }
}

/** يولّد برجاً واقعياً من بصمة w×d (متر). الارتفاع/الطوابق تلقائية (نحافة ~6، محدودة 30..120م). */
export function generateTower(wMeters: number, dMeters: number): TowerMeshes {
  const w = wMeters;
  const d = dMeters;
  const w2 = w / 2;
  const d2 = d / 2;
  const ref = Math.max(w, d);
  const totalH = Math.max(30, Math.min(120, ref * 6));
  const shaftTop = totalH - ROOF_H;
  const shaftZ0 = PODIUM_H;

  const body = buf();
  const gA = buf();
  const gB = buf();
  const accent = buf();

  // — القاعدة —
  box(body, -w2 * 1.18, w2 * 1.18, -d2 * 1.18, d2 * 1.18, 0, PLINTH_H); // بلاطة أرضية (بلِنث)
  box(body, -w2 * 1.06, w2 * 1.06, -d2 * 1.06, d2 * 1.06, PLINTH_H, PODIUM_H); // بوديوم/لوبي
  // شريط زجاج اللوبي حول البوديوم
  box(gA, -w2 * 1.07, w2 * 1.07, -d2 * 1.07, d2 * 1.07, PLINTH_H + 0.9, PODIUM_H - 1.0, { top: false, bottom: false });

  // — جذع هيكليّ صلب (نواة تمنع الشفافية بين الأوجه) —
  box(body, -w2, w2, -d2, d2, shaftZ0, shaftTop);

  // — الواجهات الأربع (زجاج + مونتينات + شُرفات) —
  const front = { body: buf(), gA: buf(), gB: buf() };
  buildFace(w, d2, shaftZ0, shaftTop, front); // ±y (عرض = w)
  rotateAppend(front.body, body, 0);
  rotateAppend(front.gA, gA, 0);
  rotateAppend(front.gB, gB, 0);
  rotateAppend(front.body, body, 180);
  rotateAppend(front.gA, gA, 180);
  rotateAppend(front.gB, gB, 180);
  const side = { body: buf(), gA: buf(), gB: buf() };
  buildFace(d, w2, shaftZ0, shaftTop, side); // ±x (عرض = d)
  rotateAppend(side.body, body, 90);
  rotateAppend(side.gA, gA, 90);
  rotateAppend(side.gB, gB, 90);
  rotateAppend(side.body, body, 270);
  rotateAppend(side.gA, gA, 270);
  rotateAppend(side.gB, gB, 270);

  // — التتويج —
  box(accent, -w2 - 0.22, w2 + 0.22, -d2 - 0.22, d2 + 0.22, shaftTop - 1.5, shaftTop - 0.7, { top: false, bottom: false }); // حلقة مميِّزة
  box(body, -w2 - 0.12, w2 + 0.12, -d2 - 0.12, d2 + 0.12, shaftTop, shaftTop + 0.8); // بارابيت/كورنيش السطح
  box(body, -w2 * 0.56, w2 * 0.56, -d2 * 0.56, d2 * 0.56, shaftTop + 0.8, totalH); // بنتهاوس ميكانيكي
  box(accent, -w2 * 0.58, w2 * 0.58, -d2 * 0.58, d2 * 0.58, totalH - 0.35, totalH, { top: false, bottom: false }); // خطّ تتويج متوهّج

  return { body: freeze(body), glassA: freeze(gA), glassB: freeze(gB), accent: freeze(accent), height: totalH };
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
