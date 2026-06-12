-- م7.4 · صور المشروع والزيارات (§ج.8/7 «حتى 3 صور» + إثراء معتمد):
-- (أ) دلو تخزين خاص parcel-photos (وصول للمصادَقين عبر RLS — روابط موقّعة للعرض)
-- (ب) جدول parcel_photos (صور المشروع لكل قطعة، بمفتاح النوع+المعرّف كنمط parcel_insights)
-- (ج) move_parcel v4: ترحيل الصور مع القطعة عند النقل
set search_path = public, extensions;

-- (أ) الدلو + سياساته
insert into storage.buckets (id, name, public)
values ('parcel-photos', 'parcel-photos', false)
on conflict (id) do nothing;

drop policy if exists "pp_select" on storage.objects;
drop policy if exists "pp_insert" on storage.objects;
drop policy if exists "pp_delete" on storage.objects;
create policy "pp_select" on storage.objects for select to authenticated using (bucket_id = 'parcel-photos');
create policy "pp_insert" on storage.objects for insert to authenticated with check (bucket_id = 'parcel-photos');
create policy "pp_delete" on storage.objects for delete to authenticated using (bucket_id = 'parcel-photos');

-- (ب) صور المشروع
create table if not exists parcel_photos (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('opportunity', 'license', 'assumed')),
  ref_id text not null,
  path text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_parcel_photos_ref on parcel_photos (kind, ref_id);
alter table parcel_photos enable row level security;
drop policy if exists parcel_photos_all on parcel_photos;
create policy parcel_photos_all on parcel_photos for all to authenticated using (true) with check (true);
grant select, insert, update, delete on parcel_photos to authenticated;
grant all on parcel_photos to service_role;

-- (ج) النقل يرحّل الصور أيضاً (نفس نمط parcel_insights)
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
  v_parcel_no text;
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

  -- طيّ الأرشيف (أحدث قيمة غير فارغة تفوز) + السجلّ الفعّال (الحالي فوق المستعاد)
  v_restore := '{}'::jsonb;
  for v_entry in select je.value from jsonb_array_elements(coalesce(v_src->'transfer_log', '[]'::jsonb)) je loop
    v_restore := v_restore || jsonb_strip_nulls(coalesce(v_entry->'data', '{}'::jsonb));
  end loop;
  v_eff := v_restore || jsonb_strip_nulls(v_src - 'transfer_log');

  v_log := coalesce(v_src->'transfer_log', '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object('from_kind', p_source_kind, 'moved_at', now(), 'data', (v_src - 'transfer_log')));
  v_notes := nullif(v_eff->>'notes', '');

  -- رقم السجلّ الجديد (فرص/رخص) + رقم القطعة الفعّال (توليد مؤقّت لحفظ رسم المفترضة بلا رقم)
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
    insert into opportunities (record_id, kind, title, sector, parcel_no, muqataa_no, muqataa_name, district, neighborhood,
        area_olk, area_m2, area_total_m2, area_factor_note, owner, zoning, notes, transfer_log)
    values (v_new_record_id, 'opportunity',
        coalesce(nullif(v_eff->>'title',''), nullif(v_eff->>'name','')), nullif(v_eff->>'sector',''),
        v_parcel_no, nullif(v_eff->>'muqataa_no',''), nullif(v_eff->>'muqataa_name',''),
        nullif(v_eff->>'district',''), nullif(v_eff->>'neighborhood',''),
        (v_eff->>'area_olk')::numeric, (v_eff->>'area_m2')::numeric, (v_eff->>'area_total_m2')::numeric,
        nullif(v_eff->>'area_factor_note',''), nullif(v_eff->>'owner',''), nullif(v_eff->>'zoning',''), v_notes, v_log);
    v_new_id := v_new_record_id::text;

  elsif v_tgt_table = 'licenses' then
    insert into licenses (record_id, kind, status, license_number, title, sector, parcel_no, muqataa_no, muqataa_name, district, subdistrict, neighborhood,
        area_olk, area_m2, area_total_m2, area_factor_note, owner, land_right, zoning, capital, lease_rate, term_years,
        company_ref, investor_name, investor_nationality, withdrawal_reason, notes, transfer_log)
    values (v_new_record_id, 'license', p_target_state::license_status, nullif(v_eff->>'license_number',''),
        coalesce(nullif(v_eff->>'title',''), nullif(v_eff->>'name','')), nullif(v_eff->>'sector',''),
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

  -- نقل الهندسة (الرسم لا يُفقَد أبداً)
  if p_source_kind = 'assumed' and v_tgt_table in ('opportunities', 'licenses') and v_geom is not null then
    insert into parcel_geometry (parcel_no, muqataa_no, geom) values (v_parcel_no, nullif(v_eff->>'muqataa_no',''), v_geom);
  elsif p_source_kind in ('opportunity', 'license') and v_tgt_table = 'assumed_parcels' then
    delete from parcel_geometry where parcel_no = (v_src->>'parcel_no') and coalesce(muqataa_no, '') = coalesce(v_src->>'muqataa_no', '');
  end if;

  if p_source_kind = 'license' then
    update visits set parcel_ref = v_new_id where parcel_ref = p_source_id;
  end if;

  -- ترحيل نتائج الذكاء المثبّتة (§هـ.4) مع القطعة — التوصيات/المعايير لا تُفقَد بالنقل
  delete from parcel_insights pi where pi.kind = v_tgt_kind and pi.ref_id = v_new_id;
  update parcel_insights set kind = v_tgt_kind, ref_id = v_new_id, updated_at = now()
   where kind = p_source_kind and ref_id = p_source_id;

  -- ترحيل صور المشروع مع القطعة (م7.4)
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

grant execute on function move_parcel(text, text, text) to authenticated;
