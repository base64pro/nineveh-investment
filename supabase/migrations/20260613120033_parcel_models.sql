-- م9.1 · مجسّمات القطع ثلاثية الأبعاد (الخارطة الاستثمارية):
-- (أ) دلو تخزين خاص parcel-models (نماذج glb/gltf/stl — روابط موقّعة للعرض · الرفع/الحذف للمدير)
-- (ب) جدول parcel_models (نموذج لكل قطعة بمفتاح النوع+المعرّف كنمط parcel_photos/parcel_insights)
-- (ج) إضافة الجدول لمنشور الزمن الحقيقي
-- (د) move_parcel v6: ترحيل المجسّم مع القطعة عند النقل (مضاف لسلسلة الصور/الرؤى)
-- إضافي بالكامل: لا مساس بأي بيانات/جداول قائمة. الأدوار مفروضة بـ is_admin() (RLS + التخزين).
set search_path = public, extensions;

-- (أ) الدلو + سياساته (قراءة للمصادَقين · رفع/حذف للمدير)
insert into storage.buckets (id, name, public)
values ('parcel-models', 'parcel-models', false)
on conflict (id) do nothing;

drop policy if exists "pm_select" on storage.objects;
drop policy if exists "pm_insert" on storage.objects;
drop policy if exists "pm_delete" on storage.objects;
create policy "pm_select" on storage.objects for select to authenticated using (bucket_id = 'parcel-models');
create policy "pm_insert" on storage.objects for insert to authenticated with check (bucket_id = 'parcel-models' and public.is_admin());
create policy "pm_delete" on storage.objects for delete to authenticated using (bucket_id = 'parcel-models' and public.is_admin());

-- (ب) جدول المجسّمات (transform = {scale, rotationDeg, elevationM, anchorOverride?})
create table if not exists parcel_models (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('opportunity', 'license', 'assumed')),
  ref_id text not null,
  storage_path text not null,
  format text not null default 'glb' check (format in ('glb', 'gltf', 'stl')),
  transform jsonb not null default '{}'::jsonb,
  title text,
  is_conceptual boolean not null default true,
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_parcel_models_ref on parcel_models (kind, ref_id);

alter table parcel_models enable row level security;
drop policy if exists parcel_models_select on parcel_models;
drop policy if exists parcel_models_admin on parcel_models;
-- قراءة للجميع المصادَقين · الكتابة (إدراج/تعديل/حذف) للمدير فقط
create policy parcel_models_select on parcel_models for select to authenticated using (true);
create policy parcel_models_admin on parcel_models for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on parcel_models to authenticated;
grant all on parcel_models to service_role;

comment on table parcel_models is 'م9 · نماذج ثلاثية الأبعاد للقطع (مسار التخزين + تحويل فضائي + بيانات وصفية) — الرفع/التحرير للمدير';

-- (ج) الزمن الحقيقي (إبطال فوري عبر الأجهزة) — إضافة آمنة idempotent
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'parcel_models'
  ) then
    alter publication supabase_realtime add table public.parcel_models;
  end if;
end $$;

-- (د) النقل يرحّل المجسّم أيضاً (نفس نمط parcel_insights/parcel_photos) — v6: سطر cascade واحد مضاف
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

  -- م9.1: ترحيل المجسّم 3D مع القطعة (لا يُفقَد بالنقل)
  update parcel_models set kind = v_tgt_kind, ref_id = v_new_id, updated_at = now()
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
