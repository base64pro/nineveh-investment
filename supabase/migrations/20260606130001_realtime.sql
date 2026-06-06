-- م2.1 · تفعيل Realtime (§ج.4 · §ز.6): مصدر واحد ينعكس فوراً في كل الأقسام والخريطة.
-- يضيف الجداول إلى منشور supabase_realtime (RLS يبقى نافذاً على البثّ).
set search_path = public, extensions;

do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare
  t text;
  tables text[] := array[
    'opportunities', 'licenses', 'companies',
    'criteria', 'consultations', 'visits', 'map_elements', 'assumed_parcels',
    'parcel_geometry', 'legal', 'legal_documents'
  ];
begin
  foreach t in array tables loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null; -- مضاف سابقاً
    end;
  end loop;
end $$;
