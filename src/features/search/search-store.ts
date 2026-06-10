// ناقل فتح لوحة البحث الفائق (من الهيدبار أو اختصار لوحة المفاتيح).
const openListeners = new Set<() => void>();

export function openSearch(): void {
  for (const l of openListeners) l();
}

export function onOpenSearch(listener: () => void): () => void {
  openListeners.add(listener);
  return () => {
    openListeners.delete(listener);
  };
}
