-- م7.1 · (أ) إضافة الحي/القضاء لطبقة قطع الخريطة — لفلترة الظهور حسب الحي (طلب معتمد).
--        (ب) دالّة تحديث هندسة قطعة مرسومة — لوضع «تحرير الرسم» (§هـ.4 «تعديل الرسم رسومياً»).
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
  coalesce(ap.name, ap.parcel_no, 'قطعة مفترضة') as label,
  ap.neighborhood             as neighborhood,
  ap.district                 as district
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
  coalesce(lic.title, opp.title, pg.parcel_no, 'قطعة') as label,
  coalesce(lic.neighborhood, opp.neighborhood) as neighborhood,
  coalesce(lic.district, opp.district)         as district
from parcel_geometry pg
left join lateral (
  select l.record_id, l.status, l.title, l.neighborhood, l.district from licenses l
  where l.parcel_no = pg.parcel_no and coalesce(l.muqataa_no, '') = coalesce(pg.muqataa_no, '')
  order by l.record_id desc
  limit 1
) lic on true
left join lateral (
  select o.record_id, o.title, o.neighborhood, o.district from opportunities o
  where o.parcel_no = pg.parcel_no and coalesce(o.muqataa_no, '') = coalesce(pg.muqataa_no, '')
  order by o.record_id desc
  limit 1
) opp on true
where pg.geom is not null;

comment on view map_parcels is 'قطع الخريطة الموحّدة (+ الحي/القضاء للفلترة) — اختيار حتمي للأحدث عند التعدد.';
grant select on map_parcels to authenticated;

-- تحديث هندسة قطعة بمعرّف معلمها (ref_id من map_parcels): المفترضة في جدولها، وغيرها في parcel_geometry.
create or replace function update_parcel_geom(p_kind text, p_ref_id text, p_geom jsonb)
returns void
language plpgsql
security invoker
as $$
declare
  v_geom geometry;
begin
  v_geom := st_multi(st_setsrid(st_geomfromgeojson(p_geom::text), 4326));
  if v_geom is null or st_isempty(v_geom) then
    raise exception 'هندسة غير صالحة';
  end if;
  if p_kind = 'assumed' then
    update assumed_parcels set geom = v_geom, updated_at = now() where id = p_ref_id::uuid;
  else
    update parcel_geometry set geom = v_geom, updated_at = now() where id = p_ref_id::uuid;
  end if;
  if not found then
    raise exception 'القطعة غير موجودة';
  end if;
end;
$$;

comment on function update_parcel_geom(text, text, jsonb) is 'م7.1 · تعديل حدود قطعة مرسومة (وضع التحرير §هـ.4).';
grant execute on function update_parcel_geom(text, text, jsonb) to authenticated;
