set search_path = public, extensions;

-- م5.2 · البحث الفائق (§هـ.2.ج): بحث **حتمي** موحّد في بياناتنا (لا تأليف).
-- يُرجِع حقولاً بنيوية (التسميات تُبنى في طبقة العرض). الأولوية لمطابقة رقم القطعة ثم العنوان.
create or replace function super_search(
  p_q text default null,
  p_sector text default null,
  p_status text default null,
  p_kinds text[] default '{}',
  p_limit int default 12
) returns table (
  kind text, label text, sector text, district text, status text, parcel_no text, rank int
) language sql stable security invoker as $$
  with pat as (
    select case when nullif(btrim(coalesce(p_q, '')), '') is null
                then null else '%' || btrim(p_q) || '%' end as p
  )
  -- الفرص
  select 'opportunity', o.title, o.sector, o.district, null::text, o.parcel_no,
         (case when o.parcel_no ilike (select p from pat) then 3
               when o.title ilike (select p from pat) then 2 else 1 end)
    from opportunities o
   where (p_kinds = '{}' or 'opportunity' = any(p_kinds))
     and p_status is null
     and (p_sector is null or o.sector = p_sector)
     and ((select p from pat) is null
          or o.title ilike (select p from pat) or o.parcel_no ilike (select p from pat)
          or o.district ilike (select p from pat) or o.neighborhood ilike (select p from pat)
          or o.owner ilike (select p from pat) or o.muqataa_name ilike (select p from pat))
  union all
  -- الرخص
  select 'license', l.title, l.sector, l.district, l.status::text, l.parcel_no,
         (case when l.parcel_no ilike (select p from pat) then 3
               when l.title ilike (select p from pat) then 2 else 1 end)
    from licenses l
   where (p_kinds = '{}' or 'license' = any(p_kinds))
     and (p_sector is null or l.sector = p_sector)
     and (p_status is null or l.status::text = p_status)
     and ((select p from pat) is null
          or l.title ilike (select p from pat) or l.parcel_no ilike (select p from pat)
          or l.district ilike (select p from pat) or l.investor_name ilike (select p from pat)
          or l.owner ilike (select p from pat))
  union all
  -- الشركات
  select 'company', c.name, c.sector, c.governorate, null::text, null::text,
         (case when c.name ilike (select p from pat) then 2 else 1 end)
    from companies c
   where (p_kinds = '{}' or 'company' = any(p_kinds))
     and p_status is null
     and (p_sector is null or c.sector = p_sector)
     and ((select p from pat) is null
          or c.name ilike (select p from pat) or c.activity ilike (select p from pat)
          or c.manager ilike (select p from pat))
  union all
  -- المفترضة
  select 'assumed', a.name, a.sector, a.district, a.state::text, a.parcel_no,
         (case when a.parcel_no ilike (select p from pat) then 3
               when a.name ilike (select p from pat) then 2 else 1 end)
    from assumed_parcels a
   where (p_kinds = '{}' or 'assumed' = any(p_kinds))
     and p_status is null
     and (p_sector is null or a.sector = p_sector)
     and ((select p from pat) is null
          or a.name ilike (select p from pat) or a.parcel_no ilike (select p from pat)
          or a.district ilike (select p from pat) or a.owner ilike (select p from pat))
  order by 7 desc, 2 nulls last
  limit p_limit;
$$;

comment on function super_search(text, text, text, text[], int) is 'م5.2 · بحث فائق حتمي في بيانات النظام (لا تأليف).';
grant execute on function super_search(text, text, text, text[], int) to authenticated;
