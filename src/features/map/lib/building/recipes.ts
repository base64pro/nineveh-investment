// م9.8 · طبقة الوصفات: توليد كل نوع (برج/مول/فندق) بتركيب البدائيّات + الواجهات + المرافق. منقولة حرفياً (سلوك مطابق).
// المرحلة 2+: تُثرى وصفتا المول والفندق وتُفصَّل مكوّناتها/مرافقها (components/ + facilities/).
import { box, buf, cylinder, disc, dome, flatRect, freeze, hash2, palm, PLINTH_H, PODIUM_H, prism, ROOF_H, rotateAppend, sphere, tree } from "./geom";
import { buildFace, buildMallFace, buildTowerFace } from "./facade";
import { cafeTerrace, crowd, fountain, garden, perimeterWall, porcelainApron, realCarsLot, signMast } from "./facilities";
import { matColor, matLit } from "./materials";
import type { Extra, FaceBufs, Mesh3, ModelKind, TowerMeshes } from "./types";

/** يولّد برجاً مودرن واقعياً ذا نكسة علويّة من بصمة w×d (متر). */
export function generateTower(wMeters: number, dMeters: number, heightM?: number): TowerMeshes {
  const w = wMeters;
  const d = dMeters;
  const w2 = w / 2;
  const d2 = d / 2;
  const ref = Math.max(w, d);
  const totalH = heightM && heightM > 8 ? heightM : Math.max(64, Math.min(150, ref * 5.5)); // ارتفاع يدويّ أو تلقائيّ
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
  const crystal = buf(); // م9.8 (الثيمة) · المكعّب العلويّ الزجاجيّ الأزرق
  const navy = buf(); // م9.8 (الثيمة) · القاعدة الكحليّة + شرفة النكسة + السور والحدائق

  // — القاعدة الكحليّة اللامعة الأنيقة —
  box(navy, -w2 * 1.18, w2 * 1.18, -d2 * 1.18, d2 * 1.18, 0, PLINTH_H); // بلِنث كحليّ
  box(navy, -w2 * 1.06, w2 * 1.06, -d2 * 1.06, d2 * 1.06, PLINTH_H, PODIUM_H); // بوديوم كحليّ (قاعدة)
  box(gA, -w2 * 1.07, w2 * 1.07, -d2 * 1.07, d2 * 1.07, PLINTH_H + 0.9, PODIUM_H - 1.0, { top: false, bottom: false }); // زجاج اللوبي
  // م9.8 · مظلّة مدخل (بورت-كوشير) + أعمدة بوديوم أماميّة على وجه -Y — أرضيّة أكثر واقعيّة
  box(accent, -w * 0.2, w * 0.2, -d2 * 1.06 - 2.8, -d2 * 1.06 + 0.2, 3.4, 3.9, { top: false, bottom: false }); // مظلّة متوهّجة
  box(body, -w * 0.18, -w * 0.15, -d2 * 1.06 - 2.5, -d2 * 1.06 - 2.1, 0, 3.4); // عمود مدخل يسار
  box(body, w * 0.15, w * 0.18, -d2 * 1.06 - 2.5, -d2 * 1.06 - 2.1, 0, 3.4); // عمود مدخل يمين
  for (const px of [-w2 * 0.62, -w2 * 0.22, w2 * 0.22, w2 * 0.62]) box(body, px - 0.16, px + 0.16, -d2 * 1.07 - 0.05, -d2 * 1.07 + 0.12, PLINTH_H, PODIUM_H, { top: false, bottom: false }); // أعمدة بوديوم

  // — نواتا الجذع الصلبتان (سفليّة عريضة + علويّة أضيق = نكسة مودرن) —
  box(body, -w2, w2, -d2, d2, shaftZ0, setZ);
  box(body, -uw2, uw2, -ud2, ud2, setZ, shaftTop);
  // — شرفة عند نقطة التقاء الجزأين: أرضيّة بلاط كحليّ + سياج زجاجيّ جميل حول المحيط —
  box(navy, -w2, w2, -d2, d2, setZ, setZ + 0.2); // أرضيّة الشرفة الكحليّة (الحلقة المكشوفة حول الجزء العلويّ الأنحف)
  box(gA, -w2 - 0.05, w2 + 0.05, -d2 - 0.05, d2 + 0.05, setZ + 0.2, setZ + 1.25, { top: false, bottom: false }); // سياج زجاجيّ
  box(navy, -w2 - 0.08, w2 + 0.08, -d2 - 0.08, d2 + 0.08, setZ + 1.18, setZ + 1.32, { top: false, bottom: false }); // مسطرة السياج الكحليّة

  const place = (fb: FaceBufs, deg: number): void => {
    rotateAppend(fb.body, body, deg);
    rotateAppend(fb.gA, gA, deg);
    rotateAppend(fb.gB, gB, deg);
    rotateAppend(fb.winC, winC, deg);
    rotateAppend(fb.winW, winW, deg);
  };
  // — الطابق السفليّ (عريض) —
  const lf: FaceBufs = { body: buf(), gA: buf(), gB: buf(), winC: buf(), winW: buf() };
  buildTowerFace(w, d2, shaftZ0, setZ, 0, lf);
  const ls: FaceBufs = { body: buf(), gA: buf(), gB: buf(), winC: buf(), winW: buf() };
  buildTowerFace(d, w2, shaftZ0, setZ, 50, ls);
  place(lf, 0);
  place(lf, 180);
  place(ls, 90);
  place(ls, 270);
  // — الطابق العلويّ (الأنحف): ستارة زجاج كاملة + **مفاصل أفقيّة فقط** (٥ قطع زجاج فوق بعضها لكلّ جانب · بلا أيّ تقطيع عموديّ) —
  const uz0 = setZ + 1.0;
  box(gA, -uw2 - 0.06, uw2 + 0.06, -ud2 - 0.06, ud2 + 0.06, uz0, shaftTop, { top: false, bottom: false }); // زجاج كاسح يغطّي الجوانب الأربعة
  for (let i = 1; i < 5; i++) { const z = uz0 + ((shaftTop - uz0) * i) / 5; box(body, -uw2 - 0.1, uw2 + 0.1, -ud2 - 0.1, ud2 + 0.1, z - 0.13, z + 0.13, { top: false, bottom: false }); } // مفصل أفقيّ رفيع واضح (يقسّم الزجاج إلى ٥ قطع)

  // — التتويج (متغيّر حتميّ من البصمة — لئلّا تتطابق الأبراج المتجاورة) — م9.8
  box(accent, -uw2 - 0.24, uw2 + 0.24, -ud2 - 0.24, ud2 + 0.24, shaftTop - 1.6, shaftTop - 0.8, { top: false, bottom: false }); // حلقة مميِّزة (مشتركة)
  const crownV = hash2(Math.round(w), Math.round(d));
  const towerExtras: Extra[] = [];
  if (crownV < 0.34) {
    // (1) بارابيت + بنتهاوس ميكانيكيّ (الكلاسيكيّ)
    box(body, -uw2 - 0.12, uw2 + 0.12, -ud2 - 0.12, ud2 + 0.12, shaftTop, shaftTop + 0.7); // بارابيت
    box(crystal, -uw2 * 0.56, uw2 * 0.56, -ud2 * 0.56, ud2 * 0.56, shaftTop + 0.7, totalH); // المكعّب العلويّ الزجاجيّ الأزرق
    box(accent, -uw2 * 0.58, uw2 * 0.58, -ud2 * 0.58, ud2 * 0.58, totalH - 0.35, totalH, { top: false, bottom: false }); // خطّ تتويج متوهّج
  } else if (crownV < 0.67) {
    // (2) تتويج متدرّج (نكسة علويّة إضافيّة كزقّورة)
    const m1 = 0.74;
    const m2 = 0.5;
    const cz0 = shaftTop + 0.6;
    const czMid = cz0 + (totalH - cz0) * 0.55;
    box(body, -uw2 - 0.12, uw2 + 0.12, -ud2 - 0.12, ud2 + 0.12, shaftTop, cz0); // بارابيت
    box(body, -uw2 * m1, uw2 * m1, -ud2 * m1, ud2 * m1, cz0, czMid); // درجة وسطى
    box(crystal, -uw2 * m2, uw2 * m2, -ud2 * m2, ud2 * m2, czMid, totalH); // المكعّب العلويّ الزجاجيّ الأزرق
    box(accent, -uw2 * (m2 + 0.04), uw2 * (m2 + 0.04), -ud2 * (m2 + 0.04), ud2 * (m2 + 0.04), totalH - 0.3, totalH, { top: false, bottom: false }); // خطّ متوهّج
  } else {
    // (3) تراس-حديقة سماويّ بحاجز زجاجيّ + معدّات سطح
    box(gA, -uw2, uw2, -ud2, ud2, shaftTop, shaftTop + 1.0, { top: false, bottom: false }); // حاجز زجاجيّ محيط بالتراس
    const garden = buf();
    flatRect(garden, -uw2 * 0.86, uw2 * 0.86, -ud2 * 0.86, ud2 * 0.86, shaftTop + 0.12); // ديك أخضر
    towerExtras.push({ mesh: freeze(garden), color: [70, 122, 64, 255], lit: true });
    const eqTop = shaftTop + 1.0 + ROOF_H * 0.5;
    box(crystal, -uw2 * 0.34, uw2 * 0.06, -ud2 * 0.2, ud2 * 0.2, shaftTop + 1.0, eqTop); // المكعّب العلويّ الزجاجيّ الأزرق
    box(accent, -uw2 * 0.36, uw2 * 0.06, -ud2 * 0.22, ud2 * 0.22, eqTop - 0.3, eqTop, { top: false, bottom: false }); // خطّ متوهّج
  }

  // — المكعّب العلويّ الزجاجيّ الأزرق (بدل القبّة الملغاة) —
  towerExtras.push({ mesh: freeze(crystal), color: matColor("crystal"), lit: matLit("crystal") });

  // — قاعدة/ساحة البرج: بلاط أزرق-رماديّ فاتح جدّاً **بقطع بارزة** (مفاصل غائرة) + درج مدخل أماميّ (بلا حدائق ولا بوّابة) —
  const skyT = buf();
  const joint = buf();
  const pxR = w * 1.9;
  const pyR = d * 1.9;
  flatRect(joint, -pxR, pxR, -pyR, pyR, 0.05); // أرضيّة المفاصل الغائرة تحت البلاطات البارزة
  const TILE = 7; // **بلاطات كبيرة الحجم** (مربّعات)
  let nt = 0;
  for (let tx = -pxR; tx + TILE <= pxR && nt < 720; tx += TILE) {
    for (let ty = -pyR; ty + TILE <= pyR; ty += TILE) {
      if (Math.abs(tx + TILE / 2) < w2 * 1.1 && Math.abs(ty + TILE / 2) < d2 * 1.1) continue; // تخطّي ما تحت البرج
      box(skyT, tx + 0.07, tx + TILE - 0.07, ty + 0.07, ty + TILE - 0.07, 0.05, 0.22); // بلاطة كبيرة بارزة (الفجوة = خطّ مفصل **رفيع**)
      nt++;
    }
  }
  for (let i = 0; i < 4; i++) { const sy0 = -d2 * 1.06 - 2.7 + i * 0.55; box(navy, -w * 0.24, w * 0.24, sy0, sy0 + 0.55, 0, 0.18 * (i + 1)); } // درج مدخل واضح (-y)
  towerExtras.push({ mesh: freeze(navy), color: matColor("skyGray"), lit: matLit("skyGray") }); // القاعدة/الشرفة/الدرج (رماديّ سماويّ مطفأ)
  towerExtras.push({ mesh: freeze(skyT), color: [150, 158, 170, 255], lit: true }); // م9.9 · بلاط اسمنتيّ رماديّ هولوكراميّ **معتم لامع كرستاليّ** (كبير) — اللمعان من خامة Phong المعزَّزة
  towerExtras.push({ mesh: freeze(joint), color: [238, 242, 248, 255], lit: true }); // م9.9 · خطوط المفاصل **بيضاء رفيعة**

  return {
    body: freeze(body),
    glassA: freeze(gA),
    glassB: freeze(gB),
    winCool: freeze(winC),
    winWarm: freeze(winW),
    accent: freeze(accent),
    extras: towerExtras.length ? towerExtras : undefined,
    height: totalH,
  };
}

