/** أشكال JSON الخام في /data (المصدر) — حقول اختيارية تُحوَّل إلى صفوف القاعدة. */
import type {
  Opportunity,
  License,
  LegalRecord,
  LegalDocument,
  ApplicableSector,
  InvestorType,
  CapitalTier,
  Jurisdiction,
} from "../../src/types/entities";

export type RawOpportunity = Partial<Omit<Opportunity, "created_at" | "kind">> & { _kind?: string };
export type RawLicense = Partial<Omit<License, "created_at" | "kind">> & { _kind?: string };

export interface RawLegalTags {
  applicable_sectors?: ApplicableSector[] | null;
  investor_type?: InvestorType | null;
  capital_tier?: CapitalTier | null;
  jurisdiction?: Jurisdiction | null;
}
export type RawLegalRecord = Partial<
  Omit<
    LegalRecord,
    "created_at" | "applicable_sectors" | "investor_type" | "capital_tier" | "jurisdiction"
  >
> & { tags?: RawLegalTags | null };

export type RawLegalDocument = Partial<Omit<LegalDocument, "created_at">>;

export interface RawLegalFile {
  document: RawLegalDocument;
  records: RawLegalRecord[];
}

export interface CountedFile<T> {
  count?: number;
  records: T[];
}
