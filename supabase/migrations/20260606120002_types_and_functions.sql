-- م0 · الأنواع والدوال المشتركة (§ج.8)
set search_path = public, extensions;

-- حالات الرخصة الثلاث (قيد الإنجاز/منجزة/مسحوبة)
do $$ begin
  create type license_status as enum ('in-progress', 'completed', 'withdrawn');
exception when duplicate_object then null; end $$;

-- الحالات الخمس للقطعة على الخريطة (عرض موحّد §ج.8)
do $$ begin
  create type parcel_state as enum ('announced', 'in-progress', 'completed', 'withdrawn', 'assumed');
exception when duplicate_object then null; end $$;

-- تحديث آلي لعمود updated_at في الكيانات المُدارة وقت التشغيل
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