// م9.8 المرحلة 2 · مول فاخر: كتلة عريضة بستورفرونت + أحزمة لافتات + **قبّة أتريوم زجاجيّة (نصف كرة)**
// + مداخل/مظلّات متعدّدة + عمودا لافتات + وحدات سطح؛ ومرافق موقع مفصّلة: **مواقف بدهان وسيّارات + حدائق
// بأحواض وممرّات وصفوف + شارع خدمة + ساحة مدخل**. كلّها حتميّة وبخامات السجلّ. (w,d = بصمة المبنى.)
export function generateMall(w: number, d: number, heightM?: number): TowerMeshes {
  w = Math.min(w, 130); // بصمة أوسع (مبنى أكبر)
  d = Math.min(d, 105);
  const w2 = w / 2;
  const d2 = d / 2;
  const LEVELS = 4; // م9.8 (المرحلة 1) · أربعة مستويات: أرضيّ مزدوج الارتفاع + ثلاثة طوابق
  const GROUND_MUL = 1.4; // الطابق الأرضيّ أعلى (واجهة زجاجيّة كبرى)
  const targetH = heightM && heightM > 8 ? heightM : 24;
  const unit = targetH / (GROUND_MUL + (LEVELS - 1));
  const groundH = unit * GROUND_MUL; // ارتفاع الطابق الأرضيّ
  const upperH = unit; // ارتفاع كلّ طابق علويّ
  const baseH = groundH + (LEVELS - 1) * upperH; // = targetH
  const bandDepth = 3.2; // عمق نطاق المحلّات المرئيّ خلف زجاج الطابق الأرضيّ
  const body = buf();
  const gA = buf();
  const gB = buf();
  const winC = buf();
  const winW = buf();
  const accent = buf();
  const navy = buf(); // لمسات كحليّة (أعمدة/زوايا/كرنيش)
  const crystal = buf(); // قبّة كريستاليّة زرقاء متوهّجة

  box(body, -w2 * 1.03, w2 * 1.03, -d2 * 1.03, d2 * 1.03, 0, 0.35); // قاعدة منخفضة
  box(body, -w2 + bandDepth, w2 - bandDepth, -d2 + bandDepth, d2 - bandDepth, 0.35, groundH); // قلب الطابق الأرضيّ الغائر (يفتح نطاق محلّات زجاجيّاً حوله = رؤية للداخل)
  box(body, -w2, w2, -d2, d2, groundH, baseH); // الكتلة العلويّة الكاملة (تُظلّل النطاق الأرضيّ كسقف)

  const place = (fb: FaceBufs, deg: number): void => {
    rotateAppend(fb.body, body, deg);
    rotateAppend(fb.gA, gA, deg);
    rotateAppend(fb.gB, gB, deg);
    rotateAppend(fb.winC, winC, deg);
    rotateAppend(fb.winW, winW, deg);
  };
  const lf: FaceBufs = { body: buf(), gA: buf(), gB: buf(), winC: buf(), winW: buf() };
  buildMallFace(w, d2, LEVELS, groundH, upperH, bandDepth, lf);
  const ls: FaceBufs = { body: buf(), gA: buf(), gB: buf(), winC: buf(), winW: buf() };
  buildMallFace(d, w2, LEVELS, groundH, upperH, bandDepth, ls);
  place(lf, 0);
  place(lf, 180);
  place(ls, 90);
  place(ls, 270);

  for (let L = 1; L < LEVELS; L++) {
    const z = groundH + (L - 1) * upperH; // فاصل المستوى
    box(accent, -w2 - 0.1, w2 + 0.1, -d2 - 0.1, d2 + 0.1, z + 0.05, z + 0.45, { top: false, bottom: false }); // حزام لافتات متوهّج على السبَندرل
  }
  box(body, -w2 - 0.12, w2 + 0.12, -d2 - 0.12, d2 + 0.12, baseH, baseH + 0.8); // بارابيت

  // — كتل مفصّلة (مبنى مفصّل لا صندوقاً): متجرا مرساة أعلى عند الطرفين —
  const anchorH = baseH * 1.14;
  const aw = w * 0.17;
  box(body, -w2, -w2 + aw, -d2, d2, 0, anchorH); // مرساة يسار
  box(body, w2 - aw, w2, -d2, d2, 0, anchorH); // مرساة يمين
  box(accent, -w2 - 0.1, -w2 + aw + 0.1, -d2 - 0.1, d2 + 0.1, anchorH - 0.3, anchorH + 0.05, { top: false, bottom: false }); // حزام مرساة يسار
  box(accent, w2 - aw - 0.1, w2 + 0.1, -d2 - 0.1, d2 + 0.1, anchorH - 0.3, anchorH + 0.05, { top: false, bottom: false }); // حزام مرساة يمين
  // تغليف زجاجيّ أزرق للجزء البارز من المرساتين فوق سطح المبنى (زجاج المول ممتدّ إليهما)
  for (const ax of [-w2, w2 - aw]) box(gB, ax - 0.06, ax + aw + 0.06, -d2 - 0.06, d2 + 0.06, baseH, anchorH - 0.32, { top: false }); // غلاف زجاج المرساة

  // — البوّابة الزجاجيّة الكبرى (المدخل الرسميّ) على جهة الكراج (+y) + مظلّتان جانبيّتان (±x) —
  // — جناح المدخل المهيب بكامل ارتفاع المبنى (جهة الكراج +y): كتلة مزجّجة عموديّة بارزة + تتويج + مظلّة —
  const gw = w * 0.22; // نصف عرض الجناح
  const eProj = 5.5; // بروز الجناح
  const eF = d2 + eProj; // مستوى واجهة الجناح
  box(navy, -gw - 1.6, -gw, d2 - 0.3, eF, 0, baseH + 1.6); // دعامة عموديّة يسار كحليّة (كاملة الارتفاع)
  box(navy, gw, gw + 1.6, d2 - 0.3, eF, 0, baseH + 1.6); // دعامة عموديّة يمين كحليّة
  box(gA, -gw, gw, eF - 0.12, eF, 0.5, baseH, { top: false, bottom: false }); // زجاج كاسح عموديّ (واجهة الأتريوم)
  for (let c = -4; c <= 4; c++) box(body, c * (gw / 4.4) - 0.1, c * (gw / 4.4) + 0.1, eF - 0.14, eF + 0.02, 0.5, baseH, { top: false, bottom: false }); // مونتينات عموديّة
  for (let L = 1; L < LEVELS; L++) { const z = groundH + (L - 1) * upperH; box(accent, -gw - 0.1, gw + 0.1, eF - 0.16, eF + 0.04, z, z + 0.3, { top: false, bottom: false }); } // أحزمة طوابق متوهّجة على الزجاج
  box(accent, -gw - 2.0, gw + 2.0, d2 - 0.3, eF + 0.2, baseH + 1.6, baseH + 2.4); // تتويج الجناح المضيء
  box(accent, -gw - 2.2, gw + 2.2, eF - 0.2, eF + 1.8, groundH + 0.2, groundH + 0.5); // مظلّة مدخل أرضيّة بارزة

  // — جناح مدخل مهيب مماثل على الجهة المقابلة (الخلف -y · جهة المقاهي والحشد) —
  const eFb = -d2 - eProj; // واجهة الجناح الخلفيّ
  box(navy, -gw - 1.6, -gw, eFb, -d2 + 0.3, 0, baseH + 1.6); // دعامة عموديّة يسار كحليّة
  box(navy, gw, gw + 1.6, eFb, -d2 + 0.3, 0, baseH + 1.6); // دعامة عموديّة يمين كحليّة
  box(gA, -gw, gw, eFb, eFb + 0.12, 0.5, baseH, { top: false, bottom: false }); // زجاج كاسح عموديّ
  for (let c = -4; c <= 4; c++) box(body, c * (gw / 4.4) - 0.1, c * (gw / 4.4) + 0.1, eFb - 0.02, eFb + 0.14, 0.5, baseH, { top: false, bottom: false }); // مونتينات
  for (let L = 1; L < LEVELS; L++) { const z = groundH + (L - 1) * upperH; box(accent, -gw - 0.1, gw + 0.1, eFb - 0.04, eFb + 0.16, z, z + 0.3, { top: false, bottom: false }); } // أحزمة طوابق متوهّجة
  box(accent, -gw - 2.0, gw + 2.0, eFb - 0.2, -d2 + 0.3, baseH + 1.6, baseH + 2.4); // تتويج مضيء
  box(accent, -gw - 2.2, gw + 2.2, eFb - 1.8, eFb + 0.2, groundH + 0.2, groundH + 0.5); // مظلّة مدخل أرضيّة بارزة

  // — بروزات معماريّة على الجهات الأربع: أعمدة زاويّة كاملة الارتفاع + زعانف عموديّة + كرنيش تتويج محيط —
  const pil = 1.2; // نصف مقطع العمود الزاويّ
  for (const sgx of [-1, 1]) for (const sgy of [-1, 1]) box(navy, sgx * w2 - pil, sgx * w2 + pil, sgy * d2 - pil, sgy * d2 + pil, 0, anchorH + 0.8); // أعمدة زاويّة كحليّة ترتفع لنهاية الجانبين البارزين
  for (let x = -w2 + 11; x < w2 - 6; x += 12) { box(body, x - 0.3, x + 0.3, -d2 - 0.55, -d2 + 0.02, groundH, baseH, { top: false, bottom: false }); box(body, x - 0.3, x + 0.3, d2 - 0.02, d2 + 0.55, groundH, baseH, { top: false, bottom: false }); } // زعانف عموديّة أمام/خلف
  for (let y = -d2 + 11; y < d2 - 6; y += 12) { box(body, -w2 - 0.55, -w2 + 0.02, y - 0.3, y + 0.3, groundH, baseH, { top: false, bottom: false }); box(body, w2 - 0.02, w2 + 0.55, y - 0.3, y + 0.3, groundH, baseH, { top: false, bottom: false }); } // زعانف عموديّة يسار/يمين
  box(navy, -w2 - 0.5, w2 + 0.5, -d2 - 0.5, d2 + 0.5, baseH - 0.6, baseH + 0.15, { top: false, bottom: false }); // كرنيش تتويج كحليّ بارز محيط

  // — التتويج: قاعدة دائريّة زجاجيّة **واسعة** (أوسع من القبّة بهامش بارز) تتمركز فوقها قبّة كريستاليّة زرقاء بنفس المادة —
  const md = Math.min(w, d);
  const domeR = md * 0.3; // قطر القبّة موسّع (+60% عن السابق)
  const baseR = domeR + md * 0.055; // القاعدة أوسع من القبّة بهامش يحيطها
  const domeRise = domeR * 0.72;
  const drumTop = baseH + md * 0.1; // قمّة طبلة القاعدة (أخفض قليلاً)
  const capZ = drumTop + 0.06; // سطح القاعدة الزجاجيّ (الغطاء حول القبّة)
  const domeZ = capZ + 0.4; // مستوى انطلاق القبّة المركزيّة
  const metal = buf(); // معدن: تكييف السطح + أعمدة الإنارة + أضلاع القبّة + السارية
  const cover = buf(); // غطاء القاعدة الدائريّ المحيط بالقبّة (لون أفتح)
  cylinder(crystal, 0, 0, baseR, baseH, drumTop, 34); // طبلة القاعدة الزجاجيّة الواسعة (نوافذ كريستال على كامل الارتفاع والمحيط)
  for (let s = 0; s < 30; s++) { const a = (s / 30) * Math.PI * 2; box(navy, Math.cos(a) * baseR - 0.12, Math.cos(a) * baseR + 0.12, Math.sin(a) * baseR - 0.12, Math.sin(a) * baseR + 0.12, baseH, drumTop, { top: false, bottom: false }); } // مونتينات النوافذ
  cylinder(navy, 0, 0, baseR + 0.2, baseH - 0.05, baseH + 0.4, 34); // إفريز سفليّ كحليّ
  cylinder(navy, 0, 0, baseR + 0.22, drumTop - 0.4, drumTop + 0.06, 34); // إفريز علويّ كحليّ للقاعدة
  disc(cover, 0, 0, baseR, capZ, 34); // سطح القاعدة الزجاجيّ الواسع حول القبّة (الغطاء — لون أفتح)
  cylinder(navy, 0, 0, domeR + 0.25, capZ, domeZ, 30); // حلقة قاعدة القبّة المركزيّة
  dome(crystal, 0, 0, domeR, domeZ, domeRise, 9, 30); // القبّة الكريستاليّة الزرقاء المركزيّة فوق القاعدة الواسعة
  for (let t = 0; t <= 6; t++) { const p = (t / 7) * (Math.PI / 2); const rr = domeR * Math.cos(p); const zz = domeZ + domeRise * Math.sin(p); cylinder(metal, 0, 0, rr + 0.06, zz - 0.05, zz + 0.05, 30); } // فواصل القطع (حلقات)
  for (let s = 0; s < 14; s++) { const a = (s / 14) * Math.PI * 2; box(metal, Math.cos(a) * domeR * 0.5 - 0.05, Math.cos(a) * domeR * 0.5 + 0.05, Math.sin(a) * domeR * 0.5 - 0.05, Math.sin(a) * domeR * 0.5 + 0.05, domeZ, domeZ + domeRise * 0.6, { top: false, bottom: false }); } // أضلاع زواليّة
  cylinder(metal, 0, 0, 0.32, domeZ + domeRise, domeZ + domeRise + 1.6, 8); // سارية التاج

  // — مخازن خامات الموقع —
  const asphalt = buf();
  const paint = buf();
  const stone = buf();
  const veg = buf();
  const sand = buf();
  const trunk = buf();
  const pylon = buf();
  const porcelain = buf();
  const joint = buf();
  const water = buf();
  const banner = buf();
  const ppl = buf();
  const carA = buf();
  const carB = buf();
  const carGlass = buf();
  const fabric = buf();
  const roofT = buf();
  const marble = buf();
  const iron = buf();
  flatRect(roofT, -w2 + 0.3, w2 - 0.3, -d2 + 0.3, d2 - 0.3, baseH + 0.05); // بلاط سطح رماديّ مميّز يغطّي سطح المبنى
  sphere(banner, 0, 0, domeZ + domeRise + 1.9, 0.42, 2, 8); // فانوس تاج القبّة المضيء

  // صفّ منسّق من وحدات تكييف مركزيّة **صغيرة** فوق السطح (الجهة الأماميّة، بعيداً عن القبّة)
  const nAC = Math.max(4, Math.round(w / 15));
  for (let i = 0; i < nAC; i++) {
    const ax = -w * 0.33 + (i / (nAC - 1)) * w * 0.66;
    const ay = -d2 + 6; // صفّ على الحافّة الأماميّة من السطح (خارج قاعدة القبّة الواسعة)
    box(metal, ax - 1.3, ax + 1.3, ay - 1.0, ay + 1.0, baseH + 0.1, baseH + 1.0, { bottom: false }); // وحدة تكييف
    box(metal, ax - 1.0, ax + 1.0, ay - 0.75, ay + 0.75, baseH + 1.0, baseH + 1.12, { bottom: false }); // غطاء المروحة
  }

  // — مرافق الموقع (التوزيع الجديد: كراج +y · ساحة خلف -y · نافورتان وحدائق ±x · بورسلين على الجهات الثلاث) —
  const sideX = w2 * 1.95; // الحدّ الخارجيّ للأرضيّة الجانبيّة
  const rearY = d2 + 28; // عمق ساحة الخلف (-y)
  const parkY = d2 + 32; // عمق الكراج (+y)
  porcelainApron(porcelain, joint, -sideX, sideX, -rearY, -d2 - 0.2); // بورسلين ساحة الخلف ممتدّ لكامل عرض الحدائق (-y)
  porcelainApron(porcelain, joint, -sideX, -w2 - 0.2, -d2, d2); // بورسلين الجانب الأيسر (-x)
  porcelainApron(porcelain, joint, w2 + 0.2, sideX, -d2, d2); // بورسلين الجانب الأيمن (+x)
  porcelainApron(porcelain, joint, -sideX, sideX, d2 + 0.1, d2 + 7.4); // فناء أماميّ مرصوف ممتدّ لكامل عرض الحدائق (+y)
  const sideMid = (w2 + sideX) / 2;
  const fR = Math.min(6.5, (sideX - w2) / 2 - 2);
  fountain(stone, water, -sideMid, 0, fR, 11); // نافورة يسار تتوسّط البورسلين
  fountain(stone, water, sideMid, 0, fR, 21); // نافورة يمين
  // حدائق متناظرة تُحيط كلّ نافورة (أمامها وخلفها) + حلقة أشجار حولها
  garden(veg, sand, sand, trunk, veg, w2 + 3, sideX - 2, -d2 + 2, -fR - 4, 4);
  garden(veg, sand, sand, trunk, veg, w2 + 3, sideX - 2, fR + 4, d2 - 2, 5);
  garden(veg, sand, sand, trunk, veg, -sideX + 2, -w2 - 3, -d2 + 2, -fR - 4, 6);
  garden(veg, sand, sand, trunk, veg, -sideX + 2, -w2 - 3, fR + 4, d2 - 2, 7);
  for (const fx of [-sideMid, sideMid]) for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; tree(trunk, veg, fx + Math.cos(a) * (fR + 3), Math.sin(a) * (fR + 3), 6.5 + hash2(k, Math.round(fx)) * 1.8); } // حلقة أشجار حول كلّ نافورة
  // ساحة الخلف (-y): سارية مركزيّة + مقاهٍ تُحيط الجناح الخلفيّ + حشد متبضّعين
  signMast(metal, banner, 0, -rearY + 9, baseH * 0.95);
  cafeTerrace(fabric, trunk, -sideX + 4, -gw - 3, -d2 - 9, 6.5, 7); // مقاهٍ يسار الجناح الخلفيّ
  cafeTerrace(fabric, trunk, gw + 3, sideX - 4, -d2 - 9, 6.5, 7); // مقاهٍ يمينه
  crowd(ppl, -sideX * 0.9, sideX * 0.9, -rearY + 2, -d2 - 1.5, 60, 31);
  // جهة الكراج (+y): أرضيّة ممتدّة لعرض الحدائق + سيّارات وسطيّة + حشد + إنارة
  realCarsLot(asphalt, paint, carA, carB, carGlass, -w2 * 0.98, w2 * 0.98, d2 + 7.5, parkY, 1);
  flatRect(asphalt, -sideX, -w2 * 0.98, d2 + 7.5, parkY); // امتداد أرضيّة الكراج لليسار حتى حدّ الحدائق
  flatRect(asphalt, w2 * 0.98, sideX, d2 + 7.5, parkY); // ولليمين
  crowd(ppl, -gw, gw, d2 + 1, d2 + 6.5, 14, 41);
  for (let i = 0; i < 6; i++) { const lx = -w2 * 0.8 + (i / 5) * w2 * 1.6; const ly = d2 + 12.5; prism(metal, lx, ly, 0.18, 0, 7, 6); box(pylon, lx - 0.6, lx + 0.6, ly - 0.3, ly + 0.3, 6.8, 7.3); } // أعمدة إنارة المواقف

  // — سور محيطيّ منخفض حول الموقع كلّه (رخام سفليّ + سياج حديديّ مزخرف) + بوّابة حديديّة ونقطة حرس على مدخل الكراج (+y) —
  const gateW = 10;
  perimeterWall(marble, iron, -sideX, sideX, -rearY, parkY, 0, gateW);
  for (const sgn of [-1, 1]) { // مصراعا البوّابة الحديديّان المزخرفان
    const a = sgn < 0 ? -gateW / 2 + 0.1 : 0.25;
    const b = sgn < 0 ? -0.25 : gateW / 2 - 0.1;
    box(iron, a, b, parkY - 0.07, parkY + 0.07, 0.15, 4.2); // لوح المصراع
    box(iron, a, b, parkY - 0.08, parkY + 0.08, 2.0, 2.12); // مسطرة وسطى
    for (let x = a + 0.25; x < b; x += 0.55) box(iron, x - 0.045, x + 0.045, parkY - 0.08, parkY + 0.08, 0.15, 4.4); // قضبان مزخرفة برؤوس
  }
  const kx = gateW / 2 + 1.8; // كشك نقطة الحرس بجانب البوّابة
  box(marble, kx, kx + 3.0, parkY - 1.5, parkY + 1.5, 0, 3.6); // جدران الكشك
  box(gA, kx + 0.12, kx + 2.88, parkY - 1.62, parkY - 1.5, 1.0, 3.0, { top: false, bottom: false }); // زجاج الكشك
  box(navy, kx - 0.3, kx + 3.3, parkY - 1.7, parkY + 1.7, 3.6, 4.05); // سقف الكشك

  return {
    body: freeze(body),
    glassA: freeze(gA),
    glassB: freeze(gB),
    winCool: freeze(winC),
    winWarm: freeze(winW),
    accent: freeze(accent),
    extras: [
      { mesh: freeze(asphalt), color: matColor("asphalt"), lit: matLit("asphalt"), tex: "asphalt" },
      { mesh: freeze(paint), color: matColor("roadPaint"), lit: matLit("roadPaint") },
      { mesh: freeze(porcelain), color: matColor("porcelain"), lit: matLit("porcelain"), tex: "tile" }, // بورسلين الجهات الثلاث
      { mesh: freeze(joint), color: matColor("concrete"), lit: matLit("concrete") }, // مفاصل البلاط
      { mesh: freeze(stone), color: matColor("stone"), lit: matLit("stone") }, // أحواض النوافير
      { mesh: freeze(water), color: matColor("water"), lit: matLit("water") }, // ماء النوافير
      { mesh: freeze(veg), color: matColor("vegetation"), lit: matLit("vegetation") },
      { mesh: freeze(sand), color: matColor("sand"), lit: matLit("sand") },
      { mesh: freeze(trunk), color: matColor("wood"), lit: matLit("wood") }, // جذوع + أثاث المقاهي
      { mesh: freeze(metal), color: matColor("metal"), lit: matLit("metal"), tex: "metal" }, // سطح + أعمدة + أضلاع القبّة + سارية
      { mesh: freeze(pylon), color: matColor("signage"), lit: matLit("signage") }, // رؤوس الإنارة
      { mesh: freeze(banner), color: matColor("bannerLight"), lit: matLit("bannerLight") }, // بانر السارية + فانوس القبّة
      { mesh: freeze(ppl), color: matColor("crowd"), lit: matLit("crowd") }, // الحشد
      { mesh: freeze(carA), color: matColor("carBody"), lit: matLit("carBody") }, // سيّارات فضيّة
      { mesh: freeze(carB), color: matColor("carAccent"), lit: matLit("carAccent") }, // سيّارات داكنة
      { mesh: freeze(carGlass), color: matColor("carGlass"), lit: matLit("carGlass") }, // زجاج السيّارات
      { mesh: freeze(fabric), color: matColor("fabric"), lit: matLit("fabric") }, // مظلّات المقاهي
      { mesh: freeze(navy), color: matColor("navy"), lit: matLit("navy") }, // لمسات كحليّة (أعمدة/زوايا/كرنيش)
      { mesh: freeze(crystal), color: matColor("crystal"), lit: matLit("crystal") }, // قبّة كريستاليّة زرقاء متوهّجة
      { mesh: freeze(cover), color: matColor("crystalLight"), lit: matLit("crystalLight") }, // غطاء قاعدة القبّة (أفتح)
      { mesh: freeze(roofT), color: matColor("roofTile"), lit: matLit("roofTile"), tex: "tile" }, // بلاط السطح الرماديّ
      { mesh: freeze(marble), color: matColor("marble"), lit: matLit("marble") }, // رخام السور/الكشك
      { mesh: freeze(iron), color: matColor("iron"), lit: matLit("iron") }, // حديد السياج/البوّابة
    ],
    height: drumTop + domeRise + 2.2,
  };
}

