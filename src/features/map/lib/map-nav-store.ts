// ناقل بسيط (pub/sub) لطلب الانتقال لقطعة على الخريطة من السايدبار (§هـ.2 مبدأ التنقّل).
import { useSyncExternalStore } from "react";

type Listener = (refId: string) => void;

// هدف رسم/ربط هندسة لقطعة بياناتية موجودة (فرصة/رخصة).
export type DrawTarget = { parcel_no: string; muqataa_no: string | null; label?: string };
const drawListeners = new Set<(t: DrawTarget) => void>();
export function requestStartDraw(target: DrawTarget): void {
  for (const l of drawListeners) l(target);
}
export function onStartDraw(listener: (t: DrawTarget) => void): () => void {
  drawListeners.add(listener);
  return () => {
    drawListeners.delete(listener);
  };
}

const listeners = new Set<Listener>();

export function requestFlyTo(refId: string): void {
  for (const l of listeners) l(refId);
}

export function onFlyTo(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// طيران لإحداثيات حرّة (نتيجة بحث جغرافي/geocoding ضمن نينوى) — مستقلّ عن أي قطعة بياناتية.
export type Coords = { lng: number; lat: number; label?: string };
const coordsListeners = new Set<(c: Coords) => void>();
export function requestFlyToCoords(c: Coords): void {
  for (const l of coordsListeners) l(c);
}
export function onFlyToCoords(listener: (c: Coords) => void): () => void {
  coordsListeners.add(listener);
  return () => {
    coordsListeners.delete(listener);
  };
}

// العودة للخارطة الكاملة (كامل نينوى) — يُطلَب من الدوك على الجوال (زر «كامل نينوى»).
const resetListeners = new Set<() => void>();
export function requestResetView(): void {
  for (const l of resetListeners) l();
}
export function onResetView(listener: () => void): () => void {
  resetListeners.add(listener);
  return () => {
    resetListeners.delete(listener);
  };
}

// تكبير/تصغير الخريطة — يُطلَب من أزرار الزوم في الدوك على الجوال (م8.9). delta موجب=تكبير، سالب=تصغير.
const zoomListeners = new Set<(delta: number) => void>();
export function requestZoom(delta: number): void {
  for (const l of zoomListeners) l(delta);
}
export function onZoom(listener: (delta: number) => void): () => void {
  zoomListeners.add(listener);
  return () => {
    zoomListeners.delete(listener);
  };
}

// فتح نموذج قطعة مفترضة (بعد الرسم أو من الإشارة) — عامّ، مستقلّ عن السايدبار.
const formListeners = new Set<Listener>();
export function requestOpenParcelForm(id: string): void {
  for (const l of formListeners) l(id);
}
export function onOpenParcelForm(listener: Listener): () => void {
  formListeners.add(listener);
  return () => {
    formListeners.delete(listener);
  };
}

// فتح نافذة القطعة الموحّدة (من إشارة الخريطة أو السايدبار) — للأنواع الثلاثة (م3.1).
export type ParcelKind = "opportunity" | "license" | "assumed";
export type ParcelRef = { kind: ParcelKind; id: string; readOnly?: boolean };
type DetailListener = (ref: ParcelRef) => void;
const detailListeners = new Set<DetailListener>();
export function requestOpenParcelDetail(ref: ParcelRef): void {
  for (const l of detailListeners) l(ref);
}
export function onOpenParcelDetail(listener: DetailListener): () => void {
  detailListeners.add(listener);
  return () => {
    detailListeners.delete(listener);
  };
}

// ===== جولة العرض السينمائيّة الأوتوماتيكيّة (م9.10) =====
// إعداد الجولة: المواقع المختارة (ref_id) + رقم وضع الكاميرا + التكرار.
export type TourConfig = { refIds: string[]; mode: number; loop: boolean };

const startTourListeners = new Set<(c: TourConfig) => void>();
export function requestStartTour(c: TourConfig): void {
  for (const l of startTourListeners) l(c);
}
export function onStartTour(listener: (c: TourConfig) => void): () => void {
  startTourListeners.add(listener);
  return () => {
    startTourListeners.delete(listener);
  };
}

const stopTourListeners = new Set<() => void>();
export function requestStopTour(): void {
  for (const l of stopTourListeners) l();
}
export function onStopTour(listener: () => void): () => void {
  stopTourListeners.add(listener);
  return () => {
    stopTourListeners.delete(listener);
  };
}

// ===== جولة سينمائيّة منفصلة (م9.18) — تطير لكلّ موقع وتستقرّ على مشهده المعتمَد وتنبثق بطاقاته (سلسلة طيرانات مفردة) =====
const startCineTourListeners = new Set<(c: TourConfig) => void>();
export function requestStartCinematicTour(c: TourConfig): void {
  for (const l of startCineTourListeners) l(c);
}
export function onStartCinematicTour(listener: (c: TourConfig) => void): () => void {
  startCineTourListeners.add(listener);
  return () => {
    startCineTourListeners.delete(listener);
  };
}

const stopCineTourListeners = new Set<() => void>();
export function requestStopCinematicTour(): void {
  for (const l of stopCineTourListeners) l();
}
export function onStopCinematicTour(listener: () => void): () => void {
  stopCineTourListeners.add(listener);
  return () => {
    stopCineTourListeners.delete(listener);
  };
}

// حالة المواقع المتاحة للجولة — تنشرها الخريطة من مجموعة المجسّمات المعروضة فعلاً، وتستهلكها النافذة.
export type TourLocation = { refId: string; nameAr: string; kind: string };
let tourLocations: TourLocation[] = [];
const tourLocListeners = new Set<() => void>();
export function setTourLocations(locs: TourLocation[]): void {
  const same =
    tourLocations.length === locs.length &&
    tourLocations.every((t, i) => t.refId === locs[i]?.refId && t.nameAr === locs[i]?.nameAr && t.kind === locs[i]?.kind);
  if (same) return; // لا إعادة رسم إن لم تتغيّر المجموعة
  tourLocations = locs;
  for (const l of tourLocListeners) l();
}
export function useTourLocations(): TourLocation[] {
  return useSyncExternalStore(
    (cb) => {
      tourLocListeners.add(cb);
      return () => tourLocListeners.delete(cb);
    },
    () => tourLocations,
    () => tourLocations,
  );
}

// حالة نشاط الجولة — لإخفاء الواجهة (الخريطة + الهيدبار فقط) في الخريطة والشيل معاً.
let tourActive = false;
const tourActiveListeners = new Set<() => void>();
export function setTourActive(v: boolean): void {
  if (tourActive === v) return;
  tourActive = v;
  for (const l of tourActiveListeners) l();
}
export function useTourActive(): boolean {
  return useSyncExternalStore(
    (cb) => {
      tourActiveListeners.add(cb);
      return () => tourActiveListeners.delete(cb);
    },
    () => tourActive,
    () => false,
  );
}

// م9.18 · نشاط الجولة السينمائيّة — تُخفي الواجهة كالجولة، لكن **تُبقي بطاقات المجسّم ظاهرة** (بخلاف الجولة العاديّة).
let cinematicTourActive = false;
const cineActiveListeners = new Set<() => void>();
export function setCinematicTourActive(v: boolean): void {
  if (cinematicTourActive === v) return;
  cinematicTourActive = v;
  for (const l of cineActiveListeners) l();
}
export function useCinematicTourActive(): boolean {
  return useSyncExternalStore(
    (cb) => {
      cineActiveListeners.add(cb);
      return () => cineActiveListeners.delete(cb);
    },
    () => cinematicTourActive,
    () => false,
  );
}
