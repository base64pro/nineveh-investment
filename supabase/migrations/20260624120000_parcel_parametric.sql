-- م9.7.1ب · إعداد النموذج البارامتري لكل قطعة (نوع المجسّم + العدد + التوزيع) — يختاره المدير من المنسدلة.
-- يُعرَض هذا النموذج الإجرائيّ عندما لا يُرفع مجسّم glb/stl للقطعة. إضافيّ بالكامل (لا مساس بالقائم). الأدوار بـ is_admin().
set search_path = public, extensions;

create table if not exists parcel_parametric_models (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('opportunity', 'license', 'assumed')),
  ref_id text not null,
  model_kind text not null default 'tower' check (model_kind in ('tower', 'mall', 'hotel')),
  count int not null default 1 check (count between 1 and 24),
  distribution text not null default 'grid' check (distribution in ('grid', 'row', 'scatter')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, ref_id)
);
create index if not exists idx_parcel_parametric_ref on parcel_parametric_models (kind, ref_id);

alter table parcel_parametric_models enable row level security;
drop policy if exists ppm_select on parcel_parametric_models;
drop policy if exists ppm_admin on parcel_parametric_models;
-- قراءة للجميع المصادَقين · الكتابة (إدراج/تعديل/حذف) للمدير فقط
create policy ppm_select on parcel_parametric_models for select to authenticated using (true);
create policy ppm_admin on parcel_parametric_models for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on parcel_parametric_models to authenticated;
grant all on parcel_parametric_models to service_role;

comment on table parcel_parametric_models is 'م9.7 · إعداد النموذج البارامتري للقطعة (نوع/عدد/توزيع) — يُعرَض حين لا مجسّم مرفوع · الكتابة للمدير';

-- الزمن الحقيقي (إبطال فوري عبر الأجهزة) — إضافة آمنة idempotent
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'parcel_parametric_models'
  ) then
    alter publication supabase_realtime add table public.parcel_parametric_models;
  end if;
end $$;
