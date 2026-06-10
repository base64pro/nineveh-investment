set search_path = public, extensions;

-- م6.4 · تثبيت نتائج الذكاء للقطعة (§هـ.4): التوصيات + مسودة المعايير «تُثبَّت كبيانات للقطعة،
-- ثابتة لا تتغيّر إلا بإعادة الطلب» — فارغة حتى أوّل طلب · زرّ مسح يزيلها.
create table if not exists parcel_insights (
  kind text not null check (kind in ('opportunity', 'license', 'assumed')),
  ref_id text not null,
  recommendations text,
  recommendations_at timestamptz,
  criteria jsonb,
  criteria_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (kind, ref_id)
);

alter table parcel_insights enable row level security;
drop policy if exists parcel_insights_all on parcel_insights;
create policy parcel_insights_all on parcel_insights for all to authenticated using (true) with check (true);
grant select, insert, update, delete on parcel_insights to authenticated;
grant all on parcel_insights to service_role;

comment on table parcel_insights is 'م6.4 · نتائج الذكاء المثبّتة للقطعة (توصيات 🟩 + مسودة معايير) — اجتهاد غير مُلزِم.';
