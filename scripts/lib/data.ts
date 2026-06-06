import { readFileSync } from "node:fs";
import { join } from "node:path";

/** يقرأ ملفّ JSON من مجلّد /data (للقراءة فقط — لا تعديل يدوي). */
export function readData<T>(file: string): T {
  const path = join(process.cwd(), "data", file);
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}
