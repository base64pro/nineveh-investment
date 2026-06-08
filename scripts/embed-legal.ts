// م4.1 · حساب تضمينات الطبقة القانونية وتخزينها (Voyage → legal.embedding). يتطلّب VOYAGE_API_KEY.
import { Client } from "pg";
import { requireEnv } from "./lib/env";

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function embed(texts: string[], attempt = 0): Promise<number[][]> {
  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${requireEnv("VOYAGE_API_KEY")}`, "content-type": "application/json" },
    body: JSON.stringify({ input: texts, model: process.env.VOYAGE_MODEL || "voyage-3", input_type: "document" }),
  });
  if (res.status === 429 && attempt < 10) {
    await sleep(25_000); // الطبقة المجانية: انتظر ثم أعد المحاولة
    return embed(texts, attempt + 1);
  }
  if (!res.ok) throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data.map((d) => d.embedding);
}

async function main(): Promise<void> {
  const c = new Client({ connectionString: requireEnv("DATABASE_URL"), ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query("set search_path = public, extensions");
  // نصّ التضمين = العنوان + النصّ الحرفي (سياق أغنى للبحث).
  // نصّ التضمين = العنوان + النصّ الحرفي + **نصوص البنود** (كثير من الأحكام في البنود: عتبات/نسب/مدد).
  const rows = (
    await c.query<{ id: string; t: string }>(
      `select id, concat_ws(' — ', article_label_ar, article_text,
         (select string_agg(cl->>'text', ' ') from jsonb_array_elements(coalesce(clauses, '[]'::jsonb)) cl)) as t
       from legal
       where (article_text is not null and length(trim(article_text)) > 0)
          or jsonb_array_length(coalesce(clauses, '[]'::jsonb)) > 0`,
    )
  ).rows;
  console.log(`السجلات القابلة للتضمين: ${rows.length}`);

  const BATCH = 6; // دفعة صغيرة لاحترام حدّ الرموز/الدقيقة في الطبقة المجانية
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const embs = await embed(chunk.map((r) => r.t));
    for (let j = 0; j < chunk.length; j++) {
      const emb = embs[j];
      if (!emb) continue;
      await c.query("update legal set embedding = $1::vector where id = $2", [`[${emb.join(",")}]`, chunk[j]!.id]);
    }
    done += chunk.length;
    console.log(`… ${done}/${rows.length}`);
    if (i + BATCH < rows.length) await sleep(21_000); // ≤3 طلبات/دقيقة
  }
  const n = (await c.query<{ n: number }>("select count(*)::int n from legal where embedding is not null")).rows[0]?.n ?? 0;
  await c.end();
  console.log(`✓ مُضمَّن: ${n} سجلاً`);
}

void main();
