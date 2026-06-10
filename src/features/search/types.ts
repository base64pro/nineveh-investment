// أنواع البحث الفائق — منفصلة عن ملف "use server" (تستوردها الواجهة والخادم).
export type SearchKind = "opportunity" | "license" | "company" | "assumed" | "place";

export interface SearchResult {
  kind: SearchKind;
  label: string;
  sublabel: string;
  parcel_no: string | null; // للعرض (شارة الرقم)
  mapRef: string | null; // مرجع الطيران على الخريطة (رقم القطعة للفرص/الرخص · id للمفترضة)
  hasGeom: boolean; // له رسم على الخريطة؟ (يحدّد: طيران أم فتح السجلّ)
  lng: number | null; // للأماكن (geocoding)
  lat: number | null;
}
