set search_path = public, extensions;

-- مراجعة م6 · إصلاح 1: افتراضي قاعدة لـis_excluded — يتيح upsert جزئياً يصون قيمة الشركة المستثناة.
alter table companies alter column is_excluded set default false;

-- مراجعة م6 · إصلاح 2: «إجمالي المساحات» بلا عدّ مزدوج — فرصة مرتبطة برخصة على نفس القطعة
-- (parcel_no + muqataa_no) تُحسب مساحتها مرّة واحدة (الرخصة هي الفعلية).
create or replace function dashboard_stats()
returns jsonb language sql stable security invoker as $$
  select jsonb_build_object(
    'announced', (select count(*) from opportunities),
    'licenses', (select count(*) from licenses),
    'lic_in_progress', (select count(*) from licenses where status = 'in-progress'),
    'lic_completed', (select count(*) from licenses where status = 'completed'),
    'lic_withdrawn', (select count(*) from licenses where status = 'withdrawn'),
    'assumed', (select count(*) from assumed_parcels),
    'companies', (select count(*) from companies),
    'total_area_m2',
      coalesce((
        select sum(o.area_total_m2) from opportunities o
         where o.parcel_no is null
            or not exists (
              select 1 from licenses l
               where l.parcel_no = o.parcel_no
                 and coalesce(l.muqataa_no, '') = coalesce(o.muqataa_no, ''))
      ), 0)
      + coalesce((select sum(area_total_m2) from licenses), 0)
      + coalesce((select sum(area_m2) from assumed_parcels), 0)
  );
$$;
comment on function dashboard_stats() is 'م5.1 · إحصاءات الهيدبار اللحظية (حتمية) — مساحة القطعة المشتركة فرصة/رخصة تُحسب مرّة.';
grant execute on function dashboard_stats() to authenticated;
