-- م8.1 · حُرّاس المدير على RPCs الرسم/النقل: رسالة خطأ صريحة فورية بدل اعتماد RLS وحده
-- (RLS يحمي البيانات أصلاً، لكن النقل بنفس النوع كان «ينجح صامتاً» 0-صفوف؛ هذا يفشل بوضوح).
set search_path = public, extensions;

-- (1) إنشاء قطعة مفترضة (الرسم)
create or replace function create_assumed_parcel(
  p_geom jsonb, p_district text default null, p_subdistrict text default null
) returns uuid
language plpgsql security invoker set search_path = public, extensions
as $$
declare new_id uuid;
begin
  if not public.is_admin() then raise exception 'صلاحية المدير مطلوبة (الرسم محظور)'; end if;
  insert into assumed_parcels (geom, state, district, subdistrict)
  values (st_multi(st_setsrid(st_geomfromgeojson(p_geom::text), 4326)), 'assumed',
    nullif(btrim(coalesce(p_district, '')), ''), nullif(btrim(coalesce(p_subdistrict, '')), ''))
  returning id into new_id;
  return new_id;
end;
$$;

-- (2) ربط هندسة بقطعة موجودة (الرسم)
create or replace function create_parcel_geometry(
  p_geom jsonb, p_parcel_no text, p_muqataa_no text default null
) returns void
language plpgsql security invoker set search_path = public, extensions
as $$
begin
  if not public.is_admin() then raise exception 'صلاحية المدير مطلوبة (الرسم محظور)'; end if;
  insert into parcel_geometry (geom, parcel_no, muqataa_no)
  values (st_multi(st_setsrid(st_geomfromgeojson(p_geom::text), 4326)), p_parcel_no, p_muqataa_no)
  on conflict (parcel_no, muqataa_no) do update set geom = excluded.geom, updated_at = now();
end;
$$;

-- (3) تعديل حدود قطعة (تحرير الرسم)
create or replace function update_parcel_geom(p_kind text, p_ref_id text, p_geom jsonb)
returns void
language plpgsql security invoker set search_path = public, extensions
as $$
declare v_geom geometry;
begin
  if not public.is_admin() then raise exception 'صلاحية المدير مطلوبة (تعديل الرسم محظور)'; end if;
  v_geom := st_multi(st_setsrid(st_geomfromgeojson(p_geom::text), 4326));
  if v_geom is null or st_isempty(v_geom) then raise exception 'هندسة غير صالحة'; end if;
  if p_kind = 'assumed' then
    update assumed_parcels set geom = v_geom, updated_at = now() where id = p_ref_id::uuid;
  else
    update parcel_geometry set geom = v_geom, updated_at = now() where id = p_ref_id::uuid;
  end if;
  if not found then raise exception 'القطعة غير موجودة'; end if;
end;
$$;

-- (4) حذف رسمة قطعة (فك الارتباط)
create or replace function delete_parcel_geom(p_kind text, p_ref_id text)
returns void
language plpgsql security invoker set search_path = public, extensions
as $$
begin
  if not public.is_admin() then raise exception 'صلاحية المدير مطلوبة (حذف الرسمة محظور)'; end if;
  if p_kind = 'assumed' then
    update assumed_parcels set geom = null, updated_at = now() where id = p_ref_id::uuid;
  else
    delete from parcel_geometry where id = p_ref_id::uuid;
  end if;
  if not found then raise exception 'الرسمة غير موجودة'; end if;
end;
$$;

-- (5) نقل القطعة بين الأنواع/تغيير الحالة — حارس المدير على رأس v5 (بقية الجسم كما هو)
create or replace function move_parcel(p_source_kind text, p_source_id text, p_target_state text)
returns jsonb
language plpgsql security invoker set search_path = public, extensions
as $$
declare
  v_src jsonb; v_eff jsonb; v_restore jsonb; v_entry jsonb; v_geom geometry;
  v_src_table text; v_tgt_table text; v_tgt_kind text; v_new_record_id bigint;
  v_new_id text; v_parcel_no text; v_log jsonb; v_notes text;
