-- م3.1 · إضافة entity_id لقطع الخريطة: معرّف الكيان الفعلي (المفترضة id · الفرصة/الرخصة record_id)
-- ليفتح من الإشارة نافذة القطعة الموحّدة للكيان الصحيح. (ref_id يبقى مفتاح المعلم الفريد = هندسة القطعة.)
set search_path = public, extensions;

drop view if exists map_parcels;

create view map_parcels
with (security_invoker = true) as
select
  'assumed'::text             as kind,
  ap.id::text                 as ref_id,
  ap.id::text                 as entity_id,
  ap.parcel_no                as parcel_no,
  ap.state::text              as state,
  st_asgeojson(ap.geom)::jsonb as geometry,
  coalesce(ap.name, ap.parcel_no, 'قطعة مفترضة') as label
from assumed_parcels ap
where ap.geom is not null
union all
select
  case when lic.status is not null then 'license' else 'opportunity' end as kind,
  pg.id::text                 as ref_id,
  coalesce(lic.record_id, opp.record_id)::text as entity_id,
  pg.parcel_no                as parcel_no,
  coalesce(lic.status::text, case when opp.record_id is not null then 'announced'::text end) as state,
  st_asgeojson(pg.geom)::jsonb as geometry,
  coalesce(lic.title, opp.title, pg.parcel_no, 'قطعة') as label
from parcel_geometry pg
left join lateral (
  select l.record_id, l.status, l.title from licenses l
  where l.parcel_no = pg.parcel_no and coalesce(l.muqataa_no, '') = coalesce(pg.muqataa_no, '')
  limit 1
) lic on true
left join lateral (
  select o.record_id, o.title from opportunities o
  where o.parcel_no = pg.parcel_no and coalesce(o.muqataa_no, '') = coalesce(pg.muqataa_no, '')
  limit 1
) opp on true
where pg.geom is not null;

comment on view map_parcels is 'قطع الخريطة الموحّدة (هندسة + حالة + عنوان + entity_id) للعرض ونافذة القطعة — م3.1.';
grant select on map_parcels to authenticated;
