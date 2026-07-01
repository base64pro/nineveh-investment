// م9.12 · بوّابة تصنيف رخيصة: هل يدلّ خطأ استعلام على جلسة منتهية فعليّاً؟ نقيّة وقابلة للاختبار.
// **ليست** الحَكَم النهائيّ — التأكيد القاطع يبقى لـ`supabase.auth.getUser()` الموثوق (نداء شبكيّ). هذه فقط تتجنّب
// نداء getUser على كلّ خطأ. سبب وجودها: حين تسقط الجلسة فعليّاً يرتدّ عميل supabase-js للمفتاح المجهول، فترفض
// دوالّ RPC الممنوحة لـauthenticated فقط (مثل dashboard_stats) بمنع صلاحيّة PostgREST (code 42501 / HTTP 403).

/** إشارة منع/مصادقة محتملة: 401/403، أو رمز PostgREST (42501 منع صلاحيّة · PGRST301/302 JWT)، أو رسائل JWT/جلسة. */
export function looksLikeSessionDenied(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: number; code?: string; message?: string };
  if (e.status === 401 || e.status === 403) return true;
  if (e.code === "42501" || e.code === "PGRST301" || e.code === "PGRST302") return true;
  const msg = typeof e.message === "string" ? e.message.toLowerCase() : "";
  return (
    msg.includes("permission denied") ||
    msg.includes("jwt expired") ||
    msg.includes("invalid jwt") ||
    msg.includes("refresh token") ||
    msg.includes("not authenticated")
  );
}
