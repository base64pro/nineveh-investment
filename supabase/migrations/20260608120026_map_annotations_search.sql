-- م7.3 · الطبقة المحرَّرة (§ج.8/8 · §هـ.4): تفعيل map_elements — عرض جغرافي + إنشاء + دخول البحث بأولوية عليا
-- («عناصرنا المحرَّرة/المعرّفة أولاً» §هـ.4). العناصر تصبح بياناتنا: قابلة للبحث والإدارة.
set search_path = public, extensions;

-- (أ) عرض جغرافي للعناصر المسمّاة + نقطة مركزية للطيران/التسمية
create or replace view map_elements_geo
with (security_invoker = true) as
select
  me.id,
  me.element_type,
  me.name,
  st_asgeojson(me.geom)::jsonb        as geometry,
  st_x(st_pointonsurface(me.geom))    as lng,
  st_y(st_pointonsurface(me.geom))    as lat
from map_elements me
where me.geom is not null and nullif(btrim(coalesce(me.name, '')), '') is not null;

comment on view map_elements_geo is 'م7.3 · عناصر الخريطة المحرَّرة المسمّاة (هندسة GeoJSON + نقطة مركزية).';
grant select on map_elements_geo to authenticated;

-- (ب) إنشاء عنصر محرَّر (نقطة أو مضلّع) من GeoJSON
create or replace function create_map_element(p_name text, p_type text, p_geom jsonb)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_id uuid;
  v_geom geometry;
begin
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'الاسم مطلوب';
  end if;
  v_geom := st_setsrid(st_geomfromgeojson(p_geom::text), 4326);
  if v_geom is null or st_isempty(v_geom) then
    raise exception 'هندسة غير صالحة';
  end if;
  insert into map_elements (element_type, name, geom, label)
  values (p_type, btrim(p_name), v_geom, btrim(p_name))
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function create_map_element(text, text, jsonb) to authenticated;

-- (ج) البحث v3: + إحداثيات (للطيران المباشر) + التسميات المحرَّرة برتبة عليا (4)
drop function if exists super_search(text, text, text, text[], int);

create function super_search(
  p_q text default null,
  p_sector text default null,
  p_status text default null,
  p_kinds text[] default '{}',
  p_limit int default 12
) returns table (
  kind text, label text, sector text, district text, status text,
  parcel_no text, map_ref text, entity_id text, has_geom boolean,
  lng float8, lat float8, rank int
) language sql stable security invoker as $$
  with pat as (
    select case when nullif(btrim(coalesce(p_q, '')), '') is null
                then null else '%' || ar_normalize(btrim(p_q)) || '%' end as p
  )
  -- التسميات المحرَّرة (أولوية عليا §هـ.4 — تظهر عند مطابقة نصية فقط)
  select 'annotation', me.name, null::text, null::text, null::text, null::text,
         me.id::text, me.id::text, true, me.lng, me.lat, 4
    from map_elements_geo me
   where (p_kinds = '{}' or 'annotation' = any(p_kinds))
     and p_status is null and p_sector is null
     and (select p from pat) is not null
     and ar_normalize(me.name) ilike (select p from pat)
  union all
  -- الفرص
  select 'opportunity', o.title, o.sector, o.district, null::text, o.parcel_no,
         o.parcel_no, o.record_id::text,
         exists(select 1 from parcel_geometry g where g.parcel_no = o.parcel_no
                  and coalesce(g.muqataa_no,'') = coalesce(o.muqataa_no,'')),
         null::float8, null::float8,
         (case when ar_normalize(o.parcel_no) ilike (select p from pat) then 3
               when ar_normalize(o.title) ilike (select p from pat) then 2 else 1 end)
    from opportunities o
   where (p_kinds = '{}' or 'opportunity' = any(p_kinds)) and p_status is null
     and (p_sector is null or o.sector = p_sector)
     and ((select p from pat) is null
          or ar_normalize(o.title) ilike (select p from pat) or ar_normalize(o.parcel_no) ilike (select p from pat)
          or ar_normalize(o.district) ilike (select p from pat) or ar_normalize(o.neighborhood) ilike (select p from pat)
          or ar_normalize(o.owner) ilike (select p from pat) or ar_normalize(o.muqataa_name) ilike (select p from pat))
  union all
  -- الرخص
  select 'license', l.title, l.sector, l.district, l.status::text, l.parcel_no,
         l.parcel_no, l.record_id::text,
         exists(select 1 from parcel_geometry g where g.parcel_no = l.parcel_no
                  and coalesce(g.muqataa_no,'') = coalesce(l.muqataa_no,'')),
         null::float8, null::float8,
         (case when ar_normalize(l.parcel_no) ilike (select p from pat) then 3
               when ar_normalize(l.title) ilike (select p from pat) then 2 else 1 end)
    from licenses l
   where (p_kinds = '{}' or 'license' = any(p_kinds))
     and (p_sector is null or l.sector = p_sector)
     and (p_status is null or l.status::text = p_status)
     and ((select p from pat) is null
          or ar_normalize(l.title) ilike (select p from pat) or ar_normalize(l.parcel_no) ilike (select p from pat)
          or ar_normalize(l.district) ilike (select p from pat) or ar_normalize(l.investor_name) ilike (select p from pat)
          or ar_normalize(l.owner) ilike (select p from pat))
  union all
  -- الشركات
  select 'company', c.name, c.sector, c.governorate, null::text, null::text,
         null::text, c.id::text, false, null::float8, null::float8,
         (case when ar_normalize(c.name) ilike (select p from pat) then 2 else 1 end)
    from companies c
   where (p_kinds = '{}' or 'company' = any(p_kinds)) and p_status is null
     and (p_sector is null or c.sector = p_sector)
     and ((select p from pat) is null
          or ar_normalize(c.name) ilike (select p from pat) or ar_normalize(c.activity) ilike (select p from pat)
          or ar_normalize(c.manager) ilike (select p from pat))
  union all
  -- المفترضة
  select 'assumed', a.name, a.sector, a.district, a.state::text, a.parcel_no,
         a.id::text, a.id::text, (a.geom is not null), null::float8, null::float8,
         (case when ar_normalize(a.parcel_no) ilike (select p from pat) then 3
               when ar_normalize(a.name) ilike (select p from pat) then 2 else 1 end)
    from assumed_parcels a
   where (p_kinds = '{}' or 'assumed' = any(p_kinds)) and p_status is null
     and (p_sector is null or a.sector = p_sector)
     and ((select p from pat) is null
          or ar_normalize(a.name) ilike (select p from pat) or ar_normalize(a.parcel_no) ilike (select p from pat)
          or ar_normalize(a.district) ilike (select p from pat) or ar_normalize(a.owner) ilike (select p from pat))
  order by 12 desc, 2 nulls last
  limit p_limit;
$$;

comment on function super_search(text, text, text, text[], int) is 'م7.3 · بحث فائق: التسميات المحرَّرة أولاً (§هـ.4) + إحداثيات للطيران (لا تأليف).';
grant execute on function super_search(text, text, text, text[], int) to authenticated;
