// مُساعد Anthropic — **خادمي فقط** (يُستدعى من Server Actions). المفتاح من env ولا يصل العميل أبداً (§قاعدة 6).
// النموذج من env كافتراضي؛ يُتجاوَز بإعدادات المستخدم في م5 (تمرير model).

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
}): Promise<string> {
  // APP_ANTHROPIC_KEY: اسم مميّز يتفادى حقن بيئة التطوير لـANTHROPIC_API_KEY (فارغاً)؛ مع إبقاء الاسم القياسي بديلاً للإنتاج.
  const key = process.env.APP_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("APP_ANTHROPIC_KEY غير مضبوط");
  const model = opts.model || process.env.ANTHROPIC_MODEL;
  if (!model) throw new Error("ANTHROPIC_MODEL غير مضبوط");

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