// م9.9 · فندق/منتجع 5 نجوم أيقونيّ: بوديوم فخم بمحيط **زجاج أزرق** + برج نزلاء **متدرّج** + سطح **مهبط هليكوبتر**.
// الأرضيّة (مناطق قابلة للتعديل): +Y مسبح كبير وشرفة وشزلونات ومظلّات وكافيه؛ −Y كراج سيّارات حقيقيّة + بوّابة دخول فخمة؛
// شريطا حدائق وأشجار على جانبَي الفندق (±X) من الكراج للمسبح. الزجاج الأزرق اللامع والانعكاسات من طبقة العرض.
export function generateHotel(w: number, d: number, heightM?: number): TowerMeshes {
  const w2 = w / 2;
  const d2 = d / 2;
  const ref = Math.max(w, d);
  const podiumH = 11.0;
  const towerTop = heightM && heightM > podiumH + 6 ? heightM : Math.max(36, Math.min(70, ref * 2.8));
  const tw = w * 0.92; // شريحة عريضة
  const td = d * 0.42; // رفيعة العمق
  const body = buf();
  const gA = buf(); // كلّ الزجاج الأزرق (لوبي + **محيط البوديوم** + سكاي لاونج)
  const gB = buf();
  const winC = buf();
  const winW = buf();
  const accent = buf();

  // — بوديوم فخم بمحيط **زجاج أزرق ستائريّ** + كرنيشان ذهبيّان —
  box(body, -w2 * 1.14, w2 * 1.14, -d2 * 1.14, d2 * 1.14, 0, 1.3); // قاعدة عريضة
  box(gA, -w2 * 1.02, w2 * 1.02, -d2 * 1.02, d2 * 1.02, 1.5, podiumH - 0.9, { top: false, bottom: false }); // محيط زجاج أزرق
  // **تقسيمات/مفاصل** زجاج البوديوم: شبكة مونتينات كحليّة داكنة (رأسيّة كلّ 3.2م + 3 أحزمة أفقيّة) ⇒ عمق وظلال ولمعان مقسّم
  const mull = buf();
  const mzT = podiumH - 1.0;
  const mz0 = 1.7;
  for (const yy of [-d2 * 1.02 - 0.05, d2 * 1.02 + 0.05]) {
    for (let x = -w2; x <= w2 + 0.01; x += 3.2) box(mull, x - 0.09, x + 0.09, yy - 0.06, yy + 0.06, mz0, mzT);
    for (const z of [mz0, (mz0 + mzT) / 2, mzT]) box(mull, -w2 * 1.02, w2 * 1.02, yy - 0.06, yy + 0.06, z - 0.07, z + 0.07);
  }
  for (const xx of [-w2 * 1.02 - 0.05, w2 * 1.02 + 0.05]) {
    for (let y = -d2; y <= d2 + 0.01; y += 3.2) box(mull, xx - 0.06, xx + 0.06, y - 0.09, y + 0.09, mz0, mzT);
    for (const z of [mz0, (mz0 + mzT) / 2, mzT]) box(mull, xx - 0.06, xx + 0.06, -d2 * 1.02, d2 * 1.02, z - 0.07, z + 0.07);
  }
  box(body, -w2, w2, -d2, d2, podiumH - 0.9, podiumH); // تاج البوديوم
  box(accent, -w2 * 1.05, w2 * 1.05, -d2 * 1.05, d2 * 1.05, 1.1, 1.6, { top: false, bottom: false }); // كرنيش سفليّ ذهبيّ
  box(accent, -w2 * 1.05, w2 * 1.05, -d2 * 1.05, d2 * 1.05, podiumH - 0.5, podiumH + 0.25, { top: false, bottom: false }); // كرنيش علويّ ذهبيّ

  // — برج النزلاء **المتدرّج**: 3 طبقات تتناقص + إفريز تراجع ذهبيّ —
  const H = towerTop - podiumH;
  const tiers = [
    { w: tw, d: td, z0: podiumH, z1: podiumH + H * 0.44 },
    { w: tw * 0.84, d: td * 0.9, z0: podiumH + H * 0.44, z1: podiumH + H * 0.76 },
    { w: tw * 0.66, d: td * 0.8, z0: podiumH + H * 0.76, z1: towerTop },
  ];
  const place = (fb: FaceBufs, deg: number): void => {
    rotateAppend(fb.body, body, deg);
    rotateAppend(fb.gA, gA, deg);
    rotateAppend(fb.gB, gB, deg);
    rotateAppend(fb.winC, winC, deg);
    rotateAppend(fb.winW, winW, deg);
  };
  for (let ti = 0; ti < tiers.length; ti++) {
    const t = tiers[ti]!;
    const hw = t.w / 2;
    const hd = t.d / 2;
    box(body, -hw, hw, -hd, hd, t.z0, t.z1);
    const fa: FaceBufs = { body: buf(), gA: buf(), gB: buf(), winC: buf(), winW: buf() };
    buildFace(t.w, hd, t.z0, t.z1, 5 + ti, fa);
    const fs: FaceBufs = { body: buf(), gA: buf(), gB: buf(), winC: buf(), winW: buf() };
    buildFace(t.d, hw, t.z0, t.z1, 55 + ti, fs);
    place(fa, 0);
    place(fa, 180);
    place(fs, 90);
    place(fs, 270);
    if (ti < tiers.length - 1) {
      const n = tiers[ti + 1]!;
      box(accent, -n.w / 2 - 1.2, n.w / 2 + 1.2, -n.d / 2 - 1.2, n.d / 2 + 1.2, t.z1 - 0.3, t.z1 + 0.12, { top: false }); // إفريز تراجع ذهبيّ
    }
  }

  // — السطح: **مهبط هليكوبتر** (بدل القبّة): قرص ذهبيّ + سطح داكن + حرف H أبيض متوهّج + أضواء محيطيّة —
  const padR = Math.min(tiers[2]!.w, tiers[2]!.d) * 0.46;
  const mark = buf();
  const padLight = buf();
  disc(accent, 0, 0, padR + 0.7, towerTop + 0.1, 30); // حلقة المهبط الذهبيّة (إطار)
  disc(body, 0, 0, padR, towerTop + 0.18, 30); // سطح المهبط الداكن
  box(mark, -padR * 0.42 - 0.28, -padR * 0.42 + 0.28, -padR * 0.5, padR * 0.5, towerTop + 0.18, towerTop + 0.26); // ساق H يسار
  box(mark, padR * 0.42 - 0.28, padR * 0.42 + 0.28, -padR * 0.5, padR * 0.5, towerTop + 0.18, towerTop + 0.26); // ساق H يمين
  box(mark, -padR * 0.42, padR * 0.42, -0.28, 0.28, towerTop + 0.18, towerTop + 0.26); // عارضة H
  for (let s = 0; s < 8; s++) {
    const a = (s / 8) * Math.PI * 2;
    cylinder(padLight, Math.cos(a) * (padR - 0.4), Math.sin(a) * (padR - 0.4), 0.16, towerTop + 0.18, towerTop + 0.5, 5); // أضواء محيطيّة
  }

  // ===== أرضيّة المنتجع =====
  const SX = w2 + 14; // امتداد جانبيّ (±X) للحدائق
  const platDepth = d * 1.5; // **توسيع القاعدة جهة المسبح بـ1.5× إضافيّة من مساحتها**
  const platTop = 1.5; // ارتفاع المنصّة (قاعدة مرتفعة)
  const POOL_FAR = d2 + platDepth; // نهاية منصّة المسبح
  const GAR_FAR = -d2 - Math.max(22, d * 0.6); // ساحة السيّارات أمام المدخل (عمق كافٍ لتوليد السيّارات)

  const tile = buf();
  const joint = buf();
  const water = buf();
  const lane = buf(); // خطوط مسارب المسبح (ماء واقعيّ)
  const marble = buf();
  const fabric = buf();
  const trunk = buf(); // جذوع + أثاث
  const pole = buf();
  const iron = buf(); // سياج حديديّ للسور
  const bush = buf(); // شجيرات كثيفة

  // — منصّة المسبح الممتدّة (1.5×) + **باب زجاجيّ للقاعدة مطلّ على المسبح** + درج —
  box(body, -w2 * 1.18, w2 * 1.18, d2 * 1.1, POOL_FAR, 0, platTop); // المنصّة الممتدّة (نفس مادّة القاعدة)
  box(accent, -w2 * 1.21, w2 * 1.21, d2 * 1.1, POOL_FAR, platTop - 0.28, platTop + 0.14, { top: false, bottom: false }); // كرنيش الحافّة الذهبيّ
  flatRect(tile, -w2 * 1.16, w2 * 1.16, d2 * 1.1, POOL_FAR - 0.3, platTop + 0.02); // سطح المنصّة المرصوف
  box(accent, -w * 0.18, w * 0.18, d2 - 0.15, d2 + 0.2, 0, 4.8, { top: false, bottom: false }); // إطار الباب الذهبيّ (جهة المسبح)
  box(gA, -w * 0.16, w * 0.16, d2 - 0.06, d2 + 0.12, 0.1, 4.5, { top: false, bottom: false }); // زجاج الباب
  for (let s = 0; s < 3; s++) box(marble, -w * 0.21, w * 0.21, d2 + 0.2 + s * 0.55, d2 + 0.75 + s * 0.55, platTop - (s + 1) * 0.36, platTop - s * 0.36); // درج للمنصّة

  // — المسبح **مستطيل داخل حدود البلاط** + ماء واقعيّ بخطوط مسارب + إفريز رخاميّ —
  const px0 = -w2 * 0.8;
  const px1 = w2 * 0.8;
  const py0 = d2 + platDepth * 0.34;
  const py1 = POOL_FAR - 4.2;
  box(marble, px0 - 0.9, px1 + 0.9, py0 - 0.9, py0, platTop + 0.02, platTop + 0.36, { bottom: false });
  box(marble, px0 - 0.9, px1 + 0.9, py1, py1 + 0.9, platTop + 0.02, platTop + 0.36, { bottom: false });
  box(marble, px0 - 0.9, px0, py0 - 0.9, py1 + 0.9, platTop + 0.02, platTop + 0.36, { bottom: false });
  box(marble, px1, px1 + 0.9, py0 - 0.9, py1 + 0.9, platTop + 0.02, platTop + 0.36, { bottom: false });
  flatRect(water, px0, px1, py0, py1, platTop + 0.14); // ماء أزرق صافٍ
  for (let k = 1; k < 6; k++) {
    const lx = px0 + (k * (px1 - px0)) / 6;
    box(lane, lx - 0.07, lx + 0.07, py0 + 0.6, py1 - 0.6, platTop + 0.15, platTop + 0.16); // خطّ مسرب
  }

  // — شزلونات + مظلّات **أكثر** (صفّان مظلّلان) + كافيه بطاولات أكثر —
  for (let i = 0; i < 14; i++) {
    const lx = px0 + (i * (px1 - px0)) / 13;
    box(marble, lx - 0.55, lx + 0.55, py0 - 2.7, py0 - 1.2, platTop + 0.02, platTop + 0.5);
    box(marble, lx - 0.55, lx + 0.55, py1 + 1.2, py1 + 2.7, platTop + 0.02, platTop + 0.5);
    if (i % 2 === 0) {
      cylinder(pole, lx, py0 - 1.95, 0.07, platTop + 0.5, platTop + 3.0, 5);
      disc(fabric, lx, py0 - 1.95, 1.6, platTop + 3.0, 10);
      cylinder(pole, lx, py1 + 1.95, 0.07, platTop + 0.5, platTop + 3.0, 5);
      disc(fabric, lx, py1 + 1.95, 1.6, platTop + 3.0, 10);
    }
  }
  for (let i = 0; i < 8; i++) {
    const cx = -w2 * 0.7 + (i * (w2 * 1.4)) / 7;
    box(trunk, cx - 0.45, cx + 0.45, d2 + 3.0, d2 + 3.9, platTop + 0.02, platTop + 0.67); // طاولة كافيه
    cylinder(pole, cx, d2 + 3.45, 0.06, platTop + 0.67, platTop + 2.5, 5);
    disc(fabric, cx, d2 + 3.45, 1.3, platTop + 2.5, 8); // مظلّة كافيه
  }

  // — جهة المدخل (−Y): ساحة سيّارات أسفلت مخطّطة + **بلاط مدخل أنيق أمام الباب** + باب زجاجيّ للبوديوم —
  const asphalt = buf();
  const paint = buf();
  const carA = buf();
  const carB = buf();
  const carGlass = buf();
  realCarsLot(asphalt, paint, carA, carB, carGlass, -w2 * 1.06, w2 * 1.06, GAR_FAR + 1, -d2 - 11.5, 11); // مواقف أسفلت مخطّطة بسيّارات
  // **ممرّ مدخل أسفلت رصاصيّ داكن متّصل بالكراج** حتى عتبة الباب (يغطّي الجزء الأزرق) — أرضيّة واحدة متّصلة
  flatRect(asphalt, -w2 * 1.06, w2 * 1.06, -d2 - 11.5, -d2 + 0.1, 0.045);
  box(accent, -w * 0.34, w * 0.34, -d2 - 8.0, -d2 + 0.2, 4.6, 5.4, { top: false, bottom: false }); // مظلّة المدخل
  for (const cx of [-w * 0.3, w * 0.3]) box(body, cx - 0.34, cx + 0.34, -d2 - 7.4, -d2 - 6.8, 0, 4.6); // أعمدة المظلّة
  box(accent, -w * 0.2, w * 0.2, -d2 - 0.2, -d2 + 0.15, 0, 5.0, { top: false, bottom: false }); // إطار باب المدخل الذهبيّ
  box(gA, -w * 0.18, w * 0.18, -d2 - 0.12, -d2 + 0.06, 0.1, 4.7, { top: false, bottom: false }); // زجاج باب المدخل

  // — جانبا الفندق (±X): مرج + **نخيل أكثف + شجيرات** —
  const veg = buf();
  const sand = buf();
  const palmC = buf();
  flatRect(veg, w2 + 1, SX + 1.5, GAR_FAR - 1.5, POOL_FAR + 1.5, 0.05); // يمين — يلامس السور (لا فراغ)
  flatRect(veg, -SX - 1.5, -w2 - 1, GAR_FAR - 1.5, POOL_FAR + 1.5, 0.05); // يسار — يلامس السور
  for (let i = 0; i < 40; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const px = side * (w2 + 3.0 + (SX - w2 - 5.5) * (0.15 + 0.7 * hash2(i + 1, 9)));
    const py = GAR_FAR + 4 + (POOL_FAR - GAR_FAR - 9) * (i / 40 + 0.025 * hash2(i + 2, 4));
    if (i % 3 === 0) tree(trunk, palmC, px, py, 9 + 2 * hash2(i, 5)); // أشجار ظليلة حقيقيّة
    else palm(trunk, palmC, px, py, 11 + 1.5 * hash2(i, 7)); // نخيل
    sphere(bush, px + side * 1.6, py + 0.9, 0.85 + 0.3 * hash2(i, 3), 0.9, 2, 7); // شجيرة كثيفة
  }

  // — **سور محيطيّ أنيق حول كلّ الحدود (٤ جهات)** + بوّابة جهة الكراج + كشك أمن زجاجيّ —
  const WX0 = -SX - 1.5;
  const WX1 = SX + 1.5;
  const WY0 = GAR_FAR - 1.5; // جهة الكراج (البوّابة)
  const WY1 = POOL_FAR + 1.5; // جهة المسبح
  const gateW = w * 0.5;
  const wH = (a: number, b: number, yy: number): void => {
    if (b - a < 1) return;
    box(marble, a, b, yy - 0.45, yy + 0.45, 0, 1.9); // قاعدة رخام
    box(iron, a, b, yy - 0.05, yy + 0.05, 3.4, 3.6); // مسطرة علويّة
    for (let x = a + 0.6; x <= b; x += 1.9) box(iron, x - 0.05, x + 0.05, yy - 0.05, yy + 0.05, 1.9, 3.5); // قضبان
    for (let x = a; x <= b + 0.01; x += 9) box(marble, x - 0.2, x + 0.2, yy - 0.2, yy + 0.2, 0, 4.0); // أعمدة
  };
  const wV = (a: number, b: number, xx: number): void => {
    if (b - a < 1) return;
    box(marble, xx - 0.45, xx + 0.45, a, b, 0, 1.9);
    box(iron, xx - 0.05, xx + 0.05, a, b, 3.4, 3.6);
    for (let y = a + 0.6; y <= b; y += 1.9) box(iron, xx - 0.05, xx + 0.05, y - 0.05, y + 0.05, 1.9, 3.5);
    for (let y = a; y <= b + 0.01; y += 9) box(marble, xx - 0.2, xx + 0.2, y - 0.2, y + 0.2, 0, 4.0);
  };
  wH(WX0, -gateW / 2, WY0); // جهة الكراج يسار الفتحة
  wH(gateW / 2, WX1, WY0); // جهة الكراج يمين الفتحة
  wH(WX0, WX1, WY1); // جهة المسبح
  wV(WY0, WY1, WX0); // يسار
  wV(WY0, WY1, WX1); // يمين
  box(marble, -gateW / 2 - 0.8, -gateW / 2 + 0.4, WY0 - 0.6, WY0 + 0.6, 0, 4.9); // عمود البوّابة يسار
  box(marble, gateW / 2 - 0.4, gateW / 2 + 0.8, WY0 - 0.6, WY0 + 0.6, 0, 4.9); // عمود البوّابة يمين
  // **مصراعا بوّابة حديديّة أنيقة** (قضبان زخرفيّة) عند الفتحة
  for (const [a, b] of [[-gateW / 2 + 0.15, -0.12], [0.12, gateW / 2 - 0.15]] as const) {
    box(iron, a, b, WY0 - 0.06, WY0 + 0.06, 3.2, 3.5); // إطار علويّ للمصراع
    box(iron, a, b, WY0 - 0.06, WY0 + 0.06, 0.1, 0.25); // إطار سفليّ
    for (let x = a + 0.2; x <= b; x += 0.55) box(iron, x - 0.045, x + 0.045, WY0 - 0.05, WY0 + 0.05, 0.25, 3.4); // قضبان رأسيّة
  }
  box(marble, gateW / 2 + 1.6, gateW / 2 + 4.4, WY0 - 1.4, WY0 + 1.4, 0, 0.4); // قاعدة كشك الأمن
  box(gA, gateW / 2 + 1.8, gateW / 2 + 4.2, WY0 - 1.2, WY0 + 1.2, 0.4, 3.0, { top: false }); // زجاج كشك الأمن
  box(accent, gateW / 2 + 1.5, gateW / 2 + 4.5, WY0 - 1.5, WY0 + 1.5, 3.0, 3.4); // سقف كشك الأمن

  return {
    body: freeze(body),
    glassA: freeze(gA),
    glassB: freeze(gB),
    winCool: freeze(winC),
    winWarm: freeze(winW),
    accent: freeze(accent),
    extras: [
      { mesh: freeze(tile), color: matColor("porcelain"), lit: matLit("porcelain"), tex: "tile" }, // شرفة/بلاط فخم
      { mesh: freeze(joint), color: matColor("concrete"), lit: matLit("concrete") }, // مفاصل البلاط
      { mesh: freeze(mull), color: [24, 38, 70, 255], lit: true }, // مونتينات/مفاصل زجاج البوديوم الكحليّة
      { mesh: freeze(water), color: [44, 158, 220, 236], lit: false }, // ماء المسبح الأزرق الصافي
      { mesh: freeze(lane), color: [205, 230, 245, 255], lit: false }, // خطوط مسارب المسبح
      { mesh: freeze(marble), color: matColor("marble"), lit: matLit("marble") }, // شزلونات + بيلونات
      { mesh: freeze(fabric), color: matColor("fabric"), lit: matLit("fabric") }, // مظلّات المسبح/الكافيه
      { mesh: freeze(pole), color: matColor("metal"), lit: matLit("metal") }, // أعمدة المظلّات
      { mesh: freeze(asphalt), color: [54, 57, 64, 255], lit: true }, // أرضيّة الكراج أسفلت رصاصيّ داكن (بلا كساء فاتح يطمس اللون)
      { mesh: freeze(paint), color: matColor("roadPaint"), lit: matLit("roadPaint") }, // خطوط المواقف
      { mesh: freeze(carA), color: matColor("carBody"), lit: matLit("carBody") }, // سيّارات فضيّة
      { mesh: freeze(carB), color: matColor("carAccent"), lit: matLit("carAccent") }, // سيّارات داكنة
      { mesh: freeze(carGlass), color: matColor("carGlass"), lit: matLit("carGlass") }, // زجاج السيّارات
      { mesh: freeze(veg), color: matColor("vegetation"), lit: matLit("vegetation") }, // نباتات الحدائق
      { mesh: freeze(sand), color: matColor("sand"), lit: matLit("sand") }, // تربة/ممرّات
      { mesh: freeze(trunk), color: matColor("wood"), lit: matLit("wood") }, // جذوع النخيل + الطاولات
      { mesh: freeze(palmC), color: matColor("vegetation"), lit: matLit("vegetation") }, // تيجان النخيل
      { mesh: freeze(bush), color: [58, 122, 64, 255], lit: true }, // شجيرات كثيفة
      { mesh: freeze(iron), color: matColor("iron"), lit: matLit("iron") }, // سياج السور الحديديّ
      { mesh: freeze(mark), color: [235, 242, 250, 255], lit: false }, // علامات المهبط البيضاء المتوهّجة
      { mesh: freeze(padLight), color: [120, 230, 255, 255], lit: false }, // أضواء المهبط
    ],
    height: towerTop + 0.6,
  };
}

