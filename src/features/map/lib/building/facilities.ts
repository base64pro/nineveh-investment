// م9.8 المرحلة 2 · طبقة مرافق الموقع: مواقف بدهان وسيّارات · حدائق بأحواض وممرّات وأشجار وشجيرات · شارع · ساحة.
// كلّها حتميّة (hash2) وتكتب في مخازن خامات مشتركة (تُحلّ extras بخامة موحّدة). أرضيّات منخفضة فوق الأرض.
import { box, cone, cylinder, dome, flatRect, hash2, pushQuad, sphere, tree } from "./geom";
import type { Buf } from "./types";

const Z_GROUND = 0.04; // سطح مرصوف
const Z_PAINT = 0.07; // دهان فوق الرصف (يتفادى تنازع العمق)

/** موقف سيّارات مرصوف: أسفلت + خطوط مواقف (دهان) + سيّارات (جسم + مقصورة، متناثرة حتميّاً). */
export function parkingField(asphalt: Buf, paint: Buf, cars: Buf, x0: number, x1: number, y0: number, y1: number, seed: number): void {
  if (x1 - x0 < 6 || y1 - y0 < 6) return;
  flatRect(asphalt, x0, x1, y0, y1, Z_GROUND);
  const stallW = 2.7;
  const stallL = 5.0;
  const rowGap = stallL + 6.0; // صفّ + ممرّ
  for (let y = y0 + 1; y + stallL <= y1 - 1; y += rowGap) {
    pushQuad(paint, [x0 + 0.4, y, Z_PAINT], [x1 - 0.4, y, Z_PAINT], [x1 - 0.4, y + 0.14, Z_PAINT], [x0 + 0.4, y + 0.14, Z_PAINT], [0, 0, 1]); // خطّ نهاية الصفّ
    for (let x = x0 + 0.4; x + stallW <= x1 - 0.4; x += stallW) {
      pushQuad(paint, [x, y, Z_PAINT], [x + 0.12, y, Z_PAINT], [x + 0.12, y + stallL, Z_PAINT], [x, y + stallL, Z_PAINT], [0, 0, 1]); // فاصل موقف
      if (hash2(Math.round(x) + seed, Math.round(y)) < 0.62) {
        const cl = y + 0.5;
        const cr = y + stallL - 0.5;
        box(cars, x + 0.3, x + stallW - 0.3, cl, cr, 0.08, 1.1); // جسم السيّارة
        box(cars, x + 0.5, x + stallW - 0.5, cl + 0.9, cr - 0.6, 1.1, 1.6); // المقصورة
      }
    }
  }
}

/** حديقة منسّقة: عشب + أحواض زرع + ممرّ + **صفوف أشجار واقعيّة متفاوتة + شجيرات مستديرة** (حتميّ). */
export function garden(veg: Buf, soil: Buf, path: Buf, trunk: Buf, crown: Buf, x0: number, x1: number, y0: number, y1: number, seed: number): void {
  if (x1 - x0 < 2.5 || y1 - y0 < 6) return;
  flatRect(veg, x0, x1, y0, y1, Z_GROUND); // عشب
  const cx = (x0 + x1) / 2;
  pushQuad(path, [cx - 0.7, y0, Z_PAINT], [cx + 0.7, y0, Z_PAINT], [cx + 0.7, y1, Z_PAINT], [cx - 0.7, y1, Z_PAINT], [0, 0, 1]); // ممرّ طوليّ
  for (let y = y0 + 3; y < y1 - 2; y += 4.2) {
    box(soil, x0 + 0.3, cx - 1.0, y - 0.5, y + 0.5, Z_GROUND, 0.5); // حوض يسار
    box(soil, cx + 1.0, x1 - 0.3, y - 0.5, y + 0.5, Z_GROUND, 0.5); // حوض يمين
    const hL = 6.5 + hash2(Math.round(y) + seed, 3) * 4;
    const hR = 6.5 + hash2(Math.round(y) + seed, 7) * 4;
    if (hash2(Math.round(y) + seed, 3) < 0.85) tree(trunk, crown, x0 + (x1 - x0) * 0.26, y, hL);
    if (hash2(Math.round(y) + seed, 7) < 0.85) tree(trunk, crown, x0 + (x1 - x0) * 0.74, y, hR);
    sphere(crown, cx - 0.95, y, 0.5, 0.55, 2, 6); // شجيرة يسار الممرّ
    sphere(crown, cx + 0.95, y + 2.1, 0.5, 0.5, 2, 6); // شجيرة يمين الممرّ
  }
}

