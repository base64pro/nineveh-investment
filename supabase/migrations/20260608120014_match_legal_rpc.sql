-- م4.1 · استرجاع دلالي للطبقة القانونية (RAG): أقرب المواد لمتّجه الاستعلام (cosine) + بيانات الاستشهاد.
-- security invoker (RLS: المصادَقون يقرؤون legal/legal_documents). يُستهلك في المستشار القانوني (§هـ.5).
set search_path = public, extensions;

create or replace function match_legal(query_embedding vector(1024), match_count int default 8)
returns table (
  id text,
  doc_title text,
  doc_type text,
  doc_number int,
  doc_year int,
  article_no int,
  article_label_ar text,
  article_text text,
  clauses jsonb,
  applicable_sectors text[],
  investor_type text,
  similarity float
)
language sql
stable
security invoker
as $$
  select
    l.id,
    d.doc_title,
    d.doc_type,
    d.doc_number,
    d.doc_year,
    l.article_no,
    l.article_label_ar,
    l.article_text,
    l.clauses,
    l.applicable_sectors,
    l.investor_type::text,
    1 - (l.embedding <=> query_embedding) as similarity
  from legal l
  join legal_documents d on d.doc_id = l.doc_id
  where l.embedding is not null
  order by l.embedding <=> query_embedding
  limit match_count;
$$;

comment on function match_legal(vector, int) is 'م4 · استرجاع دلالي لأقرب المواد القانونية (RAG) + بيانات الاستشهاد.';
grant execute on function match_legal(vector, int) to authenticated;
