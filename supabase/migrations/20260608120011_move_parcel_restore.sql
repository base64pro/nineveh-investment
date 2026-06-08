-- م3.5+ · الاستعادة التلقائية عند النقل: الحقول المؤرشفة في transfer_log تعود لأعمدة الهدف القابلة للتحرير.
-- الآلية: v_restore = طيّ لقطات transfer_log (أحدث قيمة **غير فارغة** تفوز) · v_eff = المصدر الحالي فوق المستعاد.
-- فأي حقل فارغ في المصدر يُملأ من الأرشيف (إن وُجد) ويصبح قابلاً للتحرير في الهدف. القيمة الحالية تفوز دائماً.
set search_path = public, extensions;

create or replace function move_parcel(p_source_kind text, p_source_id text, p_target_state text)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_src jsonb;
  v_eff jsonb;
  v_restore jsonb;
  v_entry jsonb;
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

  -- نفس الجدول: تغيير حالة الرخصة فقط (لا نقل).
  if v_src_table = v_tgt_table then
    if v_tgt_table = 'licenses' then
      update licenses set status = p_target_state::license_status where record_id = p_source_id::bigint;
    end if;
    return jsonb_build_object('kind', v_tgt_kind, 'id', p_source_id);
  end if;

  -- قراءة المصدر كاملاً + هندسته
  if p_source_kind = 'assumed' then
    select to_jsonb(t) - 'geom', t.geom into v_src, v_geom from assumed_parcels t where t.id = p_source_id::uuid;
  else
    execute format('select to_jsonb(t) from %I t where t.record_id = $1', v_src_table) into v_src using p_source_id::bigint;
    select pg.geom into v_geom from parcel_geometry pg
      where pg.parcel_no = (v_src->>'parcel_no') and coalesce(pg.muqataa_no, '') = coalesce(v_src->>'muqataa_no', '') limit 1;
  end if;
  if v_src is null then raise exception 'المصدر غير موجود'; end if;

  -- طيّ الأرشيف: أحدث قيمة غير فارغة لكل حقل (jsonb_strip_nulls يمنع طمس قيمة بقيمة فارغة).
  v_restore := '{}'::jsonb;
  for v_entry in select je.value from jsonb_array_elements(coalesce(v_src->'transfer_log', '[]'::jsonb)) je loop
    v_restore := v_restore || jsonb_strip_nulls(coalesce(v_entry->'data', '{}'::jsonb));
  end loop;
  -- السجلّ الفعّال: المستعاد يملأ الفراغات، والقيمة الحالية (غير الفارغة) تفوز.
  v_eff := v_restore || jsonb_strip_nulls(v_src - 'transfer_log');

  -- سجلّ النقل: لقطة كاملة للسجلّ الحالي + السلسلة (صفر فقدان).
  v_log := coalesce(v_src->'transfer_log', '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object('from_kind', p_source_kind, 'moved_at', now(), 'data', (v_src - 'transfer_log')));
  v_notes := nullif(v_eff->>'notes', '');

  if v_tgt_table = 'opportunities' then
    select coalesce(max(record_id), 0) + 1 into v_new_record_id from opportunities;
    insert into opportunities (record_id, kind, title, sector, parcel_no, muqataa_no, muqataa_name, district, neighborhood,
        area_olk, area_m2, area_total_m2, area_factor_note, owner, zoning, notes, transfer_log)
    values (v_new_record_id, 'opportunity',
        coalesce(nullif(v_eff->>'title',''), nullif(v_eff->>'name','')), nullif(v_eff->>'sector',''),
        nullif(v_eff->>'parcel_no',''), nullif(v_eff->>'muqataa_no',''), nullif(v_eff->>'muqataa_name',''),
        nullif(v_eff->>'district',''), nullif(v_eff->>'neighborhood',''),
        (v_eff->>'area_olk')::numeric, (v_eff->>'area_m2')::numeric, (v_eff->>'area_total_m2')::numeric,
        nullif(v_eff->>'area_factor_note',''), nullif(v_eff->>'owner',''), nullif(v_eff->>'zoning',''), v_notes, v_log);
    v_new_id := v_new_record_id::text;

  elsif v_tgt_table = 'licenses' then
    select coalesce(max(record_id), 0) + 1 into v_new_record_id from licenses;
    insert into licenses (record_id, kind, status, license_number, title, sector, parcel_no, muqataa_no, muqataa_name, district, subdistrict, neighborhood,
        area_olk, area_m2, area_total_m2, area_factor_note, owner, land_right, zoning, capital, lease_rate, term_years,
        company_ref, investor_name, investor_nationality, withdrawal_reason, notes, transfer_log)
    values (v_new_record_id, 'license', p_target_state::license_status, nullif(v_eff->>'license_number',''),
        coalesce(nullif(v_eff->>'title',''), nullif(v_eff->>'name','')), nullif(v_eff->>'sector',''),
        nullif(v_eff->>'parcel_no',''), nullif(v_eff->>'muqataa_no',''), nullif(v_eff->>'muqataa_name',''),
        nullif(v_eff->>'district',''), nullif(v_eff->>'subdistrict',''), nullif(v_eff->>'neighborhood',''),
        (v_eff->>'area_olk')::numeric, (v_eff->>'area_m2')::numeric, (v_eff->>'area_total_m2')::numeric,
        nullif(v_eff->>'area_factor_note',''), nullif(v_eff->>'owner',''), nullif(v_eff->>'land_right',''), nullif(v_eff->>'zoning',''),
        coalesce((v_eff->>'capital')::numeric, (v_eff->>'value')::numeric), (v_eff->>'lease_rate')::numeric, (v_eff->>'term_years')::numeric,
        nullif(v_eff->>'company_ref',''), nullif(v_eff->>'investor_name',''), nullif(v_eff->>'investor_nationality',''),
        nullif(v_eff->>'withdrawal_reason',''), v_notes, v_log);
    v_new_id := v_new_record_id::text;

  else -- assumed_parcels
    insert into assumed_parcels (name, state, parcel_no, muqataa_no, muqataa_name, district, subdistrict, neighborhood,
        sector, owner, land_right, area_m2, value, geom, company_ref, annexation_plan, legal_status, notes, transfer_log)
    values (coalesce(nullif(v_eff->>'name',''), nullif(v_eff->>'title','')), 'assumed',
        nullif(v_eff->>'parcel_no',''), nullif(v_eff->>'muqataa_no',''), nullif(v_eff->>'muqataa_name',''),
        nullif(v_eff->>'district',''), nullif(v_eff->>'subdistrict',''), nullif(v_eff->>'neighborhood',''),
        nullif(v_eff->>'sector',''), nullif(v_eff->>'owner',''), nullif(v_eff->>'land_right',''),
        (v_eff->>'area_m2')::numeric, coalesce((v_eff->>'value')::numeric, (v_eff->>'capital')::numeric), v_geom,
        nullif(v_eff->>'company_ref',''), nullif(v_eff->>'annexation_plan',''), nullif(v_eff->>'legal_status',''), v_notes, v_log)
    returning id::text into v_new_id;
  end if;

  -- نقل الهندسة
  if p_source_kind = 'assumed' and v_tgt_table in ('opportunities', 'licenses')
     and v_geom is not null and nullif(v_eff->>'parcel_no','') is not null then
    insert into parcel_geometry (parcel_no, muqataa_no, geom) values (v_eff->>'parcel_no', nullif(v_eff->>'muqataa_no',''), v_geom);
  elsif p_source_kind in ('opportunity', 'license') and v_tgt_table = 'assumed_parcels' then
    delete from parcel_geometry where parcel_no = (v_src->>'parcel_no') and coalesce(muqataa_no, '') = coalesce(v_src->>'muqataa_no', '');
  end if;

  -- نقل الزيارات
  if p_source_kind = 'license' then
    update visits set parcel_ref = v_new_id where parcel_ref = p_source_id;
  end if;

  -- حذف المصدر
  if p_source_kind = 'assumed' then
    delete from assumed_parcels where id = p_source_id::uuid;
  else
    execute format('delete from %I where record_id = $1', v_src_table) using p_source_id::bigint;
  end if;

  return jsonb_build_object('kind', v_tgt_kind, 'id', v_new_id);
end;
$$;

comment on function move_parcel(text, text, text) is 'م3.5 · نقل القطعة + لقطة كاملة (transfer_log، صفر فقدان) + استعادة تلقائية للحقول المؤرشفة عند النقل لنوع أغنى.';
grant execute on function move_parcel(text, text, text) to authenticated;
