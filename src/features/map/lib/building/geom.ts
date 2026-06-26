// م9.8 · طبقة الهندسة: مخازن + بدائيّات + غطاء نباتيّ + ثوابت معماريّة. منقولة حرفياً من المولّد القديم (سلوك مطابق).
import type { Buf, Mesh3 } from "./types";

// ثوابت معماريّة مشتركة (متر · Z رأسيّ)
export const FLOOR_H = 3.3; // ارتفاع الطابق
export const PODIUM_H = 6.0; // بوديوم/لوبي
export const ROOF_H = 6.5; // منطقة التتويج (بارابيت + بنتهاوس)
export const PLINTH_H = 1.1; // قاعدة أرضية

export const buf = (): Buf => ({ P: [], N: [] });

// م9.7.6 · يُجمّد المخزَّن ويحسب لوناً رأسيّاً (تدرّج قاعدة→قمّة + إظلام الأوجه السفليّة = AO) — عمق وتظليل واقعيّ.
export function freeze(b: Buf): Mesh3 {
  const { P, N } = b;
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let i = 2; i < P.length; i += 3) {
    if (P[i]! < zMin) zMin = P[i]!;
    if (P[i]! > zMax) zMax = P[i]!;
  }
  const dz = zMax - zMin;
  const C = new Float32Array(P.length);
  const T = new Float32Array((P.length / 3) * 2); // إحداثيّات UV (إسقاط ثلاثيّ المحاور)
  const TS = 0.25; // وحدة خامة لكل 4م (تبليط متكرّر)
  for (let i = 0, t = 0; i < P.length; i += 3, t += 2) {
    const x = P[i]!;
    const y = P[i + 1]!;
    const z = P[i + 2]!;
    const t01 = dz > 1 ? (z - zMin) / dz : 1; // نسبة الارتفاع
    const mz = 0.6 + 0.4 * t01; // القاعدة أغمق · القمّة أفتح
    const an = 0.72 + 0.28 * (N[i + 2]! * 0.5 + 0.5); // الأوجه السفليّة أغمق (AO)
    const c = Math.max(0, Math.min(1, mz * an));
    C[i] = c;
    C[i + 1] = c;
    C[i + 2] = c;
    const nx = Math.abs(N[i]!);
    const ny = Math.abs(N[i + 1]!);
    const nz = Math.abs(N[i + 2]!);
    if (nz >= nx && nz >= ny) { T[t] = x * TS; T[t + 1] = y * TS; } // أوجه أفقيّة (سطوح/أرضيّات)
    else if (nx >= ny) { T[t] = y * TS; T[t + 1] = z * TS; } // أوجه X
    else { T[t] = x * TS; T[t + 1] = z * TS; } // أوجه Y
  }
  return { positions: new Float32Array(P), normals: new Float32Array(N), colors: C, texCoords: T };
}

export function pushQuad(b: Buf, a: number[], bb: number[], c: number[], d: number[], n: number[]): void {
  for (const v of [a, bb, c, a, c, d]) {
    b.P.push(v[0]!, v[1]!, v[2]!);
    b.N.push(n[0]!, n[1]!, n[2]!);
  }
}