/** شارع خدمة: أسفلت + خطّ منتصف متقطّع (دهان) + أرصفة جانبيّة (خرسانة). */
export function street(asphalt: Buf, paint: Buf, curb: Buf, x0: number, x1: number, y0: number, y1: number): void {
  if (x1 - x0 < 6 || y1 - y0 < 2) return;
  flatRect(asphalt, x0, x1, y0, y1, Z_GROUND);
  const my = (y0 + y1) / 2;
  for (let x = x0 + 1; x < x1 - 1; x += 3.2) pushQuad(paint, [x, my - 0.1, Z_PAINT], [x + 1.6, my - 0.1, Z_PAINT], [x + 1.6, my + 0.1, Z_PAINT], [x, my + 0.1, Z_PAINT], [0, 0, 1]); // خطّ منتصف متقطّع
  box(curb, x0, x1, y0, y0 + 0.3, Z_GROUND, 0.22); // رصيف سفليّ
  box(curb, x0, x1, y1 - 0.3, y1, Z_GROUND, 0.22); // رصيف علويّ
}

/** ساحة مدخل مرصوفة (حجر) + خطوط نمط (دهان خفيف). */
export function plaza(stone: Buf, line: Buf, x0: number, x1: number, y0: number, y1: number): void {
  if (x1 - x0 < 2 || y1 - y0 < 2) return;
  flatRect(stone, x0, x1, y0, y1, Z_GROUND + 0.01);
  for (let x = x0 + 2; x < x1 - 0.5; x += 2) pushQuad(line, [x, y0, Z_PAINT], [x + 0.08, y0, Z_PAINT], [x + 0.08, y1, Z_PAINT], [x, y1, Z_PAINT], [0, 0, 1]);
  for (let y = y0 + 2; y < y1 - 0.5; y += 2) pushQuad(line, [x0, y, Z_PAINT], [x1, y, Z_PAINT], [x1, y + 0.08, Z_PAINT], [x0, y + 0.08, Z_PAINT], [0, 0, 1]);
}

// م9.8 (تطوير المول) · أرضيّة بورسلين لامعة ممتدّة + شبكة مفاصل خفيفة (joint = خرسانة).
export function porcelainApron(tile: Buf, joint: Buf, x0: number, x1: number, y0: number, y1: number): void {
  if (x1 - x0 < 1 || y1 - y0 < 1) return;
  flatRect(tile, x0, x1, y0, y1, Z_GROUND + 0.02);
  for (let x = x0 + 3; x < x1 - 0.5; x += 3) pushQuad(joint, [x, y0, Z_PAINT], [x + 0.05, y0, Z_PAINT], [x + 0.05, y1, Z_PAINT], [x, y1, Z_PAINT], [0, 0, 1]); // مفاصل طوليّة
  for (let y = y0 + 3; y < y1 - 0.5; y += 3) pushQuad(joint, [x0, y, Z_PAINT], [x1, y, Z_PAINT], [x1, y + 0.05, Z_PAINT], [x0, y + 0.05, Z_PAINT], [0, 0, 1]); // مفاصل عرضيّة
}

// نافورة دائريّة: حوض حجريّ (جداران + إفريز) + سطح ماء + نفث مركزيّ متدرّج + نوافير محيطة (حتميّة).
export function fountain(stone: Buf, water: Buf, cx: number, cy: number, r: number, seed: number): void {
  if (r < 1.5) return;
  cylinder(stone, cx, cy, r, Z_GROUND, 0.75, 18); // الجدار الخارجيّ
  cylinder(stone, cx, cy, r - 0.45, Z_GROUND, 0.72, 18); // الجدار الداخليّ
  cylinder(stone, cx, cy, r + 0.1, 0.72, 0.92, 18); // إفريز علويّ
  dome(water, cx, cy, r - 0.5, 0.55, 0.05, 1, 18); // سطح الماء
  cylinder(stone, cx, cy, r * 0.26, 0.55, 1.15, 12); // قاعدة النافورة
  dome(water, cx, cy, r * 0.26, 1.15, 0.06, 1, 12); // حوض علويّ
  cylinder(water, cx, cy, 0.13, 1.15, 2.7, 6); // نفث مركزيّ
  sphere(water, cx, cy, 2.85, 0.55, 2, 8); // رشّة التاج
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; sphere(water, cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, 0.95 + hash2(k, seed) * 0.3, 0.22, 2, 6); } // نوافير محيطة
}

