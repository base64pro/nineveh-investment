-- م2.2 · إضافة حقل «الحي» للفرص (إدخال مستخدم؛ يُستنتج مكانياً لاحقاً في م2.4)
set search_path = public, extensions;

alter table opportunities add column if not exists neighborhood text;
comment on column opportunities.neighborhood is 'الحي — إدخال مستخدم (يُستنتج مكانياً عند توفّر الهندسة)';
