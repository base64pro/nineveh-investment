// أنواع البحث الفائق — منفصلة عن ملف "use server" (تستوردها الواجهة والخادم).
export type SearchKind = "opportunity" | "license" | "company" | "assumed" | "place";

export interface SearchResult {
  kind: SearchKind;
  label: string;
  sublabel: string;
  parcel_no: string | null; // للقطع (طيران بالخريطة عبر رقم القطعة)
  lng: number | null; // للأماكن
  lat: number | null;
}
