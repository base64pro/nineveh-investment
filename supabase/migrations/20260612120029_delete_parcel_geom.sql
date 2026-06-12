-- م7.8 · «حذف الرسمة من الخريطة» (§هـ.4 إدارة الجغرافيا: فكّ ارتباط القطعة من خريطتها):
-- فرصة/رخصة ← حذف صف الهندسة من parcel_geometry (البيانات تبقى سليمة في جدولها)؛
-- مفترضة ← تصفير geom في سجلها (يبقى السجل في «تصميم فرصة» ويختفي من الخريطة).
set search_path = public, extensions;

create or replace function delete_parcel_geom(p_kind text, p_ref_id text)
returns void
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  if p_kind = 'assumed' then
    update assumed_parcels set geom = null, updated_at = now() where id = p_ref_id::uuid;
  else
    delete from parcel_geometry where id = p_ref_id::uuid;
  end if;
  if not found then
    raise exception 'الرسمة غير موجودة';
  end if;
end;
$$;

comment on function delete_parcel_geom(text, text) is 'م7.8 · إزالة رسمة قطعة من الخريطة (فك الارتباط §هـ.4) — البيانات لا تُمسّ.';
grant execute on function delete_parcel_geom(text, text) to authenticated;
