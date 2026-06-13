-- مراجعة م6 · تحسين: فهارس trigram وظيفية على الأعمدة الأثقل بحثاً (ILIKE %..%) —
-- تبقى الاستعلامات سريعة مع نموّ البيانات (ar_normalize معلَنة immutable في 120017).
set search_path = public, extensions;

create extension if not exists pg_trgm;

create index if not exists opportunities_title_trgm on opportunities using gin (ar_normalize(title) gin_trgm_ops);
create index if not exists licenses_title_trgm on licenses using gin (ar_normalize(title) gin_trgm_ops);
create index if not exists companies_name_trgm on companies using gin (ar_normalize(name) gin_trgm_ops);
create index if not exists assumed_parcels_name_trgm on assumed_parcels using gin (ar_normalize(name) gin_trgm_ops);
