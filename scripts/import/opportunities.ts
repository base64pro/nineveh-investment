import type { SupabaseClient } from "@supabase/supabase-js";
import { readData } from "../lib/data";
import { assertCount, EXPECTED } from "../lib/counts";
import { upsertAll } from "../lib/upsert";
import { asBool, asDate, asNumber } from "../lib/coerce";
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
    is_partial: asBool(r.is_partial, "is_partial"),
    multi_parcel: asBool(r.multi_parcel, "multi_parcel"),
    descriptive_location: asBool(r.descriptive_location, "descriptive_location"),
    parcels_in_table: asBool(r.parcels_in_table, "parcels_in_table"),
    muqataa_no: r.muqataa_no ?? null,
    muqataa_name: r.muqataa_name ?? null,
    district: r.district ?? null,
    area_olk: asNumber(r.area_olk, "area_olk"),
    area_m2: asNumber(r.area_m2, "area_m2"),
    area_total_m2: asNumber(r.area_total_m2, "area_total_m2"),
    area_factor_note: r.area_factor_note ?? null,
    owner: r.owner ?? null,
    zoning: r.zoning ?? null,
    coordinates: r.coordinates ?? null,
    announcement_number: r.announcement_number ?? null,
    announcement_type: r.announcement_type ?? null,
    publish_date: asDate(r.publish_date),
    deadline: asDate(r.deadline),
    opp_status: r.opp_status ?? null,
    conditions: r.conditions ?? null,
    doc_fee: asNumber(r.doc_fee, "doc_fee"),
    related_announcements: r.related_announcements ?? [],
    license_ref: r.license_ref ?? [],
    legal_refs: r.legal_refs ?? [],
    source_url: r.source_url ?? null,
    source: r.source ?? null,
    image: r.image ?? null,
    views: asNumber(r.views, "views"),
    updated_at: asDate(r.updated_at),
    verification: r.verification ?? null,
    review_reasons: r.review_reasons ?? [],
    notes: r.notes ?? null,
    announcement_count: asNumber(r.announcement_count, "announcement_count"),
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
