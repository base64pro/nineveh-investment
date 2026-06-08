-- م2.2 · خيارات الحقول المعرّفة من المستخدم (قوائم منسدلة قابلة للتوسعة)
set search_path = public, extensions;

create table field_options (
  id          uuid primary key default gen_random_uuid(),
  field_key   text not null,
  value       text not null,
  created_at  timestamptz not null default now(),
  unique (field_key, value)
);
comment on table field_options is 'خيارات منسدلة يعرّفها المستخدم لكل حقل (field_key)';

alter table field_options enable row level security;
create policy "authenticated_all_field_options" on field_options
  for all to authenticated using (true) with check (true);

-- Realtime
do $$ begin
  begin
    alter publication supabase_realtime add table public.field_options;
  exception when duplicate_object then null; end;
end $$;
