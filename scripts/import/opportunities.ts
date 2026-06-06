import type { SupabaseClient } from "@supabase/supabase-js";
import { readData } from "../lib/data";
import { assertCount, EXPECTED } from "../lib/counts";
import { upsertAll } from "../lib/upsert";
import type { CountedFile, RawOpportunity } from "./raw-types";

function toRow(r: RawOpportunity): Record<string, unknown> {
  if (r.record_id == null) throw new Error("فرصة بلا record_id — توقّف (لا تأليف).");
  return {
    record_id: r.record_id,
    kind: r._kind ?? "opportunity",
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
    parcels_in_table: r.parcels_in_table ?? null,
    muqataa_no: r.muqataa_no ?? null,
    muqataa_name: r.muqataa_name ?? null,
    district: r.district ?? null,
    area_olk: r.area_olk ?? null,
    area_m2: r.area_m2 ?? null,
    area_total_m2: r.area_total_m2 ?? null,
    area_factor_note: r.area_factor_note ?? null,
    owner: r.owner ?? null,
    zoning: r.zoning ?? null,
    coordinates: r.coordinates ?? null,
    announcement_number: r.announcement_number ?? null,
    announcement_type: r.announcement_type ?? null,
    publish_date: r.publish_date ?? null,
    deadline: r.deadline ?? null,
    opp_status: r.opp_status ?? null,
    conditions: r.conditions ?? null,
    doc_fee: r.doc_fee ?? null,
    related_announcements: r.related_announcements ?? [],
    license_ref: r.license_ref ?? [],
    legal_refs: r.legal_refs ?? [],
    source_url: r.source_url ?? null,
    source: r.source ?? null,
    image: r.image ?? null,
    views: r.views ?? null,
    updated_at: r.updated_at ?? null,
    verification: r.verification ?? null,
    review_reasons: r.review_reasons ?? [],
    notes: r.notes ?? null,
    announcement_count: r.announcement_count ?? null,
    announcement_history: r.announcement_history ?? [],
  };
}

/** قراءة + تحقّق عدّ + تحويل (بلا قاعدة). */
export function loadOpportunities(): Record<string, unknown>[] {
  const file = readData<CountedFile<RawOpportunity>>("opportunities_structured.json");
  if (typeof file.count === "number") {
    assertCount("opportunities(count↔records)", file.records.length, file.count);
  }
  assertCount("opportunities", file.records.length, EXPECTED.opportunities);
  return file.records.map(toRow);
}

export async function importOpportunities(sb: SupabaseClient): Promise<number> {
  const rows = loadOpportunities();
  await upsertAll(sb, "opportunities", rows, "record_id");
  return rows.length;
}