// تراس مقاهٍ فاخرة على حافّة الساحة: مجموعات (طاولة مستديرة + كراسٍ + مظلّة قماشيّة) موزّعة حتميّاً على شريط.
export function cafeTerrace(fabric: Buf, furn: Buf, x0: number, x1: number, edgeY: number, depth: number, seed: number): void {
  const setW = 5.2;
  for (let x = x0 + 2.5; x + setW <= x1 - 2.5; x += setW) {
    const cx = x + setW / 2;
    const cy = edgeY + depth * 0.5 + (hash2(Math.round(x) + seed, 3) - 0.5) * depth * 0.3;
    cylinder(furn, cx, cy, 0.08, 0, 0.72, 6); // ساق الطاولة
    dome(furn, cx, cy, 0.6, 0.72, 0.05, 1, 10); // سطح الطاولة
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4; const chx = cx + Math.cos(a) * 1.05; const chy = cy + Math.sin(a) * 1.05; box(furn, chx - 0.22, chx + 0.22, chy - 0.22, chy + 0.22, 0, 0.45); box(furn, chx - 0.22, chx + 0.22, chy + Math.sin(a) * 0.2 - 0.05, chy + Math.sin(a) * 0.2 + 0.05, 0.45, 0.9, { top: false, bottom: false }); } // كراسٍ (مقعد + ظهر)
    cylinder(furn, cx, cy, 0.05, 0.72, 2.7, 5); // عمود المظلّة
    cone(fabric, cx, cy, 1.75, 2.5, 3.2, 8); // مظلّة قماشيّة
  }
}

// حشد منخفض المضلّعات (متبضّعون/مشاة) موزّع حتميّاً ضمن مستطيل.
export function crowd(people: Buf, x0: number, x1: number, y0: number, y1: number, n: number, seed: number): void {
  for (let i = 0; i < n; i++) {
    const px = x0 + hash2(i + 1, seed) * (x1 - x0);
    const py = y0 + hash2(i + 2, seed + 7) * (y1 - y0);
    const h = 1.5 + hash2(i + 3, seed) * 0.35;
    cylinder(people, px, py, 0.22, 0, h * 0.78, 6); // الجسم
    sphere(people, px, py, h * 0.88, 0.16, 2, 6); // الرأس
  }
}

// سارية ضخمة تحمل بانراً إعلانيّاً مضيئاً (لوحة متصالبة مرئيّة من كلّ الجهات) + تاج مضيء.
export function signMast(pole: Buf, banner: Buf, cx: number, cy: number, h: number): void {
  cylinder(pole, cx, cy, 0.55, 0, 1.0, 14); // قاعدة
  cylinder(pole, cx, cy, 0.34, 0, h, 12); // العمود
  const bw = 4.4;
  const bh = 6.2;
  const z0 = h - bh - 1.2;
  const z1 = h - 1.2;
  box(banner, cx - 0.18, cx + 0.18, cy - bw / 2, cy + bw / 2, z0, z1); // لوحة على Y
  box(banner, cx - bw / 2, cx + bw / 2, cy - 0.18, cy + 0.18, z0, z1); // لوحة متصالبة على X
  sphere(banner, cx, cy, h + 0.4, 0.42, 2, 8); // تاج مضيء
}

// سيّارة واقعيّة منخفضة المضلّعات (جسم + مقصورة + زجاج + سقف) مُحاذاة على Y.
function realCar(bodyB: Buf, glassB: Buf, x0: number, x1: number, y0: number, y1: number): void {
  const len = y1 - y0;
  const h = 0.32;
  box(bodyB, x0, x1, y0, y1, h, h + 0.55); // الجسم السفليّ
  box(bodyB, x0 + 0.08, x1 - 0.08, y0 + len * 0.28, y1 - len * 0.2, h + 0.55, h + 1.05); // المقصورة
  box(glassB, x0 + 0.04, x1 - 0.04, y0 + len * 0.29, y1 - len * 0.21, h + 0.58, h + 1.0, { top: false, bottom: false }); // الزجاج
  box(bodyB, x0 + 0.06, x1 - 0.06, y0 + len * 0.31, y1 - len * 0.23, h + 1.0, h + 1.08); // السقف
}

