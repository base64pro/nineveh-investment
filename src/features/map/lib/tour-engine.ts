// م9.10 · محرّك الجولة السينمائيّة الأوتوماتيكيّة — **نقيّ وحتميّ** (بلا Math.random، بلا DOM). يبني خطّاً زمنياً من
// مقاطع مُوقَّتة، وكلّ إطار يُعطي حالة كاميرا {center, altM, pitch, bearing, refId} عند زمن t. القائد (investment-map)
// يحوّل altM→zoom بخطّ العرض الحيّ للمركز ويستدعي map.jumpTo. الارتفاع «altM» هنا مسافة تأطير زائفة (نفس اصطلاح
// zoomForModel: targetAlt) لا ارتفاع فيزيائيّ — متوافق مع كيفية تأطير الخريطة القائمة.
import type { ModelKind } from "./parametric-tower";

// ===== الأنواع =====
export type LngLat = [number, number];

export type TourLoc = {
  refId: string;
  center: LngLat;
  footprintM: number;
  heightM: number;
  kind: ModelKind;
  rotationDeg: number;
  closeApproach?: boolean; // م9.11 · جولة خاصّة (غطس قريب نحو الباب → ارتفاع وتصوير → دوران ٣٦٠° → انسحاب) — لمبنى الهيئة الواقعيّ
};

// حالة الكاميرا عند البدء (تُمرَّر من الخريطة) — لانطلاق اقتراب الموقع الأوّل بسلاسة من حيث الكاميرا الآن.
export type StartCam = { center: LngLat; bearing: number; pitch: number; altM: number };

export type CamFrame = {
  center: LngLat;
  altM: number; // مسافة التأطير — يحوّلها القائد إلى zoom بخطّ العرض الحيّ
  pitch: number; // درجات
  bearing: number; // درجات (قد تتجاوز 360 في الدورة الجمعيّة — MapLibre يلفّها)
  refId: string | null; // المجسّم المركَّز عليه (لـmodelFocusId)
};

export type TourTimeline = { durationMs: number; sample(tMs: number): CamFrame };

export type TourMode = { id: number; label: string; description: string };

// ===== سجلّ الأوضاع (قابل للتوسعة — «سنخزنها») =====
export const TOUR_MODES: readonly TourMode[] = [
  {
    id: 1,
    label: "وضع ١ — اقتراب ودوران ٣٦٠° صاعد",
    description:
      "طيران كالحاليّ للموقع الأوّل (مدار ١٨٠°)، ثمّ لكلّ موقع تالٍ: نزول لـ١كم منتصف الطريق، وصول من الباب، اقتراب ٤٠٠م، ودورة ٣٦٠° تصعد إلى ١٠٠٠م وتميل نحو نظرة علويّة.",
  },
];

// ===== ثوابت الكوريغرافيا (مللي) =====
const APPROACH_MS = 2400; // اقتراب الموقع الأوّل (مطابق للطيران الحاليّ)
const L1_ORBIT_MS = 7500; // مدار نصف الدائرة ١٨٠° للموقع الأوّل
const TRANSIT_MS = 5200; // الانتقال بين موقعين (نزول لـ١كم منتصفاً + وصول من الباب)
const CLOSEIN_MS = 1600; // الاقتراب من ١٠٠٠م إلى ٤٠٠م
const HERO_MS = 9000; // الدورة السينمائيّة الكاملة ٣٦٠°

// زوايا/ارتفاعات
const DRONE_PITCH = 60; // الزاوية المخزّنة للدرون (تأطير جوّيّ)
const HORIZON_PITCH = 82; // أفقيّة مدار الموقع الأوّل
const TOP_PITCH = 10; // نهاية الدورة: شبه عموديّة فوق المبنى
const NATURAL_ALT = 1200; // الوضع الطبيعيّ
const TRANSIT_LOW_ALT = 1000; // ارتفاع منتصف الطريق وعند الوصول
const HERO_NEAR_ALT = 400; // أقرب نقطة قبل الدورة
const HERO_FAR_ALT = 1000; // نهاية الدورة (صعود)

