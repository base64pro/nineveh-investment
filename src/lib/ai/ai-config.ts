// م5.4 · قارئ إعدادات الذكاء — **خادمي فقط**. يقرأ النموذج/المفتاح من إعدادات المستخدم (القاعدة) ثم env بديلاً.
// المفاتيح لا تُعاد للعميل أبداً (تُستهلَك هنا خادمياً فقط).
import { createServiceClient } from "@/lib/supabase/service";

/** مفتاح مزوّد من جدول الأسرار (خادمي) ثم env بديلاً. */
export async function getProviderKey(provider: string, envFallback?: string): Promise<string | undefined> {
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
}

/** نموذج الذكاء المختار في الإعدادات ثم env بديلاً (يُطبَّق على كل وظائف الذكاء · القاعدة #9). */
export async function getAiModel(envFallback?: string): Promise<string | undefined> {
  try {
    const { data } = await createServiceClient().from("settings").select("ai_model").eq("id", 1).maybeSingle<{ ai_model: string }>();
    if (data?.ai_model) return data.ai_model;
  } catch {
    // تجاهل
  }
  return envFallback;
}

/** هل بحث الويب مفعّل (للتوصيات/المعايير/الإثراء — م6)؟ */
export async function getWebSearchEnabled(): Promise<boolean> {
  try {
    const { data } = await createServiceClient().from("settings").select("web_search_enabled").eq("id", 1).maybeSingle<{ web_search_enabled: boolean }>();
    return Boolean(data?.web_search_enabled);
  } catch {
    return false;
  }
}
