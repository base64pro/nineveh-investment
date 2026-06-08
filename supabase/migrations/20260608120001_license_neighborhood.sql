-- م2.2 · إضافة حقل الحي/المنطقة للرخص (كما في الفرص) — يملؤه المستخدم (لا توجد أحياء في بيانات الخريطة)
set search_path = public, extensions;

alter table licenses add column if not exists neighborhood text;
comment on column licenses.neighborhood is 'الحي/المنطقة — تعريف يدوي + منسدلة متراكمة (لا تأليف)';
