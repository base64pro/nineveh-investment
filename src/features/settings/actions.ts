"use server";

// م5.4 · أفعال الإعدادات. غير السرّي عبر عميل المصادَق (RLS)؛ **المفاتيح بدور service ولا تُعاد للعميل أبداً** (القاعدة #6).
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { anthropicChat } from "@/lib/ai/anthropic";
import { clearAiConfigCache } from "@/lib/ai/ai-config";
import { type AppSettings, DEFAULT_SETTINGS, type SettingsView } from "./types";

type Result = { ok: true } | { ok: false; error: string };

export async function getSettings(): Promise<SettingsView> {
  const sb = await createClient();
  const { data: s } = await sb.from("settings").select("*").eq("id", 1).maybeSingle<AppSettings>();
  const {
    data: { user },
  } = await sb.auth.getUser();

  let keys = { anthropic: false, voyage: false };
  try {
    // وجود المفتاح فقط (provider) — لا قيمته أبداً
    const { data: rows } = await createServiceClient().from("app_secrets").select("provider");
    const set = new Set((rows ?? []).map((r: { provider: string }) => r.provider));
    keys = { anthropic: set.has("anthropic"), voyage: set.has("voyage") };
  } catch {
    // تجاهل
  }

  return { settings: { ...DEFAULT_SETTINGS, ...(s ?? {}) }, keys, email: user?.email ?? null };
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb.from("settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
  if (!error) clearAiConfigCache(); // انعكاس فوري للنموذج/الويب على كل وظائف الذكاء
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** تحقّق فعلي من صلاحية نموذج الذكاء (نداء مصغّر) قبل اعتماده — يمنع تعطيل كل وظائف الذكاء بمعرّف خاطئ. */
export async function testAiModel(model: string): Promise<Result> {
  const m = model.trim();
  if (!m) return { ok: false, error: "النموذج فارغ" };
  try {
    await anthropicChat({ system: "أجب بكلمة واحدة.", messages: [{ role: "user", content: "اختبار" }], maxTokens: 8, model: m });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "النموذج غير متاح" };
  }
}

export async function setApiKey(provider: string, key: string): Promise<Result> {
  const k = key.trim();
  if (!k) return { ok: false, error: "المفتاح فارغ" };
  try {
    const { error } = await createServiceClient()
      .from("app_secrets")
      .upsert({ provider, api_key: k, updated_at: new Date().toISOString() });
    if (!error) clearAiConfigCache();
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "تعذّر الحفظ" };
  }
}

export async function deleteApiKey(provider: string): Promise<Result> {
  try {
    const { error } = await createServiceClient().from("app_secrets").delete().eq("provider", provider);
    if (!error) clearAiConfigCache();
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "تعذّر الحذف" };
  }
}

export async function changePassword(password: string): Promise<Result> {
  if (password.length < 6) return { ok: false, error: "كلمة المرور قصيرة (6 أحرف على الأقل)" };
  const sb = await createClient();
  const { error } = await sb.auth.updateUser({ password });
  return error ? { ok: false, error: error.message } : { ok: true };
}
