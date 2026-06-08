// ناقل بسيط (pub/sub) لطلب الانتقال لقطعة على الخريطة من السايدبار (§هـ.2 مبدأ التنقّل).
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
