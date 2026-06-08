-- م2.4.ب · RPC لإنشاء قطعة مفترضة من مضلّع GeoJSON (PostgREST لا يحوّل GeoJSON→geometry تلقائياً).
-- يملأ الحدود + القضاء/الناحية (استنتاج مكاني يُمرَّر من العميل) + الحالة «مفترضة»؛ بقية الحقول فارغة (§هـ.4.د).
set search_path = public, extensions;

create or replace function create_assumed_parcel(
  p_geom jsonb,
  p_district text default null,
  p_subdistrict text default null
) returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  new_id uuid;
begin
  insert into assumed_parcels (geom, state, district, subdistrict)
  values (
    st_multi(st_setsrid(st_geomfromgeojson(p_geom::text), 4326)),
    'assumed',
    nullif(btrim(coalesce(p_district, '')), ''),
    nullif(btrim(coalesce(p_subdistrict, '')), '')
  )
  returning id into new_id;
  return new_id;
end;
$$;

grant execute on function create_assumed_parcel(jsonb, text, text) to authenticated;
comment on function create_assumed_parcel is 'إنشاء قطعة مفترضة من مضلّع GeoJSON + استنتاج القضاء/الناحية — م2.4.';
