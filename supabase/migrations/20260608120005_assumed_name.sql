-- م2.4 · اسم القطعة المفترضة (يمنحه المستخدم — لا اسم افتراضي مشترك «قطعة مفترضة»).
set search_path = public, extensions;

alter table assumed_parcels add column if not exists name text;
comment on column assumed_parcels.name is 'اسم القطعة المفترضة — يُدخله المستخدم بعد الرسم';
