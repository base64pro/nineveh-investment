-- م0 · طبقة الهندسة المنفصلة (§ج.8) — تُربَط بمعرّف القطعة؛ coordinates فارغة حالياً
-- يرسمها المستخدم ويربطها بنفسه بعد التشغيل (أداة الرسم — §ج.10).
set search_path = public, extensions;

create table parcel_geometry (
  id          uuid primary key default gen_random_uuid(),
  parcel_no   text not null,
  muqataa_no  text,
  geom        geometry(MultiPolygon, 4326),  -- فارغة الآن، النظام مهيّأ لاستقبالها
  source      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (parcel_no, muqataa_no)
);
comment on table parcel_geometry is 'هندسة القطع (طبقة منفصلة §ج.8). المساحة من بيانات المصدر لا من المضلّع.';

create trigger trg_parcel_geometry_updated
  before update on parcel_geometry for each row execute function set_updated_at();
