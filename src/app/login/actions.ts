"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usernameToEmail } from "@/features/auth/username";

export async function login(formData: FormData): Promise<void> {
  // المدير يدخل ببريده؛ المستخدم الثاني باسمٍ بسيط (يُحوَّل لبريد داخلي) — م8.1.
  const email = usernameToEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent("تعذّر الدخول — تحقّق من البريد وكلمة المرور.")}`);
  }
  redirect("/");
}
