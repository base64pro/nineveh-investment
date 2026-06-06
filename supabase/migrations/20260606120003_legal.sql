-- م0 · الطبقة القانونية (§ج.5 · §ج.8/4) — Akoma Ntoso: وثيقة ← مواد
-- التضمينات (embedding) والفهرسة (HNSW) مؤجّلة إلى م4.
set search_path = public, extensions;

-- الوثائق القانونية (8 وثائق)
create table legal_documents (
  doc_id              text primary key,
  doc_title           text not null,
  doc_type            text,
  doc_number          integer,
  doc_year            integer,
  issuing_authority   text,
  amended_by          jsonb not null default '[]'::jsonb,
  gazette             text,
  currency            text,
  source_file         text,
  verification        text,
  tags_note           text,
  created_at          timestamptz not null default now()
);
comment on table legal_documents is 'الوثائق القانونية (قانون/نظام/تعليمات) — رأس Akoma Ntoso';

-- السجلّات القانونية = المواد/الأقسام (125 سجلاً)
create table legal (
  id                  text primary key,                  -- معرّف ثابت هرمي، مثل law_13_2006/art_1
  record_type         text not null
                        check (record_type in ('مادة', 'مادة_ملغاة', 'مذكّرة', 'جدول_أجور')),
  doc_id              text not null references legal_documents (doc_id) on delete cascade,
  chapter_no          integer,
  chapter_title       text,
  article_no          integer,                           -- لاتيني
  article_label_ar    text,
  article_text        text,                              -- النصّ الحرفي (المرجع)
  clauses             jsonb,                             -- [{key, text}]
  amendments          jsonb,                             -- نسخ التعديلات
  cross_refs          jsonb,                             -- إحالات حيّة
  -- جداول الأجور (جدول_أجور)
  section_no          integer,
  section_title       text,
  fee_items           jsonb,                             -- [{item, service, fee}]
  -- الوسوم الأربعة المضبوطة (تصنيف مشتق مساعد — النصّ هو المرجع)
  applicable_sectors  text[],
  investor_type       text check (investor_type in ('iraqi', 'foreign', 'both')),
  capital_tier        text check (capital_tier in ('min_250k', 'over_250m', 'strategic_federal', 'adjustable')),
  jurisdiction        text check (jurisdiction in ('governorate', 'federal', 'both')),
  verification        text,
  created_at          timestamptz not null default now()
);
comment on table legal is 'السجلّ = المادة (§ج.5). النصّ الحرفي هو المرجع؛ الوسوم تصنيف مساعد.';
comment on column legal.article_no is 'رقم المادة لاتيني دائماً (§ح.3)';