/** موزّع توليد النموذج حسب القطاع/النوع (مع ارتفاع يدويّ اختياريّ). */
export function generateModel(kind: ModelKind, w: number, d: number, heightM?: number): TowerMeshes {
  if (kind === "mall") return generateMall(w, d, heightM);
  if (kind === "hotel") return generateHotel(w, d, heightM);
  return generateTower(w, d, heightM);
}

// م9.8 · حديقة ممرّ بين صفّي الأبراج (عشب + ممرّ مركزيّ حجريّ + صفّا أشجار) — كيان مستقلّ يُوضَع وسط الموقع متعدّد الأبراج.
export function generateGardenStrip(lengthM: number, widthM: number): TowerMeshes {
  const L = Math.max(lengthM, 8);
  const W = Math.max(widthM, 5);
  const veg = buf();
  const stone = buf();
  const trunk = buf();
  const crown = buf();
  const baseZ = 0.34; // منصّة مرتفعة فوق بلاط ساحات الأبراج (≈0.2) كي تظهر الحديقة كاملة غير مغطّاة
  box(stone, -L / 2, L / 2, -W / 2, W / 2, 0, baseZ - 0.02, { top: false }); // منصّة الحديقة المرتفعة (تحجب البلاط تحتها)
  flatRect(veg, -L / 2, L / 2, -W / 2, W / 2, baseZ); // عشب يملأ كامل عرض الممرّ
  flatRect(stone, -L / 2, L / 2, -1.0, 1.0, baseZ + 0.03); // ممرّ مركزيّ طوليّ
  // حديقة مكتملة متناظرة: صفّا أشجار قرب الحافّتين + صفّا شجيرات بين الممرّ والأشجار — على كامل الطول وكلا الجانبين
  const ty = W * 0.34;
  const sy = W * 0.17;
  for (let x = -L / 2 + 2.5; x <= L / 2 - 2.5; x += 5) {
    tree(trunk, crown, x, -ty, 6 + hash2(Math.round(x), 1) * 2.2);
    tree(trunk, crown, x, ty, 6 + hash2(Math.round(x), 2) * 2.2);
    sphere(crown, x + 2.5, -sy, 0.85, 0.7, 2, 7);
    sphere(crown, x + 2.5, sy, 0.85, 0.7, 2, 7);
  }
  const empty = (): Mesh3 => freeze(buf());
  return {
    body: empty(), glassA: empty(), glassB: empty(), winCool: empty(), winWarm: empty(), accent: empty(),
    extras: [
      { mesh: freeze(veg), color: matColor("vegetation"), lit: matLit("vegetation") },
      { mesh: freeze(stone), color: matColor("stone"), lit: matLit("stone") },
      { mesh: freeze(trunk), color: matColor("wood"), lit: matLit("wood") },
      { mesh: freeze(crown), color: matColor("vegetation"), lit: matLit("vegetation") },
    ],
    height: 8,
  };
}
