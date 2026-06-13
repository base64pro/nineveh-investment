// مُساعد Anthropic — **خادمي فقط** (يُستدعى من Server Actions). المفتاح لا يصل العميل أبداً (§قاعدة 6).
// النموذج والمفتاح من **إعدادات المستخدم** (القاعدة) ثم env بديلاً (§قاعدة 9).
import { getAiModel, getProviderKey } from "./ai-config";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export async function anthropicChat(opts: {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  model?: string;
  /** أدوات خادمية (مثل بحث الويب web_search_20250305) — تعمل لدى Anthropic، لا تصل العميل. */
  tools?: unknown[];
}): Promise<string> {
  // الإعدادات أولاً ثم env. APP_ANTHROPIC_KEY اسم مميّز يتفادى حقن بيئة التطوير لـANTHROPIC_API_KEY فارغاً.
  const key = await getProviderKey("anthropic", process.env.APP_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY);
  if (!key) throw new Error("مفتاح Anthropic غير مضبوط (الإعدادات أو APP_ANTHROPIC_KEY)");
  const model = opts.model || (await getAiModel(process.env.ANTHROPIC_MODEL));
  if (!model) throw new Error("نموذج الذكاء غير مضبوط (الإعدادات أو ANTHROPIC_MODEL)");

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 2048,
      system: opts.system,
      messages: opts.messages,
      ...(opts.tools?.length ? { tools: opts.tools } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  return data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n")
    .trim();
}
