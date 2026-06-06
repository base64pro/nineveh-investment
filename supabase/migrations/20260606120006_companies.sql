-- م0 · الشركات (§ج.8/3 · قالب 23 حقلاً) — 491 سجلاً
-- مفاتيح الملف العربية ← أعمدة snake_case إنجليزية (التسميات العربية في طبقة العرض §ح).
set search_path = public, extensions;

create table companies (
  id                    text primary key,           -- معرّف داخلي (C0001)
  name                  text not null,              -- اسم الشركة
  company_type          text,                       -- نوع الشركة
  sector                text,                       -- القطاع
  activity              text,                       -- النشاط
  registration_no       text,                       -- رقم القيد
  file_no               text,                       -- رقم الإضبارة
  capital_iqd           numeric,                    -- رأس المال بالدينار
  capital_usd           numeric,                    -- رأس المال بالدولار
  is_excluded           boolean not null default false, -- مستثناة (قانوناً)
  meets_250k_threshold  boolean,                    -- تستوفي عتبة 250 ألف (قد تكون مجهولة)
  manager               text,                       -- المدير
  shareholders          jsonb not null default '[]'::jsonb, -- المساهمون والنسب
  phone                 text,                       -- الهاتف
  email                 text,                       -- البريد الإلكتروني
  website               text,                       -- الموقع الإلكتروني
  governorate           text,                       -- المحافظة
  address               text,                       -- العنوان
  source                jsonb not null default '[]'::jsonb, -- المصدر
  matched_opportunities jsonb not null default '[]'::jsonb, -- الفرص المطابقة
  notes                 text,                       -- ملاحظات
  updated_at_label      text,                       -- تاريخ الإضافة/التعديل (نصّ المصدر، قد يحوي ملاحظة)
  projects              jsonb not null default '[]'::jsonb, -- سجلّ المشاريع/الخبرة (الحقل 23)
  created_at            timestamptz not null default now()
);
comment on table companies is 'بنك الشركات المؤهّلة (§ج.8/3). الحقل 23 (projects) يُثرى لاحقاً (CRUD).';
comment on column companies.meets_250k_threshold is 'null = غير معروف (لا يُفترَض — §ح.4)';
