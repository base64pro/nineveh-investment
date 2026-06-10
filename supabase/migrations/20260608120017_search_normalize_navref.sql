set search_path = public, extensions;

-- م5.2+ · تطبيع عربي للبحث الذكي: توحيد الألف/الياء/التاء المربوطة + حذف التشكيل والتطويل + تصغير لاتيني.
create or replace function ar_normalize(t text) returns text language sql immutable as $$
  select translate(
    regexp_replace(lower(coalesce(t, '')), '[ًٌٍَُِّْـ]', '', 'g'),
    'أإآةىؤئ', 'اااهيوي'
  );
$$;

-- ترقية البحث: تطبيع الطرفين + إرجاع مرجع الخريطة (map_ref) ووجود الرسم (has_geom) للطيران الدقيق.
drop function if exists super_search(text, text, text, text[], int);

create function super_search(
  p_q text default null,
  p_sector text default null,
  p_status text default null,
  p_kinds text[] default '{}',
  p_limit int default 12
) returns table (
  kind text, label text, sector text, district text, status text,
  parcel_no text, map_ref text, has_geom boolean, rank int
) language sql stable security invoker as $$
  with pat as (
    select case when nullif(btrim(coalesce(p_q, '')), '') is null
                then null else '%' || ar_normalize(btrim(p_q)) || '%' end as p
  )
  -- الفرص
  select 'opportunity', o.title, o.sector, o.district, null::text, o.parcel_no,
         o.parcel_no,
         exists(select 1 from parcel_geometry g where g.parcel_no = o.parcel_no
                  and coalesce(g.muqataa_no,'') = coalesce(o.muqataa_no,'')),
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
         l.parcel_no,
         exists(select 1 from parcel_geometry g where g.parcel_no = l.parcel_no
                  and coalesce(g.muqataa_no,'') = coalesce(l.muqataa_no,'')),
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
  -- الشركات (لا تظهر على الخريطة)
  select 'company', c.name, c.sector, c.governorate, null::text, null::text,
         null::text, false,
         (case when ar_normalize(c.name) ilike (select p from pat) then 2 else 1 end)
    from companies c
   where (p_kinds = '{}' or 'company' = any(p_kinds)) and p_status is null
     and (p_sector is null or c.sector = p_sector)
     and ((select p from pat) is null
          or ar_normalize(c.name) ilike (select p from pat) or ar_normalize(c.activity) ilike (select p from pat)
          or ar_normalize(c.manager) ilike (select p from pat))
  union all
  -- المفترضة (مرجع الخريطة = id · الرسم في geom مباشرة)
  select 'assumed', a.name, a.sector, a.district, a.state::text, a.parcel_no,
         a.id::text, (a.geom is not null),
         (case when ar_normalize(a.parcel_no) ilike (select p from pat) then 3
               when ar_normalize(a.name) ilike (select p from pat) then 2 else 1 end)
    from assumed_parcels a
   where (p_kinds = '{}' or 'assumed' = any(p_kinds)) and p_status is null
     and (p_sector is null or a.sector = p_sector)
     and ((select p from pat) is null
          or ar_normalize(a.name) ilike (select p from pat) or ar_normalize(a.parcel_no) ilike (select p from pat)
          or ar_normalize(a.district) ilike (select p from pat) or ar_normalize(a.owner) ilike (select p from pat))
  order by 9 desc, 2 nulls last
  limit p_limit;
$$;

comment on function super_search(text, text, text, text[], int) is 'م5.2+ · بحث فائق حتمي مُطبَّع عربياً + مرجع خريطة (لا تأليف).';
grant execute on function super_search(text, text, text, text[], int) to authenticated;
