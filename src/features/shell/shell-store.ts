// ناقل بسيط (pub/sub) لطلب فتح قسم في السايدبار من الهيدبار/البحث (§هـ.1 · النقر على مؤشّر ← مصدره).
type SectionListener = (id: string, status?: string) => void;

const listeners = new Set<SectionListener>();

export function requestOpenSection(id: string, status?: string): void {
  for (const l of listeners) l(id, status);
}

export function onOpenSection(listener: SectionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
