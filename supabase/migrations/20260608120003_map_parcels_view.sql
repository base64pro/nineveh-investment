-- م2.4 · view موحّد لقطع الخريطة: هندسة GeoJSON (لا EWKB) + الحالة — للعرض الملوّن.
-- المفترضة من assumed_parcels.geom؛ الفرص/الرخص من parcel_geometry (الحالة من الكيان المطابق).
set search_path = public, extensions;

create or replace view map_parcels
with (security_invoker = true) as
select
  'assumed'::text             as kind,
  ap.id::text                 as ref_id,
  ap.parcel_no                as parcel_no,
  ap.state::text              as state,
  st_asgeojson(ap.geom)::jsonb as geometry
from assumed_parcels ap
where ap.geom is not null
union all
select
  case when lic.status is not null then 'license' else 'opportunity' end as kind,
  pg.id::text                 as ref_id,
  pg.parcel_no                as parcel_no,
  coalesce(lic.status::text, case when opp.record_id is not null then 'announced'::text end) as state,
  st_asgeojson(pg.geom)::jsonb as geometry
from parcel_geometry pg
left join lateral (
  select l.status from licenses l
  where l.parcel_no = pg.parcel_no
    and coalesce(l.muqataa_no, '') = coalesce(pg.muqataa_no, '')
  limit 1
) lic on true
left join lateral (
  select o.record_id from opportunities o
  where o.parcel_no = pg.parcel_no
    and coalesce(o.muqataa_no, '') = coalesce(pg.muqataa_no, '')
  limit 1
) opp on true
where pg.geom is not null;

comment on view map_parcels is 'قطع الخريطة الموحّدة (هندسة GeoJSON + الحالة) للعرض الملوّن — م2.4.';
grant select on map_parcels to authenticated;
