-- م8.1 · أدوار المستخدمين (RBAC): مدير (admin) كامل الصلاحيات + مستخدم ثانٍ مقيَّد (viewer).
-- الفرض الحقيقي على مستوى القاعدة (RLS) — الواجهة مجرّد إخفاء. كل الـRPCs المطفِّرة security invoker
-- ⇒ يكفي ضبط RLS بالجداول لمنع viewer من الكتابة عبرها (الرسم/النقل/التحرير).
set search_path = public, extensions;

-- 1) جدول الأدوار: من يكتب فيه = service_role فقط (يُدار من أكشن الإعدادات بدور service).
create table if not exists app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);
alter table app_users enable row level security;
drop policy if exists app_users_sel on app_users;
create policy app_users_sel on app_users for select to authenticated using (true); -- قراءة الدور فقط
-- لا سياسات كتابة للمصادَقين ⇒ مرفوضة افتراضياً؛ service_role يتجاوز RLS.
grant select on app_users to authenticated;
grant all on app_users to service_role;

-- 2) دالّة الدور — security definer كي تُستعمَل داخل سياسات بقية الجداول بأمان.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from app_users where user_id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 3) بذر المدير: أقدم مستخدم حاليّ (= المدير العام؛ مستخدمو الاختبار حُذفوا) ← admin.
insert into app_users (user_id, username, role)
select id, coalesce(email, 'admin'), 'admin' from auth.users order by created_at asc limit 1
on conflict (user_id) do update set role = 'admin';

-- 4) إعادة كتابة RLS:
--    المجموعة (أ) — كتابة للمدير فقط، قراءة للجميع (الجداول السيادية + الرسم + الصور).
do $$
declare
  t text;
  a_tabs text[] := array[
    'legal_documents', 'legal', 'opportunities', 'licenses', 'companies',
    'visits', 'map_elements', 'assumed_parcels', 'parcel_geometry', 'parcel_photos'
  ];
begin
  foreach t in array a_tabs loop
    execute format('drop policy if exists "authenticated_all_%1$s" on public.%1$I;', t);
    execute format('drop policy if exists "%1$s_all" on public.%1$I;', t);
    execute format('create policy "%1$s_sel" on public.%1$I for select to authenticated using (true);', t);
    execute format('create policy "%1$s_admin" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin());', t);
  end loop;
end $$;

--    المجموعة (ب) — المصادَق يضيف (insert)، المدير وحده يعدّل/يحذف (المعايير/الاستشارات/قيم القوائم).
do $$
declare
  t text;
  b_tabs text[] := array['criteria', 'consultations', 'field_options'];
begin
  foreach t in array b_tabs loop
    execute format('drop policy if exists "authenticated_all_%1$s" on public.%1$I;', t);
    execute format('create policy "%1$s_sel" on public.%1$I for select to authenticated using (true);', t);
    execute format('create policy "%1$s_ins" on public.%1$I for insert to authenticated with check (true);', t);
    execute format('create policy "%1$s_upd" on public.%1$I for update to authenticated using (public.is_admin()) with check (public.is_admin());', t);
    execute format('create policy "%1$s_del" on public.%1$I for delete to authenticated using (public.is_admin());', t);
  end loop;
end $$;

--    نتائج الذكاء المثبّتة (توليد التوصيات/المعايير): المصادَق يُدرِج/يحدّث، المدير وحده يحذف.
drop policy if exists parcel_insights_all on parcel_insights;
create policy parcel_insights_sel on parcel_insights for select to authenticated using (true);
create policy parcel_insights_ins on parcel_insights for insert to authenticated with check (true);
create policy parcel_insights_upd on parcel_insights for update to authenticated using (true) with check (true);
create policy parcel_insights_del on parcel_insights for delete to authenticated using (public.is_admin());

--    الإعدادات: تعديل للمدير فقط (الثاني لا يصل القسم أصلاً — دفاع بالعمق).
drop policy if exists settings_update on settings;
create policy settings_update on settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 5) رفع/حذف صور المشروع في التخزين (دلو parcel-photos): للمدير فقط (القراءة للجميع).
drop policy if exists pp_insert on storage.objects;
create policy pp_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'parcel-photos' and public.is_admin());
drop policy if exists pp_delete on storage.objects;
create policy pp_delete on storage.objects for delete to authenticated
  using (bucket_id = 'parcel-photos' and public.is_admin());

comment on table app_users is 'م8.1 · أدوار المستخدمين (admin/viewer) — يُدار بدور service من الإعدادات.';
comment on function public.is_admin() is 'م8.1 · هل المستخدم الحالي مدير؟ (يُستعمَل في سياسات RLS).';