// صندوق محوريّ من (x0,y0,z0) إلى (x1,y1,z1) بأوجه اختيارية.
export function box(b: Buf, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, opts?: { top?: boolean; bottom?: boolean; sides?: boolean }): void {
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

// تجزئة شبه-عشوائية حتميّة (ثابتة لكل مجسّم — لا وميض عند إعادة التوليد).
export function hash2(i: number, j: number): number {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// م9.7.3 · مكوّنات منحنية/مرافق — رباعيّ بنواظم لكلّ رأس (سطح ناعم).
export function pushQuadVN(b: Buf, v: number[][], n: number[][]): void {
  for (const i of [0, 1, 2, 0, 2, 3]) {
    b.P.push(v[i]![0]!, v[i]![1]!, v[i]![2]!);
    b.N.push(n[i]![0]!, n[i]![1]!, n[i]![2]!);
  }
}
/** أسطوانة رأسية ناعمة (نواظم شعاعيّة) — جذوع/أعمدة/سواري. */
export function cylinder(b: Buf, cx: number, cy: number, r: number, z0: number, z1: number, seg = 9): void {
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
export function cone(b: Buf, cx: number, cy: number, r: number, z0: number, z1: number, seg = 8): void {
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
/** شجرة واقعيّة — م9.8 المرحلة 2: جذع نحيل + **تاج كرويّ متعدّد الفصوص** (كتل مستديرة متداخلة) بدل أقماع حادّة. */
export function tree(trunk: Buf, crown: Buf, cx: number, cy: number, h: number): void {
  cylinder(trunk, cx, cy, h * 0.058, 0, h * 0.32, 7); // جذع مدبّب: قاعدة أعرض
  cylinder(trunk, cx, cy, h * 0.038, h * 0.32, h * 0.58, 6); // قمّة الجذع أنحف
  const r = h * 0.32;
  // تاج **كثيف ورقيّ** متعدّد الطبقات: كتلة مركزيّة + حلقة فصوص محيطة + فصوص علويّة + قمّة
  sphere(crown, cx, cy, h * 0.62, r, 3, 9); // الكتلة المركزيّة السفلى
  const ring: [number, number][] = [[0.7, -0.16], [-0.54, 0.42], [-0.34, -0.58], [0.36, 0.56], [0.64, 0.34], [-0.66, -0.24]];
  for (const [dx, dy] of ring) sphere(crown, cx + r * dx, cy + r * dy, h * 0.62, r * 0.56, 2, 8); // حلقة فصوص (كثافة جانبيّة)
  sphere(crown, cx + r * 0.22, cy - r * 0.1, h * 0.8, r * 0.6, 2, 8); // فصّ علويّ أيمن
  sphere(crown, cx - r * 0.26, cy + r * 0.12, h * 0.82, r * 0.56, 2, 8); // فصّ علويّ أيسر
  sphere(crown, cx + r * 0.02, cy - r * 0.04, h * 0.95, r * 0.44, 2, 7); // القمّة
}
/** نخلة: جذع نحيل عالٍ + تاج مخروطيّ منخفض (طابع منتجع). */
export function palm(trunk: Buf, crown: Buf, cx: number, cy: number, h: number): void {
  cylinder(trunk, cx, cy, h * 0.035, 0, h * 0.78, 6);
  cone(crown, cx, cy, h * 0.26, h * 0.62, h, 7);
}
/** قبو زجاجيّ (أتريوم) — قوس ممدّد على X بنُعومة شعاعيّة. */
export function barrelVault(b: Buf, cx: number, cy: number, lenX: number, halfW: number, baseZ: number, riseH: number, segs = 16): void {
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
export function parkingLot(b: Buf, x0: number, x1: number, y0: number, y1: number): void {
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
/** رقعة مستلقية (عشب/ساحة/ماء). */
export function flatRect(b: Buf, x0: number, x1: number, y0: number, y1: number, z = 0.04): void {
  pushQuad(b, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, 1]);
}
/** قرص دائريّ مستوٍ (مروحة مثلّثات) يواجه الأعلى — سطح/غطاء دائريّ (قاعدة قبّة...). */
export function disc(b: Buf, cx: number, cy: number, r: number, z: number, segs = 28): void {
  for (let s = 0; s < segs; s++) {
    const a0 = (s / segs) * Math.PI * 2;
    const a1 = ((s + 1) / segs) * Math.PI * 2;
    b.P.push(cx, cy, z, cx + r * Math.cos(a0), cy + r * Math.sin(a0), z, cx + r * Math.cos(a1), cy + r * Math.sin(a1), z);
    for (let k = 0; k < 3; k++) b.N.push(0, 0, 1);
  }
}
// م9.8 المرحلة 2 — بدائيّات إضافيّة (قبّة · موشور · درابزين).
/** قبّة نصف-كرويّة ناعمة (أتريوم/تتويج) — حلقات عرضيّة × قطاعات شعاعيّة بنواظم كرويّة. */
export function dome(b: Buf, cx: number, cy: number, r: number, baseZ: number, riseH: number, rings = 6, segs = 18): void {
  for (let ri = 0; ri < rings; ri++) {
    const ph0 = ((ri / rings) * Math.PI) / 2;
    const ph1 = (((ri + 1) / rings) * Math.PI) / 2;
    const r0 = r * Math.cos(ph0);
    const r1 = r * Math.cos(ph1);
    const z0 = baseZ + riseH * Math.sin(ph0);
    const z1 = baseZ + riseH * Math.sin(ph1);
    const cp0 = Math.cos(ph0);
    const sp0 = Math.sin(ph0);
    const cp1 = Math.cos(ph1);
    const sp1 = Math.sin(ph1);
    for (let s = 0; s < segs; s++) {
      const a0 = (s / segs) * Math.PI * 2;
      const a1 = ((s + 1) / segs) * Math.PI * 2;
      const c0 = Math.cos(a0);
      const i0 = Math.sin(a0);
      const c1 = Math.cos(a1);
      const i1 = Math.sin(a1);
      pushQuadVN(
        b,
        [[cx + r0 * c0, cy + r0 * i0, z0], [cx + r0 * c1, cy + r0 * i1, z0], [cx + r1 * c1, cy + r1 * i1, z1], [cx + r1 * c0, cy + r1 * i0, z1]],
        [[c0 * cp0, i0 * cp0, sp0], [c1 * cp0, i1 * cp0, sp0], [c1 * cp1, i1 * cp1, sp1], [c0 * cp1, i0 * cp1, sp1]],
      );
    }
  }
}
/** كرة منخفضة المضلّعات (تاج شجرة/شجيرة/زخرفة) — حلقات عرض × قطاعات بنواظم كرويّة. */
export function sphere(b: Buf, cx: number, cy: number, cz: number, r: number, rings = 3, segs = 8): void {
  for (let ri = 0; ri < rings; ri++) {
    const ph0 = -Math.PI / 2 + (ri / rings) * Math.PI;
    const ph1 = -Math.PI / 2 + ((ri + 1) / rings) * Math.PI;
    const z0 = cz + r * Math.sin(ph0);
    const z1 = cz + r * Math.sin(ph1);
    const r0 = r * Math.cos(ph0);
    const r1 = r * Math.cos(ph1);
    const cp0 = Math.cos(ph0);
    const sp0 = Math.sin(ph0);
    const cp1 = Math.cos(ph1);
    const sp1 = Math.sin(ph1);
    for (let s = 0; s < segs; s++) {
      const a0 = (s / segs) * Math.PI * 2;
      const a1 = ((s + 1) / segs) * Math.PI * 2;
      const c0 = Math.cos(a0);
      const i0 = Math.sin(a0);
      const c1 = Math.cos(a1);
      const i1 = Math.sin(a1);
      pushQuadVN(
        b,
        [[cx + r0 * c0, cy + r0 * i0, z0], [cx + r0 * c1, cy + r0 * i1, z0], [cx + r1 * c1, cy + r1 * i1, z1], [cx + r1 * c0, cy + r1 * i0, z1]],
        [[c0 * cp0, i0 * cp0, sp0], [c1 * cp0, i1 * cp0, sp0], [c1 * cp1, i1 * cp1, sp1], [c0 * cp1, i0 * cp1, sp1]],
      );
    }
  }
}
/** موشور رأسيّ (عمود لافتة/مصدّ/سارية) بعدد أضلاع. */
export function prism(b: Buf, cx: number, cy: number, r: number, z0: number, z1: number, sides = 6, rotDeg = 0): void {
  const rr = (rotDeg * Math.PI) / 180;
  for (let s = 0; s < sides; s++) {
    const a0 = rr + (s / sides) * Math.PI * 2;
    const a1 = rr + ((s + 1) / sides) * Math.PI * 2;
    const c0 = Math.cos(a0);
    const i0 = Math.sin(a0);
    const c1 = Math.cos(a1);
    const i1 = Math.sin(a1);
    pushQuadVN(b, [[cx + r * c0, cy + r * i0, z0], [cx + r * c1, cy + r * i1, z0], [cx + r * c1, cy + r * i1, z1], [cx + r * c0, cy + r * i0, z1]], [[c0, i0, 0], [c1, i1, 0], [c1, i1, 0], [c0, i0, 0]]);
  }
}
/** درابزين على خطّ موازٍ لـX عند y: قوائم + مسطرة علويّة (حافة ساحة/تراس/مسبح). */
export function railing(b: Buf, x0: number, x1: number, y: number, z0: number, z1: number, postEvery = 1.6): void {
  for (let x = x0; x <= x1 + 1e-6; x += postEvery) box(b, x - 0.04, x + 0.04, y - 0.04, y + 0.04, z0, z1, { top: false, bottom: false });
  box(b, x0, x1, y - 0.05, y + 0.05, z1 - 0.08, z1, { bottom: false }); // مسطرة علويّة
}
// يلحق محتوى محليّ (واجهة عند y=-perpHalf) بعد تدويره حول Z إلى أحد الأوجه الأربعة.
export function rotateAppend(src: Buf, dst: Buf, deg: number): void {
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
