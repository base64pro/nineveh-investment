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

// فتح تفاصيل شركة بعينها (من نتيجة بحث §هـ.2.ج «فتح بياناته») — تستهلكه لوحة الشركات.
// الطلب يُعلَّق ويُعاد تشغيله عند الاشتراك: اللوحة تُركَّب بعد إطلاق الحدث (فتح القسم ثم التفاصيل).
type CompanyListener = (id: string) => void;
const companyListeners = new Set<CompanyListener>();
let pendingCompanyId: string | null = null;

export function requestOpenCompany(id: string): void {
  if (companyListeners.size > 0) {
    for (const l of companyListeners) l(id); // مستمع حيّ ← تسليم فوري بلا تعليق (لا إعادة قديمة لاحقاً)
  } else {
    pendingCompanyId = id;
  }
}
export function onOpenCompany(listener: CompanyListener): () => void {
  companyListeners.add(listener);
  if (pendingCompanyId !== null) {
    listener(pendingCompanyId); // إعادة تشغيل الطلب المعلّق للوحة المُركَّبة للتوّ
    pendingCompanyId = null;
  }
  return () => {
    companyListeners.delete(listener);
  };
}
