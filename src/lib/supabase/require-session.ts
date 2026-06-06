import { createClient } from "./server";

/** فحص جلسة سريع (من الكوكيز، بلا نداء شبكي) لحماية مسارات الـAPI. */
export async function hasSession(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}
