// مُساعد تضمينات Voyage AI — **خادمي/سكربتي فقط**. المفتاح من الإعدادات ثم env؛ لا يصل العميل.
// input_type: "document" للفهرسة · "query" للاستعلام (Voyage يحسّن التطابق بهذا التمييز).
import { getProviderKey } from "./ai-config";

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";

export async function voyageEmbed(texts: string[], inputType: "document" | "query"): Promise<number[][]> {
  const key = await getProviderKey("voyage", process.env.VOYAGE_API_KEY);
  if (!key) throw new Error("مفتاح Voyage غير مضبوط (الإعدادات أو VOYAGE_API_KEY)");
  const model = process.env.VOYAGE_MODEL || "voyage-3";

  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ input: texts, model, input_type: inputType }),
  });
  if (!res.ok) {
    throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data.map((d) => d.embedding);
}

/** صياغة متّجه لإدراجه في Postgres (نوع vector). */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