begin
  if not public.is_admin() then raise exception 'صلاحية المدير مطلوبة (تغيير حالة القطعة محظور)'; end if;
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

  if v_src_table = v_tgt_table then
    if v_tgt_table = 'licenses' then
      update licenses set status = p_target_state::license_status where record_id = p_source_id::bigint;
    end if;
    return jsonb_build_object('kind', v_tgt_kind, 'id', p_source_id);
  end if;

  if p_source_kind = 'assumed' then
    select to_jsonb(t) - 'geom', t.geom into v_src, v_geom from assumed_parcels t where t.id = p_source_id::uuid;
  else
    execute format('select to_jsonb(t) from %I t where t.record_id = $1', v_src_table) into v_src using p_source_id::bigint;
    select pg.geom into v_geom from parcel_geometry pg
      where pg.parcel_no = (v_src->>'parcel_no') and coalesce(pg.muqataa_no, '') = coalesce(v_src->>'muqataa_no', '') limit 1;
  end if;
  if v_src is null then raise exception 'المصدر غير موجود'; end if;

  v_restore := '{}'::jsonb;
  for v_entry in select je.value from jsonb_array_elements(coalesce(v_src->'transfer_log', '[]'::jsonb)) je loop
    v_restore := v_restore || jsonb_strip_nulls(coalesce(v_entry->'data', '{}'::jsonb));
  end loop;
  v_eff := v_restore || jsonb_strip_nulls(v_src - 'transfer_log');

  v_log := coalesce(v_src->'transfer_log', '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object('from_kind', p_source_kind, 'moved_at', now(), 'data', (v_src - 'transfer_log')));
  v_notes := nullif(v_eff->>'notes', '');

  if v_tgt_table = 'opportunities' then
    select coalesce(max(record_id), 0) + 1 into v_new_record_id from opportunities;
  elsif v_tgt_table = 'licenses' then
    select coalesce(max(record_id), 0) + 1 into v_new_record_id from licenses;
  end if;
  v_parcel_no := nullif(v_eff->>'parcel_no', '');
  if p_source_kind = 'assumed' and v_tgt_table in ('opportunities', 'licenses') and v_geom is not null and v_parcel_no is null then
    v_parcel_no := 'مرسومة-' || v_new_record_id::text;
  end if;

  if v_tgt_table = 'opportunities' then
    insert into opportunities (record_id, kind, title, sector, project_type, description, raw_details, source_url,
        parcel_no, muqataa_no, muqataa_name, district, neighborhood,
        area_olk, area_m2, area_total_m2, area_factor_note, owner, zoning, notes, transfer_log)
    values (v_new_record_id, 'opportunity',
        coalesce(nullif(v_eff->>'title',''), nullif(v_eff->>'name','')), nullif(v_eff->>'sector',''),
        nullif(v_eff->>'project_type',''), nullif(v_eff->>'description',''), nullif(v_eff->>'raw_details',''), nullif(v_eff->>'source_url',''),
        v_parcel_no, nullif(v_eff->>'muqataa_no',''), nullif(v_eff->>'muqataa_name',''),
        nullif(v_eff->>'district',''), nullif(v_eff->>'neighborhood',''),
        (v_eff->>'area_olk')::numeric, (v_eff->>'area_m2')::numeric, (v_eff->>'area_total_m2')::numeric,
        nullif(v_eff->>'area_factor_note',''), nullif(v_eff->>'owner',''), nullif(v_eff->>'zoning',''), v_notes, v_log);
    v_new_id := v_new_record_id::text;
  elsif v_tgt_table = 'licenses' then
    insert into licenses (record_id, kind, status, license_number, title, sector, project_type, description, raw_details, source_url,
        parcel_no, muqataa_no, muqataa_name, district, subdistrict, neighborhood,
        area_olk, area_m2, area_total_m2, area_factor_note, owner, land_right, zoning, capital, lease_rate, term_years,
        company_ref, investor_name, investor_nationality, withdrawal_reason, notes, transfer_log)
    values (v_new_record_id, 'license', p_target_state::license_status, nullif(v_eff->>'license_number',''),
        coalesce(nullif(v_eff->>'title',''), nullif(v_eff->>'name','')), nullif(v_eff->>'sector',''),
        nullif(v_eff->>'project_type',''), nullif(v_eff->>'description',''), nullif(v_eff->>'raw_details',''), nullif(v_eff->>'source_url',''),
        v_parcel_no, nullif(v_eff->>'muqataa_no',''), nullif(v_eff->>'muqataa_name',''),
        nullif(v_eff->>'district',''), nullif(v_eff->>'subdistrict',''), nullif(v_eff->>'neighborhood',''),
        (v_eff->>'area_olk')::numeric, (v_eff->>'area_m2')::numeric, (v_eff->>'area_total_m2')::numeric,
        nullif(v_eff->>'area_factor_note',''), nullif(v_eff->>'owner',''), nullif(v_eff->>'land_right',''), nullif(v_eff->>'zoning',''),
        coalesce((v_eff->>'capital')::numeric, (v_eff->>'value')::numeric), (v_eff->>'lease_rate')::numeric, (v_eff->>'term_years')::numeric,
        nullif(v_eff->>'company_ref',''), nullif(v_eff->>'investor_name',''), nullif(v_eff->>'investor_nationality',''),
        nullif(v_eff->>'withdrawal_reason',''), v_notes, v_log);
    v_new_id := v_new_record_id::text;
  else
    insert into assumed_parcels (name, state, parcel_no, muqataa_no, muqataa_name, district, subdistrict, neighborhood,
        sector, owner, land_right, area_m2, value, geom, company_ref, annexation_plan, legal_status, notes, transfer_log)
    values (coalesce(nullif(v_eff->>'name',''), nullif(v_eff->>'title','')), 'assumed',
        v_parcel_no, nullif(v_eff->>'muqataa_no',''), nullif(v_eff->>'muqataa_name',''),
        nullif(v_eff->>'district',''), nullif(v_eff->>'subdistrict',''), nullif(v_eff->>'neighborhood',''),
        nullif(v_eff->>'sector',''), nullif(v_eff->>'owner',''), nullif(v_eff->>'land_right',''),
        (v_eff->>'area_m2')::numeric, coalesce((v_eff->>'value')::numeric, (v_eff->>'capital')::numeric), v_geom,
        nullif(v_eff->>'company_ref',''), nullif(v_eff->>'annexation_plan',''), nullif(v_eff->>'legal_status',''), v_notes, v_log)
    returning id::text into v_new_id;
  end if;

  if p_source_kind = 'assumed' and v_tgt_table in ('opportunities', 'licenses') and v_geom is not null then
    insert into parcel_geometry (parcel_no, muqataa_no, geom) values (v_parcel_no, nullif(v_eff->>'muqataa_no',''), v_geom)
    on conflict (parcel_no, muqataa_no) do update set geom = excluded.geom, updated_at = now();
  elsif p_source_kind in ('opportunity', 'license') and v_tgt_table = 'assumed_parcels' then
    delete from parcel_geometry where parcel_no = (v_src->>'parcel_no') and coalesce(muqataa_no, '') = coalesce(v_src->>'muqataa_no', '');
  end if;

  if p_source_kind = 'license' then
    update visits set parcel_ref = v_new_id where parcel_ref = p_source_id;
  end if;

  delete from parcel_insights pi where pi.kind = v_tgt_kind and pi.ref_id = v_new_id;
  update parcel_insights set kind = v_tgt_kind, ref_id = v_new_id, updated_at = now()
   where kind = p_source_kind and ref_id = p_source_id;

  update parcel_photos set kind = v_tgt_kind, ref_id = v_new_id
   where kind = p_source_kind and ref_id = p_source_id;

  if p_source_kind = 'assumed' then
    delete from assumed_parcels where id = p_source_id::uuid;
  else
    execute format('delete from %I where record_id = $1', v_src_table) using p_source_id::bigint;
  end if;

  return jsonb_build_object('kind', v_tgt_kind, 'id', v_new_id, 'parcel_no', v_parcel_no);
end;
$$;
