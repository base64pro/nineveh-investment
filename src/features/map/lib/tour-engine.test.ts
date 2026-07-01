import { describe, expect, it } from "vitest";
import { altForModel, buildTimeline, gateCameraBearing, zoomForAltitude, type StartCam, type TourLoc } from "./tour-engine";

const mk = (refId: string, kind: TourLoc["kind"], lng: number, lat: number, rotationDeg = 0): TourLoc => ({
  refId,
  kind,
  center: [lng, lat],
  footprintM: 60,
  heightM: 80,
  rotationDeg,
});

const START: StartCam = { center: [43.1, 36.34], bearing: 0, pitch: 48, altM: 5000 };

const angDelta = (a: number, b: number): number => Math.abs(((b - a + 540) % 360) - 180);

describe("tour-engine", () => {
  it("مدّة موقع واحد = اقتراب + مدار ١٨٠° (9900مللي)", () => {
    const tl = buildTimeline([mk("a", "hotel", 43.1, 36.34)], 1, START);
    expect(tl.durationMs).toBe(2400 + 7500);
  });

  it("مدّة موقعَين = الموقع الأوّل + (انتقال + اقتراب + دورة)", () => {
    const tl = buildTimeline([mk("a", "hotel", 43.1, 36.34), mk("b", "mall", 43.2, 36.35)], 1, START);
    expect(tl.durationMs).toBe(9900 + (5200 + 1600 + 9000));
  });

  it("اللقطة عند t=0 تنطلق من حالة الكاميرا الحاليّة وتركّز على الموقع الأوّل", () => {
    const tl = buildTimeline([mk("a", "tower", 43.1, 36.34)], 1, START);
    const f0 = tl.sample(0);
    expect(f0.center[0]).toBeCloseTo(START.center[0], 6);
    expect(f0.center[1]).toBeCloseTo(START.center[1], 6);
    expect(f0.pitch).toBeCloseTo(START.pitch, 6);
    expect(f0.refId).toBe("a");
  });

  it("اللقطة عند النهاية تستقرّ على آخر موقع بنظرة علويّة (ميل ١٠°) عند ١٠٠٠م", () => {
    const locs = [mk("a", "hotel", 43.1, 36.34), mk("b", "mall", 43.2, 36.35, 30)];
    const tl = buildTimeline(locs, 1, START);
    const fEnd = tl.sample(tl.durationMs);
    expect(fEnd.refId).toBe("b");
    expect(fEnd.pitch).toBeCloseTo(10, 4);
    expect(fEnd.altM).toBeCloseTo(1000, 4);
    expect(angDelta(fEnd.bearing, gateCameraBearing("mall", 30))).toBeLessThan(0.001);
  });

  it("اتّجاه الباب: الكاميرا تواجه باب كلّ نوع عند rotationDeg=0", () => {
    expect(gateCameraBearing("hotel", 0)).toBe(0); // باب −y ⇒ الكاميرا من الجنوب تنظر شمالاً
    expect(gateCameraBearing("tower", 0)).toBe(0);
    expect(gateCameraBearing("mall", 0)).toBe(180); // باب +y ⇒ الكاميرا من الشمال تنظر جنوباً
  });

  it("اتّجاه الباب يدور مع توجيه المجسّم", () => {
    expect(gateCameraBearing("hotel", 90)).toBe(270);
    expect(gateCameraBearing("mall", 90)).toBe(90);
  });

  it("الدورة ٣٦٠° تزايديّة (جمعيّة) خلال مقطع البطل", () => {
    const tl = buildTimeline([mk("a", "hotel", 43.1, 36.34), mk("b", "hotel", 43.2, 36.35)], 1, START);
    const heroStart = 9900 + 5200 + 1600;
    const b0 = tl.sample(heroStart + 1).bearing;
    const bMid = tl.sample(heroStart + 4500).bearing;
    const bEnd = tl.sample(heroStart + 8999).bearing;
    expect(bMid).toBeGreaterThan(b0);
    expect(bEnd).toBeGreaterThan(bMid);
    expect(bEnd - b0).toBeGreaterThan(300); // قرابة دورة كاملة
  });

  it("ارتفاع الانتقال يرتفع لارتفاع العرض وسط الرحلة ثمّ يهبط لـ١كم قبيل الوصول", () => {
    const tl = buildTimeline([mk("a", "hotel", 43.1, 36.34), mk("b", "mall", 43.2, 36.35)], 1, START);
    const transitStart = 9900;
    expect(tl.sample(transitStart + 5200 * 0.5).altM).toBeGreaterThan(2500); // المنتصف = ارتفاع العرض (≈٤كم) ⇒ تنقّل سريع فوق بلاطات مُحمَّلة
    expect(tl.sample(transitStart + 5200 * 0.97).altM).toBeLessThan(1300); // قبيل الوصول = قرب ١كم (انقضاض على الموقع)
  });

  it("المسار متّصل: لا قفزات في المركز/الارتفاع/الميل/الاتّجاه عبر حدود المقاطع", () => {
    const locs = [mk("a", "hotel", 43.10, 36.34, 15), mk("b", "mall", 43.18, 36.36, 200), mk("c", "tower", 43.05, 36.40, 90)];
    const tl = buildTimeline(locs, 1, START);
    let prev = tl.sample(0);
    for (let t = 25; t <= tl.durationMs; t += 25) {
      const cur = tl.sample(t);
      expect(Math.abs(cur.center[0] - prev.center[0])).toBeLessThan(0.01);
      expect(Math.abs(cur.center[1] - prev.center[1])).toBeLessThan(0.01);
      expect(Math.abs(cur.altM - prev.altM)).toBeLessThan(100); // اقتراب الموقع الأوّل تكبير سريع متعمَّد (سلس لا قافز)؛ الحدّ يصطاد القفزات
      expect(Math.abs(cur.pitch - prev.pitch)).toBeLessThan(5);
      expect(angDelta(prev.bearing, cur.bearing)).toBeLessThan(6);
      prev = cur;
    }
  });

  it("altForModel: المول مؤطَّر عند ١٢٠٠م، والكبير أعلى تناسبياً", () => {
    expect(altForModel({ ...mk("m", "mall", 0, 0), footprintM: 300, heightM: 60 })).toBe(1200);
    expect(altForModel({ ...mk("t", "tower", 0, 0), footprintM: 400, heightM: 200 })).toBeGreaterThan(1200);
  });

  it("zoomForAltitude: الارتفاع الأعلى ⇒ zoom أقلّ", () => {
    const near = zoomForAltitude(400, 36.34, 800);
    const far = zoomForAltitude(1200, 36.34, 800);
    expect(near).toBeGreaterThan(far);
  });

  it("جولة خاصّة (closeApproach): غطس قريب ~١٨٠م ثمّ دوران ثمّ انسحاب — مسار متّصل", () => {
    const locs: TourLoc[] = [mk("a", "hotel", 43.1, 36.34), { ...mk("b", "tower", 43.18, 36.36, 45), closeApproach: true }];
    const tl = buildTimeline(locs, 1, START);
    let minAlt = Infinity;
    let prev = tl.sample(0);
    for (let t = 25; t <= tl.durationMs; t += 25) {
      const cur = tl.sample(t);
      if (cur.refId === "b") minAlt = Math.min(minAlt, cur.altM);
      expect(Math.abs(cur.altM - prev.altM)).toBeLessThan(100); // بلا قفزات (غطس متعمَّد سلس)
      expect(Math.abs(cur.pitch - prev.pitch)).toBeLessThan(6);
      expect(angDelta(prev.bearing, cur.bearing)).toBeLessThan(6);
      prev = cur;
    }
    expect(minAlt).toBeLessThan(220); // اقتراب شديد (~١٨٠م) — أقرب من دورة المواقع العاديّة (٤٠٠م)
    expect(tl.sample(tl.durationMs).altM).toBeCloseTo(1000, 4); // ينتهي منسحباً عند ١كم للانطلاق
  });
});
