// م9.8 · طبقة الأرضية: الحلقات النابضة + ظلّ التماس (هالة المجسّم على الخريطة). منقولة حرفياً (سلوك مطابق).
import type { Mesh3 } from "./types";

// م9.9 · حلقة سونار أرضيّة **بنصف قطر وحدويّ (1)**: نطاق توهّج جرسيّ (سطوع 0→1→0 عبر اللون الرأسيّ grayscale). تُرسَم
// **بمزجٍ جمعيّ (additive)** في buildRingLayers (الحوافّ المعتمة تُضيف صفراً ⇒ توهّج ناعم بلا أسود/مربّع)، و**لا تُلقي ظلّاً**
// (shadowEnabled:false). نصف القطر الفعليّ يُضبَط لكلّ موجة عبر getScale (instancing) ⇒ تباعد متدرّج مستقلّ لكلّ حلقة.
export function generateGroundRings(radius: number): Mesh3 {
  const P: number[] = [];
  const N: number[] = [];
  const C: number[] = []; // سطوع رأسيّ (grayscale) — أرضيّة **عالية** كي لا يُعتِم المزج العاديّ الخلفية (لا أسود على القمر الصناعي)
  const segs = 80; // دائرة ناعمة
  const z = 1.2; // **فوق أرضيّة المجسّم/الرسمة** (تتفادى الإخفاء وتنازع العمق) — البناء يبقى يحجبها فيظهر التدفّق حوله
  const r = radius; // نصف قطر قلب الحلقة (يُضرب بمقياس الموجة في getScale)
  const w = Math.max(radius * 0.036, 0.7); // م9.9 · سُمك مضاعَف (×٢) — مع مضاعفة تباعد الحلقات الفرعيّة في buildRingLayers يبقى الملف الناعم نفسه
  const loops = [-1, 1]; // نطاق واحد رفيع
  const bri = [1, 1]; // أبيض ثابت (التلاشي عند الحافّتين يأتي من تدرّج شفافيّة الحلقات الفرعيّة لا من السطوع)
  const vert = (rr: number, ang: number, b: number): void => {
    P.push(rr * Math.cos(ang), rr * Math.sin(ang), z);
    N.push(0, 0, 1);
    C.push(b, b, b);
  };
  for (let s = 0; s < segs; s++) {
    const a0 = (s / segs) * Math.PI * 2;
    const a1 = ((s + 1) / segs) * Math.PI * 2;
    for (let li = 0; li < loops.length - 1; li++) {
      const rA = r + loops[li]! * w;
      const rB = r + loops[li + 1]! * w;
      const bA = bri[li]!;
      const bB = bri[li + 1]!;
      vert(rA, a0, bA); vert(rB, a0, bB); vert(rB, a1, bB);
      vert(rA, a0, bA); vert(rB, a1, bB); vert(rA, a1, bA);
    }
  }
  return { positions: new Float32Array(P), normals: new Float32Array(N), colors: new Float32Array(C) };
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
