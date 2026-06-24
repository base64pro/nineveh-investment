-- م9.7.8 · تحكّم المستخدم بتوجيه المجسّم وأبعاده: تدوير 360° + طول/عرض/ارتفاع يدويّ (اختياريّ).
-- إضافيّ بالكامل (أعمدة nullable + افتراض) — لا مساس بالقائم. القيم الفارغة = اشتقاق تلقائيّ من البصمة.
set search_path = public, extensions;

alter table parcel_parametric_models
  add column if not exists rotation_deg int not null default 0,
  add column if not exists width_m numeric,
  add column if not exists depth_m numeric,
  add column if not exists height_m numeric;
