-- م7.7 · توحيد قواميس القوائم المنسدلة عبر النظام (طلب معتمد):
-- view واحدة تجمع القيم المعرّفة يدوياً (field_options) ∪ القيم الموجودة فعلاً في
-- الفرص/الرخص/المفترضة لكل حقل قاموسي — فتظهر أي قيمة عرّفها المستخدم من أي نافذة
-- في كل منسدلات النظام بنفس القيم (الحي/القضاء/الناحية/المقاطعة/العائدية/نوع الحق/...).
-- (الأعمدة مطابقة حرفياً لمخطط §ج.8: الفرص بلا subdistrict/land_right؛ المفترضة بلا project_type/zoning.)
set search_path = public, extensions;

create or replace view field_value_options
with (security_invoker = true) as
select field_key, value from field_options
union
select k, v from (
  -- الفرص
  select 'sector' as k, sector as v from opportunities
  union all select 'project_type', project_type from opportunities
  union all select 'district', district from opportunities
  union all select 'neighborhood', neighborhood from opportunities
  union all select 'muqataa_name', muqataa_name from opportunities
  union all select 'owner', owner from opportunities
  union all select 'zoning', zoning from opportunities
  -- الرخص
  union all select 'sector', sector from licenses
  union all select 'project_type', project_type from licenses
  union all select 'district', district from licenses
  union all select 'subdistrict', subdistrict from licenses
  union all select 'neighborhood', neighborhood from licenses
  union all select 'muqataa_name', muqataa_name from licenses
  union all select 'owner', owner from licenses
  union all select 'land_right', land_right from licenses
  union all select 'zoning', zoning from licenses
  union all select 'investor_nationality', investor_nationality from licenses
  -- المفترضة
  union all select 'sector', sector from assumed_parcels
  union all select 'district', district from assumed_parcels
  union all select 'subdistrict', subdistrict from assumed_parcels
  union all select 'neighborhood', neighborhood from assumed_parcels
  union all select 'muqataa_name', muqataa_name from assumed_parcels
  union all select 'owner', owner from assumed_parcels
  union all select 'land_right', land_right from assumed_parcels
  union all select 'legal_status', legal_status from assumed_parcels
) t
where v is not null and btrim(v) <> '';

comment on view field_value_options is 'قاموس موحّد لقيم المنسدلات: المعرّف يدوياً ∪ المستعمل فعلاً في الجداول الثلاثة (م7.7).';
grant select on field_value_options to authenticated;
