import type { SupabaseClient } from "@supabase/supabase-js";
import { readData } from "../lib/data";
import { assertCount, EXPECTED, LEGAL_PER_DOC } from "../lib/counts";
import { upsertAll } from "../lib/upsert";
import { asNumber } from "../lib/coerce";
import type { RawLegalDocument, RawLegalFile, RawLegalRecord } from "./raw-types";

const LEGAL_FILES = [
  "law_13_2006.json",
  "reg_2_2009.json",
  "int_reg_3_2009.json",
  "reg_7_2010.json",
  "reg_6_2017.json",
  "reg_5_2011.json",
  "reg_5_2018.json",
  "fees_1_2016.json",
] as const;

function docToRow(d: RawLegalDocument): Record<string, unknown> {
  if (!d.doc_id) throw new Error("وثيقة قانونية بلا doc_id — توقّف.");
  if (!d.doc_title) throw new Error(`الوثيقة ${d.doc_id} بلا doc_title — توقّف.`);
  return {
    doc_id: d.doc_id,
    doc_title: d.doc_title,
    doc_type: d.doc_type ?? null,
    doc_number: asNumber(d.doc_number, "doc_number"),
    doc_year: asNumber(d.doc_year, "doc_year"),
    issuing_authority: d.issuing_authority ?? null,
    amended_by: d.amended_by ?? [],
    gazette: d.gazette ?? null,
    currency: d.currency ?? null,
    source_file: d.source_file ?? null,
    verification: d.verification ?? null,
    tags_note: d.tags_note ?? null,
  };
}

function recToRow(r: RawLegalRecord, docId: string): Record<string, unknown> {
  if (!r.id) throw new Error("سجلّ قانوني بلا id — توقّف.");
  if (!r.record_type) throw new Error(`السجلّ ${r.id} بلا record_type — توقّف.`);
  if (r.doc_id !== docId) throw new Error(`السجلّ ${r.id}: doc_id لا يطابق ${docId} — توقّف.`);
  const t = r.tags ?? null;
  return {
    id: r.id,
    record_type: r.record_type,
    doc_id: r.doc_id,
    chapter_no: asNumber(r.chapter_no, "chapter_no"),
    chapter_title: r.chapter_title ?? null,
    article_no: asNumber(r.article_no, "article_no"),
    article_label_ar: r.article_label_ar ?? null,
    article_text: r.article_text ?? null,
    clauses: r.clauses ?? null,
    amendments: r.amendments ?? null,
    cross_refs: r.cross_refs ?? null,
    section_no: asNumber(r.section_no, "section_no"),
    section_title: r.section_title ?? null,
    fee_items: r.fee_items ?? null,
    applicable_sectors: t?.applicable_sectors ?? null,
    investor_type: t?.investor_type ?? null,
    capital_tier: t?.capital_tier ?? null,
    jurisdiction: t?.jurisdiction ?? null,
    verification: r.verification ?? null,
  };
}

/** قراءة الملفّات الثمانية + تحقّق عدّ كل وثيقة والمجموع (بلا قاعدة). */
export function loadLegal(): {
  docRows: Record<string, unknown>[];
  recRows: Record<string, unknown>[];
} {
  const docRows: Record<string, unknown>[] = [];
  const recRows: Record<string, unknown>[] = [];

  for (const file of LEGAL_FILES) {
    const data = readData<RawLegalFile>(file);
    const docId = data.document?.doc_id;
    if (!docId) throw new Error(`الملفّ ${file} بلا document.doc_id — توقّف.`);
    const expected = LEGAL_PER_DOC[docId];
    if (expected == null) throw new Error(`وثيقة غير متوقّعة: ${docId} — توقّف.`);
    assertCount(`legal[${docId}]`, data.records.length, expected);

    docRows.push(docToRow(data.document));
    for (const rec of data.records) recRows.push(recToRow(rec, docId));
  }

  assertCount("legal_documents", docRows.length, EXPECTED.legalDocuments);
  assertCount("legal(total)", recRows.length, EXPECTED.legal);
  return { docRows, recRows };
}

export async function importLegal(
  sb: SupabaseClient,
): Promise<{ documents: number; records: number }> {
  const { docRows, recRows } = loadLegal();
  await upsertAll(sb, "legal_documents", docRows, "doc_id"); // الوثائق أولاً (FK)
  await upsertAll(sb, "legal", recRows, "id");
  return { documents: docRows.length, records: recRows.length };
}
