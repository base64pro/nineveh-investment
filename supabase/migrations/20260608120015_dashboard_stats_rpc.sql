-- م5.1 · إحصاءات الداشبورد (الهيدبار) — حتمية بالكامل من البيانات الفعلية (لا ذكاء). استعلام واحد.
set search_path = public, extensions;

create or replace function dashboard_stats()
returns jsonb
language sql
stable
security invoker
as $$
  select jsonb_build_object(
    'announced', (select count(*) from opportunities),
    'licenses', (select count(*) from licenses),
    'lic_in_progress', (select count(*) from licenses where status = 'in-progress'),
    'lic_completed', (select count(*) from licenses where status = 'completed'),
    'lic_withdrawn', (select count(*) from licenses where status = 'withdrawn'),
    'assumed', (select count(*) from assumed_parcels),
    'companies', (select count(*) from companies),
    'total_area_m2',
      coalesce((select sum(area_total_m2) from opportunities), 0)
      + coalesce((select sum(area_total_m2) from licenses), 0)
      + coalesce((select sum(area_m2) from assumed_parcels), 0)
  );
$$;

comment on function dashboard_stats() is 'م5.1 · إحصاءات الهيدبار اللحظية (حتمية).';
grant execute on function dashboard_stats() to authenticated;
