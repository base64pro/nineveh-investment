// م9.8 · طبقة الواجهات: بُناة واجهة قابلة لإعادة الاستخدام (برج/فندق · مول). منقولة حرفياً (سلوك مطابق).
import { box, cylinder, FLOOR_H, hash2, pushQuad, sphere } from "./geom";
import type { FaceBufs } from "./types";

// يبني واجهة أماميّة (إطار محليّ: الوجه عند y=-perpHalf، يمتدّ على X بعرض faceW، نحو -Y):
// زجاج بنغمتين/طابق + مونتينات عموديّة + شُرفات بارزة بحاجز زجاجي + نوافذ مضيئة متناثرة.
export function buildFace(faceW: number, perpHalf: number, z0: number, z1: number, seed: number, b: FaceBufs): void {
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
    // م9.8 · شُرفات بكثافة متدرّجة بالارتفاع (أكثف أسفل/وسط · أندر ثمّ تختفي قرب القمّة = واقعيّة أعلى)
    const ratio = f / floors;
    const hasBalcony = ratio < 0.6 ? true : ratio < 0.85 ? f % 2 === 0 : false;
    if (hasBalcony) {
      box(b.body, -bx, bx, fy - balDepth, fy, fz0 - 0.18, fz0); // بلاطة شرفة بارزة
      const rg = f % 2 === 0 ? b.gB : b.gA;
      box(rg, -bx, bx, fy - balDepth - 0.05, fy - balDepth, fz0, fz0 + 1.1, { top: false, bottom: false }); // حاجز زجاجيّ
    }
    // م9.8 · حزام أفقيّ رفيع (سبَندرل/كرنيش) كل ~٥ طوابق — يكسر الرتابة العموديّة ويُضيف إيقاعاً
    if (f > 0 && f % 5 === 0) box(b.body, -W2, W2, fy - 0.2, fy + 0.02, fz0 - 0.13, fz0 + 0.13, { top: false, bottom: false });
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

// م9.8 (الثيمة) · واجهة البرج حصراً (الفندق يبقى على buildFace): نوافذ زجاجيّة **بارزة** (bay) زرقاء كريستاليّة
// + شُرفات بحاجز زجاجيّ أزرق + مونتينات + نوافذ مضيئة متناثرة. إطار محليّ: الوجه عند y=-perpHalf نحو -Y.
export function buildTowerFace(faceW: number, perpHalf: number, z0: number, z1: number, seed: number, b: FaceBufs): void {
  const W2 = faceW / 2;
  const fy = -perpHalf;
  const floors = Math.max(4, Math.floor((z1 - z0) / FLOOR_H));
  const cols = Math.max(2, Math.round(faceW / 3.4));
  const cell = faceW / cols;
  const prot = 0.32; // نتوء النافذة
  const bx = W2 * 0.9;
  for (let f = 0; f < floors; f++) {
    const fb = z0 + f * FLOOR_H;
    const wz0 = fb + FLOOR_H * 0.14;
    const wz1 = fb + FLOOR_H * 0.9;
    const g = f % 2 === 0 ? b.gA : b.gB;
    for (let c = 0; c < cols; c++) {
      const cx = -W2 + (c + 0.5) * cell;
      const pw = cell * 0.4;
      pushQuad(g, [cx - pw, fy - prot, wz0], [cx + pw, fy - prot, wz0], [cx + pw, fy - prot, wz1], [cx - pw, fy - prot, wz1], [0, -1, 0]); // واجهة نافذة بارزة (زجاج أزرق)
      pushQuad(b.body, [cx - pw, fy, wz0], [cx - pw, fy - prot, wz0], [cx - pw, fy - prot, wz1], [cx - pw, fy, wz1], [-1, 0, 0]); // كاشف -x
      pushQuad(b.body, [cx + pw, fy - prot, wz0], [cx + pw, fy, wz0], [cx + pw, fy, wz1], [cx + pw, fy - prot, wz1], [1, 0, 0]); // كاشف +x
      pushQuad(b.body, [cx - pw, fy - prot, wz1], [cx + pw, fy - prot, wz1], [cx + pw, fy, wz1], [cx - pw, fy, wz1], [0, 0, 1]); // علويّ
      pushQuad(b.body, [cx - pw, fy, wz0], [cx + pw, fy, wz0], [cx + pw, fy - prot, wz0], [cx - pw, fy - prot, wz0], [0, 0, -1]); // سفليّ
      if (hash2(f + 1, c + 1 + seed) < 0.18) { const wb = hash2(c + 2, f + seed) < 0.32 ? b.winW : b.winC; pushQuad(wb, [cx - pw * 0.6, fy - prot - 0.02, wz0 + FLOOR_H * 0.18], [cx + pw * 0.6, fy - prot - 0.02, wz0 + FLOOR_H * 0.18], [cx + pw * 0.6, fy - prot - 0.02, wz1 - FLOOR_H * 0.12], [cx - pw * 0.6, fy - prot - 0.02, wz1 - FLOOR_H * 0.12], [0, -1, 0]); } // نافذة مضيئة
    }
    box(b.body, -W2, W2, fy - 0.14, fy + 0.02, fb, fb + 0.4, { top: false, bottom: false }); // سبَندرل
    if (f / floors < 0.82 && f % 2 === 0) {
      box(b.body, -bx, bx, fy - 1.45, fy, fb - 0.16, fb, { bottom: false }); // بلاطة شرفة بارزة
      box(b.gB, -bx, bx, fy - 1.5, fy - 1.45, fb, fb + 1.05, { top: false, bottom: false }); // حاجز زجاجيّ أزرق
      box(b.body, -bx, bx, fy - 1.52, fy - 1.4, fb + 1.0, fb + 1.12, { top: false, bottom: false }); // مسطرة الحاجز
    }
  }
  for (let cI = 0; cI <= cols; cI++) { const x = -W2 + cI * cell; box(b.body, x - 0.1, x + 0.1, fy - 0.16, fy + 0.02, z0, z1, { top: false, bottom: false }); } // مونتينات عموديّة
}

// واجهة المول — م9.8 (المرحلة 1): أربعة مستويات. الطابق الأرضيّ ستارة زجاج رؤية شفّافة يُرى عبرها تجهيز داخليّ
// مضيء (جدار إضاءة دافئ + سقف مضيء + كاونتر + رفوف + أشخاص ظاهرون)، والمستويات الثلاثة العلويّة ألواح زجاج
// **بارزة عن المبنى** (نتوء + كاشفات + مفاصل) لإحساس ثلاثيّ الأبعاد وظلّ تماسٍ (AO). الإطار محليّ: الوجه عند y=-perpHalf نحو -Y.
export function buildMallFace(faceW: number, perpHalf: number, levels: number, groundH: number, upperH: number, bandDepth: number, b: FaceBufs): void {
  const W2 = faceW / 2;
  const fy = -perpHalf; // مستوى الوجه (الزجاج خارجه قليلاً)
  const back = fy + bandDepth; // الجدار الخلفيّ لنطاق المحلّات (وجه القلب الغائر)
  const cols = Math.max(3, Math.round(faceW / 7));
  const cell = faceW / cols;

  // — الطابق الأرضيّ: ستارة زجاج رؤية شفّافة + مفاصل نحيلة + عتبتان —
  for (let c = 0; c < cols; c++) {
    const cx = -W2 + (c + 0.5) * cell;
    pushQuad(b.gA, [cx - cell * 0.46, fy - 0.05, 0.3], [cx + cell * 0.46, fy - 0.05, 0.3], [cx + cell * 0.46, fy - 0.05, groundH - 0.5], [cx - cell * 0.46, fy - 0.05, groundH - 0.5], [0, -1, 0]); // زجاج رؤية شفّاف
  }
  for (let c = 0; c <= cols; c++) { const x = -W2 + c * cell; box(b.body, x - 0.1, x + 0.1, fy - 0.12, fy + 0.02, 0.3, groundH, { top: false, bottom: false }); } // مفاصل عموديّة نحيلة
  box(b.body, -W2, W2, fy - 0.14, fy + 0.02, 0, 0.35, { top: false, bottom: false }); // عتبة سفليّة
  box(b.body, -W2, W2, fy - 0.16, fy + 0.02, groundH - 0.55, groundH, { top: false, bottom: false }); // عتبة علويّة (فاصل المستوى)

  // — تجهيز داخليّ مرئيّ خلف الزجاج: إضاءة دافئة قويّة + سقف مضيء + كاونتر + رفوف + أشخاص (ظلال) —
  pushQuad(b.winW, [-W2 + 0.3, back - 0.05, 0.4], [W2 - 0.3, back - 0.05, 0.4], [W2 - 0.3, back - 0.05, groundH - 0.7], [-W2 + 0.3, back - 0.05, groundH - 0.7], [0, -1, 0]); // جدار إضاءة دافئ قويّ
  pushQuad(b.winW, [-W2 + 0.3, fy + 0.5, groundH - 0.62], [W2 - 0.3, fy + 0.5, groundH - 0.62], [W2 - 0.3, back, groundH - 0.62], [-W2 + 0.3, back, groundH - 0.62], [0, 0, -1]); // شريط سقف مضيء
  box(b.body, -W2 + 0.6, W2 - 0.6, fy + 0.5, fy + 0.95, 0.35, 1.05, { bottom: false }); // كاونتر بيع طويل قرب الزجاج
  for (let c = 0; c < cols; c++) {
    const cx = -W2 + (c + 0.5) * cell;
    if (hash2(c + 1, Math.round(perpHalf)) < 0.7) box(b.body, cx - cell * 0.32, cx + cell * 0.32, back - 0.5, back - 0.1, 0.35, Math.min(groundH - 0.9, 2.6), { bottom: false }); // رفّ بيع عند الجدار الخلفيّ
    if (hash2(c + 3, Math.round(perpHalf) + 1) < 0.55) {
      const px = cx + (hash2(c, 7) - 0.5) * cell * 0.5;
      const py = fy + 0.9 + hash2(c, 9) * (bandDepth - 1.6);
      cylinder(b.body, px, py, 0.26, 0, 1.15, 6); // جسم شخص
      sphere(b.body, px, py, 1.4, 0.17, 2, 6); // رأس
    }
    if (hash2(c + 5, Math.round(perpHalf)) < 0.4) pushQuad(b.winW, [cx - cell * 0.3, fy - 0.08, groundH - 1.7], [cx + cell * 0.3, fy - 0.08, groundH - 1.7], [cx + cell * 0.3, fy - 0.08, groundH - 0.8], [cx - cell * 0.3, fy - 0.08, groundH - 0.8], [0, -1, 0]); // فاترينة/لافتة محلّ مضيئة
  }

  // — المستويات العلويّة (ط1..ط3): ألواح زجاج بارزة عن الوجه + كاشفات + مفاصل بارزة —
  const prot = 0.28; // نتوء اللوح خارج الوجه
  for (let L = 1; L < levels; L++) {
    const z0 = groundH + (L - 1) * upperH;
    const z1 = z0 + upperH;
    box(b.body, -W2, W2, fy - 0.16, fy + 0.02, z0, z0 + 0.55, { top: false, bottom: false }); // سبَندرل (حزام فاصل)
    for (let c = 0; c < cols; c++) {
      const cx = -W2 + (c + 0.5) * cell;
      const pw = cell * 0.4;
      const pz0 = z0 + 0.7;
      const pz1 = z1 - 0.15;
      pushQuad(b.gB, [cx - pw, fy - prot, pz0], [cx + pw, fy - prot, pz0], [cx + pw, fy - prot, pz1], [cx - pw, fy - prot, pz1], [0, -1, 0]); // واجهة اللوح البارز
      pushQuad(b.body, [cx - pw, fy, pz0], [cx - pw, fy - prot, pz0], [cx - pw, fy - prot, pz1], [cx - pw, fy, pz1], [-1, 0, 0]); // كاشف -x
      pushQuad(b.body, [cx + pw, fy - prot, pz0], [cx + pw, fy, pz0], [cx + pw, fy, pz1], [cx + pw, fy - prot, pz1], [1, 0, 0]); // كاشف +x
      pushQuad(b.body, [cx - pw, fy - prot, pz1], [cx + pw, fy - prot, pz1], [cx + pw, fy, pz1], [cx - pw, fy, pz1], [0, 0, 1]); // كاشف علويّ
      pushQuad(b.body, [cx - pw, fy, pz0], [cx + pw, fy, pz0], [cx + pw, fy - prot, pz0], [cx - pw, fy - prot, pz0], [0, 0, -1]); // كاشف سفليّ
    }
    for (let c = 0; c <= cols; c++) { const x = -W2 + c * cell; box(b.body, x - 0.12, x + 0.12, fy - prot - 0.02, fy + 0.02, z0 + 0.55, z1, { top: false, bottom: false }); } // مفاصل عموديّة بارزة
  }
}
