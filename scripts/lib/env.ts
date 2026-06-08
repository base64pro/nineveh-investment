import { config } from "dotenv";

let loaded = false;

/** يحمّل أسرار .env.local مرّة واحدة (لا تُلتزَم القيم أبداً). */
export function loadEnv(): void {
  if (loaded) return;
  config({ path: ".env.local", override: true }); // .env.local هو مصدر الحقيقة (يتجاوز أي قيمة محقونة فارغة)
  loaded = true;
}

export function requireEnv(name: string): string {
  loadEnv();
  const v = process.env[name];
  if (!v) throw new Error(`متغيّر البيئة ${name} مفقود في .env.local — توقّف.`);
  return v;
}
