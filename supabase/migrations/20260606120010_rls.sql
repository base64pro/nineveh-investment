-- م0 · أمن مستوى الصفّ (RLS) — نظام أحادي المستخدم
-- كل الجداول: RLS مفعّل، الوصول للمستخدم المُصادَق فقط (anon ممنوع). service_role يتجاوز RLS.
set search_path = public, extensions;

do $$
declare
  t text;
  tables text[] := array[
    'legal_documents', 'legal', 'opportunities', 'licenses', 'companies',
    'criteria', 'consultations', 'visits', 'map_elements', 'assumed_parcels',
    'parcel_geometry'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security;', t);
    execute format($f$
      create policy "authenticated_all_%1$s" on %1$I
        for all to authenticated using (true) with check (true);
    $f$, t);
  end loop;
end $$;
