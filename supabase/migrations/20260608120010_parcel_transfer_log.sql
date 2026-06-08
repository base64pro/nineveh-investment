-- م3.5+ · ضمان صفر فقدان عند نقل القطعة بين الأقسام: سجلّ نقل يحفظ **اللقطة الكاملة** للمصدر.
-- بدل حفظ مجموعة مختارة في الملاحظات (ثغرة)، نحفظ كل حقول المصدر كـjsonb متسلسل عبر النقلات.
set search_path = public, extensions;

alter table opportunities add column if not exists transfer_log jsonb not null default '[]'::jsonb;
alter table licenses add column if not exists transfer_log jsonb not null default '[]'::jsonb;
alter table assumed_parcels add column if not exists transfer_log jsonb not null default '[]'::jsonb;

create or replace function move_parcel(p_source_kind text, p_source_id text, p_target_state text)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_src jsonb;
  v_geom geometry;
  v_src_table text;
  v_tgt_table text;
  v_tgt_kind text;
  v_new_record_id bigint;
  v_new_id text;
  v_log jsonb;
  v_notes text;
begin
  if p_target_state not in ('announced', 'in-progress', 'completed', 'withdrawn', 'assumed') then
    raise exception 'حالة هدف غير صالحة: %', p_target_state;
  end if;

  v_src_table := case p_source_kind
    when 'opportunity' then 'opportunities' when 'license' then 'licenses' when 'assumed' then 'assumed_parcels' else null end;
  if v_src_table is null then raise exception 'نوع مصدر غير صالح: %', p_source_kind; end if;

  v_tgt_table := case
    when p_target_state = 'announced' then 'opportunities'
    when p_target_state = 'assumed' then 'assumed_parcels'
    else 'licenses' end;
  v_tgt_kind := case v_tgt_table when 'opportunities' then 'opportunity' when 'licenses' then 'license' else 'assumed' end;

  -- نفس الجدول: تغيير حالة الرخصة فقط (لا نقل، لا تغيير بيانات).
  if v_src_table = v_tgt_table then
    if v_tgt_table = 'licenses' then
      update licenses set status = p_target_state::license_status where record_id = p_source_id::bigint;
    end if;
    return jsonb_build_object('kind', v_tgt_kind, 'id', p_source_id);
  end if;

  -- قراءة المصدر كاملاً (jsonb) + هندسته
  if p_source_kind = 'assumed' then
    select to_jsonb(t) - 'geom', t.geom into v_src, v_geom from assumed_parcels t where t.id = p_source_id::uuid;
  else
    execute format('select to_jsonb(t) from %I t where t.record_id = $1', v_src_table) into v_src using p_source_id::bigint;
    select pg.geom into v_geom from parcel_geometry pg
      where pg.parcel_no = (v_src->>'parcel_no') and coalesce(pg.muqataa_no, '') = coalesce(v_src->>'muqataa_no', '') limit 1;
  end if;
  if v_src is null then raise exception 'المصدر غير موجود'; end if;

  -- **صفر فقدان**: لقطة كاملة لكل حقول المصدر + سلسلة النقل السابقة (لا قائمة مختارة).
  v_log := coalesce(v_src->'transfer_log', '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object('from_kind', p_source_kind, 'moved_at', now(), 'data', (v_src - 'transfer_log')));
  v_notes := nullif(v_src->>'notes', '');

  if v_tgt_table = 'opportunities' then
    select coalesce(max(record_id), 0) + 1 into v_new_record_id from opportunities;
    insert into opportunities (record_id, kind, title, sector, parcel_no, muqataa_no, muqataa_name, district, neighborhood,
        area_olk, area_m2, area_total_m2, area_factor_note, owner, zoning, notes, transfer_log)
    values (v_new_record_id, 'opportunity',
        coalesce(nullif(v_src->>'title',''), nullif(v_src->>'name','')), nullif(v_src->>'sector',''),
        nullif(v_src->>'parcel_no',''), nullif(v_src->>'muqataa_no',''), nullif(v_src->>'muqataa_name',''),
        nullif(v_src->>'district',''), nullif(v_src->>'neighborhood',''),
        (v_src->>'area_olk')::numeric, (v_src->>'area_m2')::numeric, (v_src->>'area_total_m2')::numeric,
        nullif(v_src->>'area_factor_note',''), nullif(v_src->>'owner',''), nullif(v_src->>'zoning',''), v_notes, v_log);
    v_new_id := v_new_record_id::text;

  elsif v_tgt_table = 'licenses' then
    select coalesce(max(record_id), 0) + 1 into v_new_record_id from licenses;
    insert into licenses (record_id, kind, status, title, sector, parcel_no, muqataa_no, muqataa_name, district, subdistrict, neighborhood,
        area_olk, area_m2, area_total_m2, area_factor_note, owner, land_right, zoning, capital, company_ref, investor_name, investor_nationality, notes, transfer_log)
    values (v_new_record_id, 'license', p_target_state::license_status,
        coalesce(nullif(v_src->>'title',''), nullif(v_src->>'name','')), nullif(v_src->>'sector',''),
        nullif(v_src->>'parcel_no',''), nullif(v_src->>'muqataa_no',''), nullif(v_src->>'muqataa_name',''),
        nullif(v_src->>'district',''), nullif(v_src->>'subdistrict',''), nullif(v_src->>'neighborhood',''),
        (v_src->>'area_olk')::numeric, (v_src->>'area_m2')::numeric, (v_src->>'area_total_m2')::numeric,
        nullif(v_src->>'area_factor_note',''), nullif(v_src->>'owner',''), nullif(v_src->>'land_right',''), nullif(v_src->>'zoning',''),
        coalesce(v_src->>'capital', v_src->>'value')::numeric,
        nullif(v_src->>'company_ref',''), nullif(v_src->>'investor_name',''), nullif(v_src->>'investor_nationality',''), v_notes, v_log);
    v_new_id := v_new_record_id::text;

  else -- assumed_parcels
    insert into assumed_parcels (name, state, parcel_no, muqataa_no, muqataa_name, district, subdistrict, neighborhood,
        sector, owner, land_right, area_m2, value, geom, company_ref, notes, transfer_log)
    values (coalesce(nullif(v_src->>'name',''), nullif(v_src->>'title','')), 'assumed',
        nullif(v_src->>'parcel_no',''), nullif(v_src->>'muqataa_no',''), nullif(v_src->>'muqataa_name',''),
        nullif(v_src->>'district',''), nullif(v_src->>'subdistrict',''), nullif(v_src->>'neighborhood',''),
        nullif(v_src->>'sector',''), nullif(v_src->>'owner',''), nullif(v_src->>'land_right',''),
        (v_src->>'area_m2')::numeric, coalesce(v_src->>'value', v_src->>'capital')::numeric, v_geom,
        nullif(v_src->>'company_ref',''), v_notes, v_log)
    returning id::text into v_new_id;
  end if;

  -- نقل الهندسة
  if p_source_kind = 'assumed' and v_tgt_table in ('opportunities', 'licenses')
     and v_geom is not null and nullif(v_src->>'parcel_no','') is not null then
    insert into parcel_geometry (parcel_no, muqataa_no, geom) values (v_src->>'parcel_no', nullif(v_src->>'muqataa_no',''), v_geom);
  elsif p_source_kind in ('opportunity', 'license') and v_tgt_table = 'assumed_parcels' then
    delete from parcel_geometry where parcel_no = (v_src->>'parcel_no') and coalesce(muqataa_no, '') = coalesce(v_src->>'muqataa_no', '');
  end if;

  -- نقل الزيارات (من الرخصة المصدر)
  if p_source_kind = 'license' then
    update visits set parcel_ref = v_new_id where parcel_ref = p_source_id;
  end if;

  -- حذف المصدر (بياناته محفوظة كاملةً في transfer_log بالهدف)
  if p_source_kind = 'assumed' then
    delete from assumed_parcels where id = p_source_id::uuid;
  else
    execute format('delete from %I where record_id = $1', v_src_table) using p_source_id::bigint;
  end if;

  return jsonb_build_object('kind', v_tgt_kind, 'id', v_new_id);
end;
$$;

comment on function move_parcel(text, text, text) is 'م3.5 · نقل القطعة بين الحالات الخمس + لقطة كاملة للمصدر في transfer_log (صفر فقدان) + هندسة + زيارات + حذف المصدر.';
grant execute on function move_parcel(text, text, text) to authenticated;
