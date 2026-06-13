// م8.1 · تحويل «اسم المستخدم» إلى بريد المصادقة: المدير يدخل ببريده الحقيقي (فيه @)،
// والمستخدم الثاني باسمٍ بسيط يُلحق به نطاق داخلي ثابت. دالّة نقية مشتركة (دخول + إنشاء).
export const LOCAL_DOMAIN = "nineveh.local";

export function usernameToEmail(input: string): string {
  const u = input.trim().toLowerCase();
  if (!u) return "";
  return u.includes("@") ? u : `${u}@${LOCAL_DOMAIN}`;
}
