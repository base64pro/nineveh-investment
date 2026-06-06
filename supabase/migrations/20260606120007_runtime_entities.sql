-- م0 · كيانات وقت التشغيل (§ج.8/5-9) — جداول فارغة يملؤها المستخدم
set search_path = public, extensions;

-- 5) المعيار (§ج.8/5)
create table criteria (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  domain      text check (domain in ('company', 'opportunity', 'architecture', 'competitive')),
  purpose     text,
  items       jsonb not null default '[]'::jsonb,   -- [{description, basis, weight, support_indicator}]
  status      text not null default 'active' check (status in ('active', 'disabled')),
  parcel_ref  text,                                  -- اختياري: معيار مرتبط بقطعة (وإلا فمكتبة)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 6) الاستشارة (§ج.8/6)
create table consultations (
  id            uuid primary key default gen_random_uuid(),
  title         text,
  consulted_at  timestamptz not null default now(),
  inputs        jsonb,                               -- المعطيات/السؤال (استمارة)
  question      text,                                -- سؤال حرّ
  answer        text,                                -- الإجابة (باستشهاد)
  excerpt       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 7) الزيارة (§ج.8/7) — قطع قيد الإنجاز/منجزة · حتى 3 صور
create table visits (
  id          uuid primary key default gen_random_uuid(),
  parcel_ref  text not null,                         -- القطعة/الرخصة المرتبطة (إحالة رخوة)
  visit_date  date not null,
  visit_type  text,
  staff       text,
  notes       text,
  photos      jsonb not null default '[]'::jsonb
                check (jsonb_array_length(photos) <= 3),  -- حدّ أقصى 3 صور
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 8) عنصر الخريطة المحرَّر (§ج.8/8)
create table map_elements (
  id            uuid primary key default gen_random_uuid(),
  element_type  text check (element_type in ('landmark', 'building', 'street', 'point', 'label')),
  name          text,
  geom          geometry(Geometry, 4326),
  label         text,
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 9) القطعة المفترضة (§ج.8/9) — الحالة الافتراضية: مفترضة
create table assumed_parcels (
  id              uuid primary key default gen_random_uuid(),  -- المعرّف الداخلي (آلي)
  parcel_no       text,
  muqataa_no      text,
  muqataa_name    text,
  district        text,        -- القضاء (استنتاج مكاني)
  subdistrict     text,        -- الناحية
  neighborhood    text,        -- الحي
  sector          text,
  owner           text,
  land_right      text,
  state           parcel_state not null default 'assumed',
  area_m2         numeric,     -- لا تُحسب من المضلّع (قرار §هـ.4)
  value           numeric,
  geom            geometry(MultiPolygon, 4326),  -- يرسمها المستخدم
  annexation_plan text,        -- خطة الضمّ والوضع القانوني
  legal_status    text,
  company_ref     text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- مُحفّزات updated_at لكيانات التشغيل
create trigger trg_criteria_updated      before update on criteria        for each row execute function set_updated_at();
create trigger trg_consultations_updated before update on consultations   for each row execute function set_updated_at();
create trigger trg_visits_updated        before update on visits          for each row execute function set_updated_at();
create trigger trg_map_elements_updated  before update on map_elements    for each row execute function set_updated_at();
create trigger trg_assumed_updated       before update on assumed_parcels for each row execute function set_updated_at();
