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

// فتح تفاصيل قطعة مفترضة (من إشارة الخريطة).
const detailListeners = new Set<Listener>();
export function requestOpenParcelDetail(id: string): void {
  for (const l of detailListeners) l(id);
}
export function onOpenParcelDetail(listener: Listener): () => void {
  detailListeners.add(listener);
  return () => {
    detailListeners.delete(listener);
  };
}
