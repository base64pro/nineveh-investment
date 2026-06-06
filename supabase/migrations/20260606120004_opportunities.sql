-- م0 · الفرص الاستثمارية (§ج.8/1) — 27 سجلاً (الحالة: معلَنة)
set search_path = public, extensions;

create table opportunities (
  record_id             bigint primary key,
  kind                  text not null default 'opportunity',
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
  parcels_in_table      boolean,
  muqataa_no            text,
  muqataa_name          text,
  district              text,
  area_olk              numeric,
  area_m2               numeric,
  area_total_m2         numeric,
  area_factor_note      text,
  owner                 text,
  zoning                text,
  coordinates           jsonb,                  -- فارغ حالياً (الهندسة في parcel_geometry)
  announcement_number   text,
  announcement_type     text,
  publish_date          date,
  deadline              date,
  opp_status            text,
  conditions            jsonb,
  doc_fee               numeric,
  related_announcements jsonb not null default '[]'::jsonb,
  license_ref           jsonb not null default '[]'::jsonb,   -- إحالة رخوة → license_number
  legal_refs            jsonb not null default '[]'::jsonb,
  source_url            text,
  source                text,
  image                 text,
  views                 integer,
  updated_at            timestamptz,            -- من المصدر
  verification          text,
  review_reasons        jsonb not null default '[]'::jsonb,
  notes                 text,
  announcement_count    integer,
  announcement_history  jsonb not null default '[]'::jsonb,
  created_at            timestamptz not null default now()
);
comment on table opportunities is 'الفرص الاستثمارية المعلَنة (§ج.8/1)';
