-- م0 · الفهارس (إحالات رخوة + فلاتر شائعة + هندسة + وسوم)
set search_path = public, extensions;

-- ربط السجلات بالقطعة/المقاطعة
create index idx_opportunities_parcel  on opportunities (parcel_no);
create index idx_opportunities_muqataa on opportunities (muqataa_no);
create index idx_opportunities_sector  on opportunities (sector);
create index idx_opportunities_status  on opportunities (opp_status);

create index idx_licenses_parcel   on licenses (parcel_no);
create index idx_licenses_muqataa  on licenses (muqataa_no);
create index idx_licenses_status   on licenses (status);
create index idx_licenses_sector   on licenses (sector);
create index idx_licenses_company  on licenses (company_ref);
create index idx_licenses_number   on licenses (license_number);

create index idx_companies_sector      on companies (sector);
create index idx_companies_governorate on companies (governorate);

-- الطبقة القانونية: تجميع بالوثيقة/النوع + بحث هجين على الوسوم
create index idx_legal_doc        on legal (doc_id);
create index idx_legal_type       on legal (record_type);
create index idx_legal_sectors    on legal using gin (applicable_sectors);

-- الهندسة (مكاني)
create index idx_parcel_geom_gist on parcel_geometry using gist (geom);
create index idx_parcel_geom_no   on parcel_geometry (parcel_no);
create index idx_map_elements_gist on map_elements using gist (geom);
create index idx_assumed_geom_gist on assumed_parcels using gist (geom);
create index idx_assumed_state     on assumed_parcels (state);

-- إحالات كيانات التشغيل
create index idx_visits_parcel    on visits (parcel_ref);
create index idx_criteria_parcel  on criteria (parcel_ref);
create index idx_criteria_domain  on criteria (domain);
