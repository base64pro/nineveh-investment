/**
 * أنواع TypeScript الموحّدة — المصدر الواحد للأنواع (§ج.8 · §ج.5).
 * تطابق أعمدة القاعدة (snake_case). التسميات العربية للعرض في طبقة العرض (§ح).
 */

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

// ===== أنواع مضبوطة (تطابق أنواع/قيود القاعدة) =====
export type LicenseStatus = "in-progress" | "completed" | "withdrawn"; // قيد/منجزة/مسحوبة
export type ParcelState = "announced" | "in-progress" | "completed" | "withdrawn" | "assumed";
export type LegalRecordType = "مادة" | "مادة_ملغاة" | "مذكّرة" | "جدول_أجور";
export type InvestorType = "iraqi" | "foreign" | "both";
export type CapitalTier = "min_250k" | "over_250m" | "strategic_federal" | "adjustable";
export type Jurisdiction = "governorate" | "federal" | "both";
export type ApplicableSector =
  | "housing"
  | "real_estate"
  | "industrial"
  | "agricultural"
  | "energy"
  | "tourism"
  | "logistics_transport"
  | "infrastructure"
  | "telecom"
  | "natural_resources"
  | "all";
export type CriterionDomain = "company" | "opportunity" | "architecture" | "competitive";
export type CriterionStatus = "active" | "disabled";
export type MapElementType = "landmark" | "building" | "street" | "point" | "label";

// ===== أنواع فرعية (jsonb) =====
export interface AnnouncementHistoryItem {
  record_id: number;
  announcement_type: string | null;
  publish_date: string | null;
  deadline: string | null;
  title: string | null;
}
export interface StatusHistoryItem {
  status: string;
  date: string | null;
}
export interface LegalClause {
  key: string;
  text: string;
}
export interface FeeItem {
  item: number;
  service: string;
  fee: number;
}
export interface CompanyProject {
  title?: string | null;
  sector?: string | null;
  location?: string | null;
  year?: string | null;
  value?: string | number | null;
  status?: string | null;
  owner?: string | null;
  source?: string | null;
  note?: string | null;
}

// ===== الكيانات التسعة (§ج.8) =====

// 1) الفرصة (§ج.8/1)
export interface Opportunity {
  record_id: number;
  kind: string;
  title: string | null;
  project_type: string | null;
  sector: string | null;
  description: string | null;
  raw_details: string | null;
  parcel_no: string | null;
  parcels: string[] | null;
  is_partial: boolean | null;
  multi_parcel: boolean | null;
  descriptive_location: boolean | null;
  parcels_in_table: boolean | null;
  muqataa_no: string | null;
  muqataa_name: string | null;
  district: string | null;
  neighborhood: string | null;
  area_olk: number | null;
  area_m2: number | null;
  area_total_m2: number | null;
  area_factor_note: string | null;
  owner: string | null;
  zoning: string | null;
  coordinates: Json | null;
  announcement_number: string | null;
  announcement_type: string | null;
  publish_date: string | null;
  deadline: string | null;
  opp_status: string | null;
  conditions: Json | null;
  doc_fee: number | null;
  related_announcements: number[];
  license_ref: string[];
  legal_refs: string[];
  source_url: string | null;
  source: string | null;
  image: string | null;
  views: number | null;
  updated_at: string | null;
  verification: string | null;
  review_reasons: string[];
  notes: string | null;
  announcement_count: number | null;
  announcement_history: AnnouncementHistoryItem[];
  created_at: string;
}

// 2) الرخصة (§ج.8/2)
export interface License {
  record_id: number;
  kind: string;
  license_number: string | null;
  status: LicenseStatus;
  status_history: StatusHistoryItem[];
  issue_date: string | null;
  amendment_dates: string[];
  renewal_date: string | null;
  withdrawal_date: string | null;
  withdrawal_reason: string | null;
  completion_date: string | null;
  title: string | null;
  project_type: string | null;
  sector: string | null;
  description: string | null;
  raw_details: string | null;
  parcel_no: string | null;
  parcels: string[] | null;
  is_partial: boolean | null;
  multi_parcel: boolean | null;
  descriptive_location: boolean | null;
  muqataa_no: string | null;
  muqataa_name: string | null;
  district: string | null;
  subdistrict: string | null;
  neighborhood: string | null;
  area_olk: number | null;
  area_m2: number | null;
  area_total_m2: number | null;
  area_factor_note: string | null;
  owner: string | null;
  land_right: string | null;
  zoning: string | null;
  coordinates: Json | null;
  investor_name: string | null;
  investor_nationality: string | null;
  company_ref: string | null;
  capital: number | null;
  lease_rate: number | null;
  term_years: number | null;
  exemptions: Json | null;
  opportunity_ref: string | null;
  legal_refs: string[];
  source_url: string | null;
  source: string | null;
  created_by: string | null;
  updated_at: string | null;
  verification: string | null;
  review_reasons: string[];
  notes: string | null;
  created_at: string;
}

