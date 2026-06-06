import { config } from "dotenv";

let loaded = false;

/** يحمّل أسرار .env.local مرّة واحدة (لا تُلتزَم القيم أبداً). */
export function loadEnv(): void {
  if (loaded) return;
  config({ path: ".env.local" });
  loaded = true;
}

export function requireEnv(name: string): string {
  loadEnv();
  const v = process.env[name];
  if (!v) throw new Error(`متغيّر البيئة ${name} مفقود في .env.local — توقّف.`);
  return v;
}
