set search_path = public, extensions;

-- م5.4 · جدول الإعدادات (صفّ واحد · غير سرّي) — المستخدم الواحد (§هـ.5).
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  theme text not null default 'dark',                  -- light | dark | system
  density text not null default 'comfortable',         -- comfortable | compact
  font_scale text not null default 'md',               -- sm | md | lg
  default_base text not null default 'dark',           -- dark | light | satellite
  start_layers jsonb not null default '{"boundaries":true,"parcels":true}'::jsonb,
  web_search_enabled boolean not null default false,
  ai_model text not null default 'claude-opus-4-8',
  pdf_org_name text,
  pdf_header text,
  pdf_footer text,
  default_export text not null default 'pdf',           -- pdf | csv
  updated_at timestamptz not null default now()
);
insert into settings (id) values (1) on conflict (id) do nothing;
alter table settings enable row level security;
drop policy if exists settings_select on settings;
drop policy if exists settings_update on settings;
create policy settings_select on settings for select to authenticated using (true);
create policy settings_update on settings for update to authenticated using (true) with check (true);
grant select, update on settings to authenticated;
grant all on settings to service_role;

-- م5.4 · جدول المفاتيح السرّية — **RLS يمنع كل وصول للعميل**؛ يصله دور service خادمياً فقط (القاعدة #6).
create table if not exists app_secrets (
  provider text primary key,                            -- anthropic | voyage | ...
  api_key text not null,
  updated_at timestamptz not null default now()
);
alter table app_secrets enable row level security;
-- لا سياسات للمصادَقين/المجهول ← مرفوض افتراضياً. سحب الصلاحيات تأكيداً.
revoke all on app_secrets from authenticated, anon;
grant all on app_secrets to service_role;

comment on table app_secrets is 'م5.4 · مفاتيح API — لا تُقرأ للعميل أبداً (RLS deny؛ دور service خادمي فقط).';