// 3) الشركة (§ج.8/3 · قالب 23 حقلاً)
export interface Company {
  id: string;
  name: string;
  company_type: string | null;
  sector: string | null;
  activity: string | null;
  registration_no: string | null;
  file_no: string | null;
  capital_iqd: number | null;
  capital_usd: number | null;
  is_excluded: boolean;
  meets_250k_threshold: boolean | null;
  manager: string | null;
  shareholders: Json[];
  phone: string | null;
  email: string | null;
  website: string | null;
  governorate: string | null;
  address: string | null;
  source: string[];
  matched_opportunities: Json[];
  notes: string | null;
  updated_at_label: string | null;
  projects: CompanyProject[];
  created_at: string;
}

// 4) القانون (§ج.5 · §ج.8/4)
export interface LegalDocument {
  doc_id: string;
  doc_title: string;
  doc_type: string | null;
  doc_number: number | null;
  doc_year: number | null;
  issuing_authority: string | null;
  amended_by: string[];
  gazette: string | null;
  currency: string | null;
  source_file: string | null;
  verification: string | null;
  tags_note: string | null;
  created_at: string;
}

export interface LegalRecord {
  id: string;
  record_type: LegalRecordType;
  doc_id: string;
  chapter_no: number | null;
  chapter_title: string | null;
  article_no: number | null;
  article_label_ar: string | null;
  article_text: string | null;
  clauses: LegalClause[] | null;
  amendments: Json[] | null;
  cross_refs: Json[] | null;
  section_no: number | null;
  section_title: string | null;
  fee_items: FeeItem[] | null;
  applicable_sectors: ApplicableSector[] | null;
  investor_type: InvestorType | null;
  capital_tier: CapitalTier | null;
  jurisdiction: Jurisdiction | null;
  verification: string | null;
  created_at: string;
}

// 5) المعيار (§ج.8/5)
export interface Criterion {
  id: string;
  name: string;
  domain: CriterionDomain | null;
  purpose: string | null;
  items: Json[];
  status: CriterionStatus;
  parcel_ref: string | null;
  created_at: string;
  updated_at: string;
}

// 6) الاستشارة (§ج.8/6)
export interface Consultation {
  id: string;
  title: string | null;
  consulted_at: string;
  inputs: Json | null;
  question: string | null;
  answer: string | null;
  excerpt: string | null;
  created_at: string;
  updated_at: string;
}

// 7) الزيارة (§ج.8/7)
export interface Visit {
  id: string;
  parcel_ref: string;
  visit_date: string;
  visit_type: string | null;
  staff: string | null;
  notes: string | null;
  photos: string[];
  created_at: string;
  updated_at: string;
}

// 8) عنصر الخريطة المحرَّر (§ج.8/8)
export interface MapElement {
  id: string;
  element_type: MapElementType | null;
  name: string | null;
  geom: Json | null;
  label: string | null;
  meta: Json;
  created_at: string;
  updated_at: string;
}

// 9) القطعة المفترضة (§ج.8/9)
export interface AssumedParcel {
  id: string;
  name: string | null;
  parcel_no: string | null;
  muqataa_no: string | null;
  muqataa_name: string | null;
  district: string | null;
  subdistrict: string | null;
  neighborhood: string | null;
  sector: string | null;
  owner: string | null;
  land_right: string | null;
  state: ParcelState;
  area_m2: number | null;
  value: number | null;
  geom: Json | null;
  annexation_plan: string | null;
  legal_status: string | null;
  company_ref: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// طبقة الهندسة المنفصلة (§ج.8)
export interface ParcelGeometry {
  id: string;
  parcel_no: string;
  muqataa_no: string | null;
  geom: Json | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}
