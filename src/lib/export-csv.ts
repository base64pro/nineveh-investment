import { toLatinDigits } from "./format";

export interface CsvColumn {
  key: string;
  label: string;
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = toLatinDigits(String(value)).replace(/"/g, '""');
  return `"${s}"`;
}

/** تصدير CSV (BOM لدعم العربية في Excel). PDF البراندد في م6. */
export function exportCsv(filename: string, rows: Record<string, unknown>[], columns: CsvColumn[]): void {
  const header = columns.map((c) => cell(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => cell(r[c.key])).join(",")).join("\n");
  const csv = `﻿${header}\n${body}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
