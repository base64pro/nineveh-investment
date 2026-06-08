-- م2.4 · RPC لربط هندسة (مضلّع GeoJSON) بقطعة بياناتية موجودة (فرصة/رخصة) عبر parcel_geometry.
set search_path = public, extensions;

create or replace function create_parcel_geometry(
  p_geom jsonb,
  p_parcel_no text,
  p_muqataa_no text default null
) returns void
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  insert into parcel_geometry (geom, parcel_no, muqataa_no)
  values (st_multi(st_setsrid(st_geomfromgeojson(p_geom::text), 4326)), p_parcel_no, p_muqataa_no)
  on conflict (parcel_no, muqataa_no) do update
    set geom = excluded.geom, updated_at = now();
end;
$$;

grant execute on function create_parcel_geometry(jsonb, text, text) to authenticated;
comment on function create_parcel_geometry is 'ربط هندسة GeoJSON بقطعة (parcel_no+muqataa_no) — أداة الرسم/التعريف §هـ.4.';
