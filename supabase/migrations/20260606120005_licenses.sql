-- م0 · الرخص الاستثمارية (§ج.8/2) — 146 سجلاً (الحالات: قيد/منجزة/مسحوبة)
set search_path = public, extensions;

create table licenses (
  record_id             bigint primary key,
  kind                  text not null default 'license',
  license_number        text,
  status                license_status not null,
  status_history        jsonb not null default '[]'::jsonb,
  issue_date            date,
  amendment_dates       jsonb not null default '[]'::jsonb,
  renewal_date          date,
  withdrawal_date       date,
  withdrawal_reason     text,
  completion_date       date,
  title                 text,
  project_type          text,
  sector                text,
  description           text,
  raw_details           text,
  parcel_no             text,
  parcels               text[],
  is_partial            boolean,
  multi_parcel          boolean,
  descriptive_location  boolean,
  muqataa_no            text,
  muqataa_name          text,
  district              text,
  area_olk              numeric,
  area_m2               numeric,
  area_total_m2         numeric,
  area_factor_note      text,
  owner                 text,
  land_right            text,                  -- نوع الحقّ (مساطحة/إيجار/تخصيص/تملّك)
  zoning                text,
  coordinates           jsonb,
  investor_name         text,
  investor_nationality  text,
  company_ref           text,                  -- إحالة رخوة → companies.id
  capital               numeric,
  lease_rate            numeric,
  term_years            numeric,
  exemptions            jsonb,
  opportunity_ref       text,                  -- إحالة رخوة → opportunities
  legal_refs            jsonb not null default '[]'::jsonb,
  source_url            text,
  source                text,
  created_by            text,
  updated_at            timestamptz,           -- من المصدر
  verification          text,
  review_reasons        jsonb not null default '[]'::jsonb,
  notes                 text,
  created_at            timestamptz not null default now()
);
comment on table licenses is 'الرخص الاستثمارية (§ج.8/2)';