// ===== اتّجاه «الوصول من الباب» =====
// اتّجاه الباب المحلّيّ (بوصلة، 0=شمال) عند rotationDeg=0: فندق/برج بابهما المحلّيّ −y (180)، المول +y (0).
const localBearing0: Record<ModelKind, number> = { hotel: 180, tower: 180, mall: 0 };
// معايرة بصريّة (م9.10/F): deck.gl yaw عكس عقارب الساعة من فوق، MapLibre bearing مع العقارب.
const YAW_SIGN = -1; // إشارة ربط rotationDeg باتّجاه العالم
const GATE_FACING_OFFSET = 180; // ليواجه البابُ الكاميرا (تقف الكاميرا جهة الباب وتنظر للمبنى)

/** اتّجاه الكاميرا (bearing) كي يواجهها الباب الرئيسيّ للمجسّم. */
export function gateCameraBearing(kind: ModelKind, rotationDeg: number): number {
  const outward = (localBearing0[kind] + YAW_SIGN * rotationDeg + 3600) % 360;
  return (outward + GATE_FACING_OFFSET) % 360;
}

// ===== أدوات نقيّة =====
const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const easeInOut = (t: number): number => {
  const u = clamp01(t);
  return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
};
const smoothstep = (t: number): number => {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
};
// تَنقّل اتّجاهيّ بأقصر مسار (يتجنّب القفز عند حدّ 360).
const lerpAngle = (a: number, b: number, t: number): number => {
  const d = ((b - a + 540) % 360) - 180;
  return a + d * t;
};
const lerpCenter = (a: LngLat, b: LngLat, t: number): LngLat => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

/** ارتفاع التأطير لموقعٍ (نفس targetAlt في zoomForModel) — مستقلّ عن canvasH. */
export function altForModel(loc: TourLoc, pitchDeg = DRONE_PITCH): number {
  const pr = (pitchDeg * Math.PI) / 180;
  const vSpan = loc.heightM * Math.sin(pr);
  const spanM = Math.max(loc.footprintM * 1.1, vSpan, 14);
  return loc.kind === "mall" ? NATURAL_ALT : Math.max(NATURAL_ALT, spanM * 6);
}

/** تحويل ارتفاع التأطير إلى مستوى zoom (يحتاج canvasH وخطّ العرض الحيّ). */
export function zoomForAltitude(altM: number, lat: number, canvasH: number): number {
  return Math.log2((1.5 * canvasH * 156543.03392 * Math.cos((lat * Math.PI) / 180)) / altM);
}

// ===== بناء الخطّ الزمنيّ =====
type SegFrame = { center: LngLat; altM: number; pitch: number; bearing: number };
type Segment = { dur: number; refId: string; frame: (p: number) => SegFrame };
type EndState = { center: LngLat; altM: number; pitch: number; bearing: number };

// م9.11 · ارتفاع طيران الانتقال (مسافة تأطير ≈z15) — **فوق العرض المُحمَّل مسبقاً**: الكاميرا ترتفع وسط الرحلة فتطير
// سريعاً فوق بلاطات مُحمَّلة (لا فجوات كحليّة)، ثمّ تنقضّ إلى الموقع. (التنقّل القريب السريع كان سبب الفجوات.)
const TRANSIT_CRUISE_ALT = 4000;
// منحنى الارتفاع للانتقال: **صعود** إلى ارتفاع العرض (cruise) في أوّل الرحلة، طيران عرض سريع، ثمّ **هبوط** إلى 1كم قبيل
// الوصول من الباب. الحركة الأسرع (منتصف المسار) تقع وهي عالية ⇒ بلاطات مُحمَّلة ⇒ بلا تقطّع.
function transitAlt(p: number, startAlt: number): number {
  if (p < 0.4) return lerp(startAlt, TRANSIT_CRUISE_ALT, easeInOut(p / 0.4)); // صعود إلى العرض
  if (p < 0.68) return TRANSIT_CRUISE_ALT; // طيران عرض (سريع، مُحمَّل مسبقاً)
  return lerp(TRANSIT_CRUISE_ALT, TRANSIT_LOW_ALT, easeInOut((p - 0.68) / 0.32)); // هبوط للوصول من الباب عند 1كم
}
function transitPitch(p: number, startPitch: number): number {
  return p < 0.4 ? lerp(startPitch, DRONE_PITCH, easeInOut(p / 0.4)) : DRONE_PITCH;
}

