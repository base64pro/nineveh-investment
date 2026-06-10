// م5.4 · قارئ إعدادات الذكاء — **خادمي فقط**. يقرأ النموذج/المفتاح من إعدادات المستخدم (القاعدة) ثم env بديلاً.
// المفاتيح لا تُعاد للعميل أبداً (تُستهلَك هنا خادمياً فقط).
// كاش خفيف (TTL 60 ثانية) يلغي رحلتي قاعدة عن كل نداء ذكاء؛ تُفرَّغ عند أي تغيير من الإعدادات.
import { createServiceClient } from "@/lib/supabase/service";

const TTL_MS = 60_000;
const cache = new Map<string, { v: unknown; at: number }>();

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.v as T;
  const v = await fn();
  cache.set(key, { v, at: Date.now() });
  return v;
}

/** تُستدعى من أفعال الإعدادات عند أي تغيير (نموذج/مفاتيح/ويب) — انعكاس فوري. */
export function clearAiConfigCache(): void {
  cache.clear();
}

/** مفتاح مزوّد من جدول الأسرار (خادمي) ثم env بديلاً. */
export async function getProviderKey(provider: string, envFallback?: string): Promise<string | undefined> {
  return cached(`key:${provider}`, async () => {
    try {
      const { data } = await createServiceClient()
        .from("app_secrets")
        .select("api_key")
        .eq("provider", provider)
        .maybeSingle<{ api_key: string }>();
      if (data?.api_key) return data.api_key;
    } catch {
      // تعذّر الوصول للقاعدة ← env بديلاً
    }
    return envFallback;
  });
}

/** نموذج الذكاء المختار في الإعدادات ثم env بديلاً (يُطبَّق على كل وظائف الذكاء · القاعدة #9). */
export async function getAiModel(envFallback?: string): Promise<string | undefined> {
  return cached("model", async () => {
    try {
      const { data } = await createServiceClient().from("settings").select("ai_model").eq("id", 1).maybeSingle<{ ai_model: string }>();
      if (data?.ai_model) return data.ai_model;
    } catch {
      // تجاهل
    }
    return envFallback;
  });
}

/** هل بحث الويب مفعّل (للتوصيات/المعايير/الإثراء)؟ */
export async function getWebSearchEnabled(): Promise<boolean> {
  return cached("web", async () => {
    try {
      const { data } = await createServiceClient().from("settings").select("web_search_enabled").eq("id", 1).maybeSingle<{ web_search_enabled: boolean }>();
      return Boolean(data?.web_search_enabled);
    } catch {
      return false;
    }
  });
}
