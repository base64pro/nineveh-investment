-- م2.2 · إضافة حقل الناحية للرخص (تصفية متقدمة) — منسدلة نواحي نينوى من الخريطة + تعريف يدوي
set search_path = public, extensions;

alter table licenses add column if not exists subdistrict text;
comment on column licenses.subdistrict is 'الناحية — نواحي نينوى (الخريطة) ∪ المتراكم ∪ تعريف يدوي (لا تأليف)';