// م9.11 · جولة خاصّة لمبنًى مميّز (الهيئة): ① غطس قريب جداً نحو الباب → ② ارتفاع فوقه + ميل لتصوير المبنى بوضوح →
// ③ دوران تصويريّ ٣٦٠° حوله → ④ انسحاب وارتفاع للانطلاق. `fromAlt/fromBearing` = نهاية المقطع السابق (وصل/اقتراب) لاتّصال سلس.
const SP_DIVE_MS = 2600;
const SP_RISE_MS = 2600;
const SP_ORBIT_MS = 9000;
const SP_PULLBACK_MS = 1900;
const SP_NEAR_ALT = 180; // اقتراب شديد (دخول تجاه الباب)
const SP_ORBIT_ALT = 460; // ارتفاع التصوير المداريّ
const SP_RISE_PITCH = 20; // ميل عند الارتفاع فوقه (نظرة شبه علويّة)
const SP_ORBIT_PITCH = 36; // ميل الدوران (٣/٤ يُظهر الواجهات والسطح)
function specialDisplaySegments(loc: TourLoc, gate: number, fromAlt: number, fromBearing: number): { segs: Segment[]; end: EndState } {
  const c = loc.center;
  const dive: Segment = { dur: SP_DIVE_MS, refId: loc.refId, frame: (p) => ({ center: c, altM: lerp(fromAlt, SP_NEAR_ALT, easeInOut(p)), pitch: DRONE_PITCH, bearing: lerpAngle(fromBearing, gate, easeInOut(p)) }) }; // غطس نحو الباب
  const rise: Segment = { dur: SP_RISE_MS, refId: loc.refId, frame: (p) => ({ center: c, altM: lerp(SP_NEAR_ALT, SP_ORBIT_ALT, easeInOut(p)), pitch: lerp(DRONE_PITCH, SP_RISE_PITCH, easeInOut(p)), bearing: gate }) }; // ارتفاع فوقه + تصوير
  const orbit: Segment = { dur: SP_ORBIT_MS, refId: loc.refId, frame: (p) => ({ center: c, altM: SP_ORBIT_ALT, pitch: lerp(SP_RISE_PITCH, SP_ORBIT_PITCH, smoothstep(Math.min(1, p * 4))), bearing: gate + 360 * p }) }; // دوران كامل حوله
  const pullback: Segment = { dur: SP_PULLBACK_MS, refId: loc.refId, frame: (p) => ({ center: c, altM: lerp(SP_ORBIT_ALT, HERO_FAR_ALT, easeInOut(p)), pitch: lerp(SP_ORBIT_PITCH, DRONE_PITCH, easeInOut(p)), bearing: gate + 360 }) }; // انسحاب ثمّ انطلاق
  return { segs: [dive, rise, orbit, pullback], end: { center: c, altM: HERO_FAR_ALT, pitch: DRONE_PITCH, bearing: gate } };
}

// مقاطع عرض موقعٍ تالٍ (انتقال → اقتراب → دورة ٣٦٠°). تُحدِّث `prevEnd` لاحقاً عبر القيمة المُعادة.
function transitionSegments(prev: EndState, loc: TourLoc): { segs: Segment[]; end: EndState } {
  const gate = gateCameraBearing(loc.kind, loc.rotationDeg);
  const transit: Segment = {
    dur: TRANSIT_MS,
    refId: loc.refId,
    frame: (p) => ({
      center: lerpCenter(prev.center, loc.center, easeInOut(p)),
      altM: transitAlt(p, prev.altM),
      pitch: transitPitch(p, prev.pitch),
      bearing: lerpAngle(prev.bearing, gate, easeInOut(Math.min(1, p / 0.85))), // يستقرّ على اتّجاه الباب قبل الوصول
    }),
  };
  if (loc.closeApproach) {
    // جولة خاصّة (الهيئة): بعد الوصول من الباب عند 1كم ← غطس قريب + ارتفاع وتصوير + دوران + انسحاب.
    const sp = specialDisplaySegments(loc, gate, TRANSIT_LOW_ALT, gate);
    return { segs: [transit, ...sp.segs], end: sp.end };
  }
  const closeIn: Segment = {
    dur: CLOSEIN_MS,
    refId: loc.refId,
    frame: (p) => ({ center: loc.center, altM: lerp(TRANSIT_LOW_ALT, HERO_NEAR_ALT, easeInOut(p)), pitch: DRONE_PITCH, bearing: gate }),
  };
  const hero: Segment = {
    dur: HERO_MS,
    refId: loc.refId,
    frame: (p) => ({
      center: loc.center,
      altM: lerp(HERO_NEAR_ALT, HERO_FAR_ALT, smoothstep(p)), // ابتعاد متناسب مع انقضاء الدورة
      pitch: lerp(DRONE_PITCH, TOP_PITCH, smoothstep(p)), // ميل تدريجيّ نحو نظرة علويّة
      bearing: gate + 360 * p, // دورة كاملة جمعيّة (لا أقصر مسار)
    }),
  };
  return { segs: [transit, closeIn, hero], end: { center: loc.center, altM: HERO_FAR_ALT, pitch: TOP_PITCH, bearing: gate } };
}

