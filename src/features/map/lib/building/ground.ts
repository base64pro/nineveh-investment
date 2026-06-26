// م9.8 · طبقة الأرضية: الحلقات النابضة + ظلّ التماس (هالة المجسّم على الخريطة). منقولة حرفياً (سلوك مطابق).
import type { Mesh3 } from "./types";

// م9.7.1هـ · حلقات أرضية متوهّجة منبعثة تنبعث من مركز المجسّم وتملأ القطعة — فوق الأرضية وتحته (بارزة على القمر).
export function generateGroundRings(maxRadius: number, count = 4): Mesh3 {
  const P: number[] = [];
  const N: number[] = [];
  const segs = 72;
  const z = 0.6; // فوق الأرضية قليلاً (يتفادى تنازع العمق)
  const gap = maxRadius / count;
  const halfW = Math.max(0.4, gap * 0.06); // خطّ أرقّ أنيق — نسبة سُمك/نصف‑قطر ثابتة عبر الموجات (تناسق بصريّ) — م9.7.11
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

// م9.7.1و+ · ظلّ تماسٍ أرضيّ مُخبوز (قرص داكن شفّاف ناعم) أسفل المجسّم، مُزاح عكس اتجاه الشمس = إيهام ظلّ مُلقى ثلاثيّ.
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