// م9.8 (تطوير المول) · سور محيطيّ منخفض حول الموقع: نصف سفليّ رخام + نصف علويّ سياج حديديّ مزخرف، مع فتحة بوّابة على +y.
export function perimeterWall(marble: Buf, iron: Buf, x0: number, x1: number, y0: number, y1: number, gateC: number, gateW: number): void {
  const bH = 2.1; // ارتفاع القاعدة الرخاميّة (أضخم)
  const rH = 4.4; // قمّة السياج الحديديّ (سور مهيب أعلى)
  const t = 0.95; // سُمك السور (أعرض وأبرز)
  const run = (a: number, b: number, c: number, horiz: boolean): void => {
    if (b - a < 0.6) return;
    if (horiz) {
      box(marble, a, b, c - t / 2, c + t / 2, 0, bH); // قاعدة رخام سميكة
      box(marble, a - 0.08, b + 0.08, c - t / 2 - 0.05, c + t / 2 + 0.05, bH, bH + 0.2, { bottom: false }); // إفريز بارز
      box(iron, a, b, c - 0.06, c + 0.06, rH - 0.1, rH); // مسطرة علويّة
      box(iron, a, b, c - 0.06, c + 0.06, bH + 0.75, bH + 0.82); // مسطرة وسطى
      for (let x = a + 0.4; x <= b; x += 1.5) box(iron, x - 0.045, x + 0.045, c - 0.05, c + 0.05, bH + 0.18, rH); // قضبان زخرفيّة أسمك
      for (let x = a; x <= b + 0.01; x += 6) box(iron, x - 0.16, x + 0.16, c - 0.13, c + 0.13, bH, rH + 0.4); // أعمدة برؤوس بارزة
    } else {
      box(marble, c - t / 2, c + t / 2, a, b, 0, bH);
      box(marble, c - t / 2 - 0.05, c + t / 2 + 0.05, a - 0.08, b + 0.08, bH, bH + 0.2, { bottom: false });
      box(iron, c - 0.06, c + 0.06, a, b, rH - 0.1, rH);
      box(iron, c - 0.06, c + 0.06, a, b, bH + 0.75, bH + 0.82);
      for (let y = a + 0.4; y <= b; y += 1.5) box(iron, c - 0.05, c + 0.05, y - 0.045, y + 0.045, bH + 0.18, rH);
      for (let y = a; y <= b + 0.01; y += 6) box(iron, c - 0.13, c + 0.13, y - 0.16, y + 0.16, bH, rH + 0.4);
    }
  };
  run(x0, x1, y0, true); // الخلف (-y)
  run(y0, y1, x0, false); // اليسار (-x)
  run(y0, y1, x1, false); // اليمين (+x)
  run(x0, gateC - gateW / 2, y1, true); // الأمام يسار الفتحة
  run(gateC + gateW / 2, x1, y1, true); // الأمام يمين الفتحة
  box(marble, gateC - gateW / 2 - 0.7, gateC - gateW / 2 + 0.3, y1 - 0.6, y1 + 0.6, 0, rH + 1.0); // عمود بوّابة يسار مهيب
  box(marble, gateC + gateW / 2 - 0.3, gateC + gateW / 2 + 0.7, y1 - 0.6, y1 + 0.6, 0, rH + 1.0); // عمود بوّابة يمين مهيب
}

// موقف سيّارات واقعيّ: أسفلت + خطوط مواقف + سيّارات مفصّلة بلونين (حتميّ).
export function realCarsLot(asphalt: Buf, paint: Buf, carA: Buf, carB: Buf, carGlass: Buf, x0: number, x1: number, y0: number, y1: number, seed: number): void {
  if (x1 - x0 < 6 || y1 - y0 < 6) return;
  flatRect(asphalt, x0, x1, y0, y1, Z_GROUND);
  const stallW = 2.7;
  const stallL = 5.0;
  const rowGap = stallL + 6.0;
  for (let y = y0 + 1; y + stallL <= y1 - 1; y += rowGap) {
    pushQuad(paint, [x0 + 0.4, y, Z_PAINT], [x1 - 0.4, y, Z_PAINT], [x1 - 0.4, y + 0.14, Z_PAINT], [x0 + 0.4, y + 0.14, Z_PAINT], [0, 0, 1]); // خطّ نهاية الصفّ
    for (let x = x0 + 0.4; x + stallW <= x1 - 0.4; x += stallW) {
      pushQuad(paint, [x, y, Z_PAINT], [x + 0.12, y, Z_PAINT], [x + 0.12, y + stallL, Z_PAINT], [x, y + stallL, Z_PAINT], [0, 0, 1]); // فاصل موقف
      if (hash2(Math.round(x) + seed, Math.round(y)) < 0.6) realCar(hash2(Math.round(x), Math.round(y) + seed) < 0.5 ? carA : carB, carGlass, x + 0.35, x + stallW - 0.35, y + 0.4, y + stallL - 0.4);
    }
  }
}