// مقاطع الموقع الأوّل: اقتراب (مطابق للحاليّ) ثمّ مدار نصف دائرة ١٨٠° بكوريغرافيا الميل القائمة.
function firstLocationSegments(start: StartCam, loc: TourLoc): { segs: Segment[]; end: EndState } {
  const targetAlt = altForModel(loc, DRONE_PITCH);
  const approach: Segment = {
    dur: APPROACH_MS,
    refId: loc.refId,
    frame: (p) => ({
      center: lerpCenter(start.center, loc.center, easeInOut(p)),
      altM: lerp(start.altM, targetAlt, easeInOut(p)),
      pitch: lerp(start.pitch, DRONE_PITCH, easeInOut(p)),
      bearing: start.bearing, // الاقتراب يُبقي الاتّجاه ثابتاً (كالطيران الحاليّ)
    }),
  };
  if (loc.closeApproach) {
    // جولة خاصّة (الهيئة) حتى لو كانت الموقع الأوّل: بعد الاقتراب ← غطس + ارتفاع وتصوير + دوران + انسحاب.
    const gate = gateCameraBearing(loc.kind, loc.rotationDeg);
    const sp = specialDisplaySegments(loc, gate, targetAlt, start.bearing);
    return { segs: [approach, ...sp.segs], end: sp.end };
  }
  const ss = (u: number): number => u * u * (3 - 2 * u);
  const orbit: Segment = {
    dur: L1_ORBIT_MS,
    refId: loc.refId,
    frame: (p) => {
      const d = 180 * Math.sin((p * Math.PI) / 2); // easeOutSine — انطلاق سلس ثمّ تباطؤ مهيب
      let pitch: number;
      if (d < 45) pitch = DRONE_PITCH;
      else if (d < 90) pitch = DRONE_PITCH + (HORIZON_PITCH - DRONE_PITCH) * ss((d - 45) / 45);
      else if (d < 135) pitch = HORIZON_PITCH;
      else pitch = HORIZON_PITCH + (DRONE_PITCH - HORIZON_PITCH) * ss((d - 135) / 45);
      return { center: loc.center, altM: targetAlt, pitch, bearing: start.bearing + d };
    },
  };
  return { segs: [approach, orbit], end: { center: loc.center, altM: targetAlt, pitch: DRONE_PITCH, bearing: start.bearing + 180 } };
}

/** يبني خطّ الجولة الزمنيّ من المواقع المرتّبة + حالة الكاميرا الحاليّة. */
export function buildTimeline(locations: readonly TourLoc[], _mode: number, start: StartCam): TourTimeline {
  const segs: Segment[] = [];
  if (locations.length === 0) return { durationMs: 0, sample: () => ({ center: start.center, altM: start.altM, pitch: start.pitch, bearing: start.bearing, refId: null }) };

  const first = firstLocationSegments(start, locations[0]!);
  segs.push(...first.segs);
  let prevEnd: EndState = first.end;
  for (let i = 1; i < locations.length; i++) {
    const t = transitionSegments(prevEnd, locations[i]!);
    segs.push(...t.segs);
    prevEnd = t.end;
  }

  // فهرسة زمنيّة تراكميّة
  const starts: number[] = [];
  let acc = 0;
  for (const s of segs) {
    starts.push(acc);
    acc += s.dur;
  }
  const durationMs = acc;

  const sample = (tMs: number): CamFrame => {
    const t = tMs <= 0 ? 0 : tMs >= durationMs ? durationMs : tMs;
    // آخر مقطع عند بلوغ النهاية
    let idx = segs.length - 1;
    for (let i = 0; i < segs.length; i++) {
      if (t < starts[i]! + segs[i]!.dur) {
        idx = i;
        break;
      }
    }
    const seg = segs[idx]!;
    const p = seg.dur > 0 ? clamp01((t - starts[idx]!) / seg.dur) : 1;
    const f = seg.frame(p);
    return { center: f.center, altM: f.altM, pitch: f.pitch, bearing: f.bearing, refId: seg.refId };
  };

  return { durationMs, sample };
}
