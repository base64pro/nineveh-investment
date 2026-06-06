import type { SupabaseClient } from "@supabase/supabase-js";
import { readData } from "../lib/data";
import { assertCount, EXPECTED } from "../lib/counts";
import { upsertAll } from "../lib/upsert";
import type { CountedFile, RawLicense } from "./raw-types";

function toRow(r: RawLicense): Record<string, unknown> {
  if (r.record_id == null) throw new Error("رخصة بلا record_id — توقّف.");
  if (r.status == null) throw new Error(`رخصة ${String(r.record_id)} بلا status — توقّف.`);
  return {
    record_id: r.record_id,
    kind: r._kind ?? "license",
    license_number: r.license_number ?? null,
    status: r.status,
    status_history: r.status_history ?? [],
    issue_date: r.issue_date ?? null,
    amendment_dates: r.amendment_dates ?? [],
    renewal_date: r.renewal_date ?? null,
    withdrawal_date: r.withdrawal_date ?? null,
    withdrawal_reason: r.withdrawal_reason ?? null,
    completion_date: r.completion_date ?? null,
    title: r.title ?? null,
    project_type: r.project_type ?? null,
    sector: r.sector ?? null,
    description: r.description ?? null,
    raw_details: r.raw_details ?? null,
    parcel_no: r.parcel_no ?? null,
    parcels: r.parcels ?? null,
    is_partial: r.is_partial ?? null,
    multi_parcel: r.multi_parcel ?? null,
    descriptive_location: r.descriptive_location ?? null,
    muqataa_no: r.muqataa_no ?? null,
    muqataa_name: r.muqataa_name ?? null,
    district: r.district ?? null,
    area_olk: r.area_olk ?? null,
    area_m2: r.area_m2 ?? null,
    area_total_m2: r.area_total_m2 ?? null,
    area_factor_note: r.area_factor_note ?? null,
    owner: r.owner ?? null,
    land_right: r.land_right ?? null,
    zoning: r.zoning ?? null,
    coordinates: r.coordinates ?? null,
    investor_name: r.investor_name ?? null,
    investor_nationality: r.investor_nationality ?? null,
    company_ref: r.company_ref ?? null,
    capital: r.capital ?? null,
    lease_rate: r.lease_rate ?? null,
    term_years: r.term_years ?? null,
    exemptions: r.exemptions ?? null,
    opportunity_ref: r.opportunity_ref ?? null,
    legal_refs: r.legal_refs ?? [],
    source_url: r.source_url ?? null,
    source: r.source ?? null,
    created_by: r.created_by ?? null,
    updated_at: r.updated_at ?? null,
    verification: r.verification ?? null,
    review_reasons: r.review_reasons ?? [],
    notes: r.notes ?? null,
  };
}

export function loadLicenses(): Record<string, unknown>[] {
  const file = readData<CountedFile<RawLicense>>("licenses_structured.json");
  if (typeof file.count === "number") {
    assertCount("licenses(count↔records)", file.records.length, file.count);
  }
  assertCount("licenses", file.records.length, EXPECTED.licenses);
  return file.records.map(toRow);
}

export async function importLicenses(sb: SupabaseClient): Promise<number> {
  const rows = loadLicenses();
  await upsertAll(sb, "licenses", rows, "record_id");
  return rows.length;
}
