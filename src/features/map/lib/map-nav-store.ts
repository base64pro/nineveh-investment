// ناقل بسيط (pub/sub) لطلب الانتقال لقطعة على الخريطة من السايدبار (§هـ.2 مبدأ التنقّل).
type Listener = (refId: string) => void;

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
