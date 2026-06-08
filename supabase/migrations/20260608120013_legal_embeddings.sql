-- م4.1 · تضمينات الطبقة القانونية (RAG): عمود متّجه على جدول `legal` (السجلّ=المادة) + فهرس HNSW (جيب التمام).
-- البُعد 1024 = voyage-3. pgvector مُفعَّل من م0. التضمينات تُحسب بسكربت embed:legal (Voyage).
set search_path = public, extensions;

alter table legal add column if not exists embedding vector(1024);

-- فهرس HNSW للبحث الدلالي السريع (cosine) — كافٍ لـ125 سجلاً.
create index if not exists legal_embedding_hnsw
  on legal using hnsw (embedding vector_cosine_ops);

comment on column legal.embedding is 'تضمين article_text (voyage-3, 1024) للبحث الدلالي — م4.';
