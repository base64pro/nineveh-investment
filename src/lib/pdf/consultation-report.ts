// م6.1/م7.10 · باني تقرير الاستشارة (HTML) — سؤال + إجابة **باستشهاداتها كما هي** (§ح: لا محتوى جديد ولا تأليف).
// تدفّق متّسق بلا فراغات صفحات؛ الاستشهادات مميَّزة كرقائق أنيقة (نفس نمط العرض داخل النظام).
import { esc } from "./render";
import { formatDate } from "@/lib/display";

// نمط الاستشهاد: (قانون/نظام/تعليمات) رقم/سنة [· المادة/م. رقم[/بند]] — مرآة AdvisorAnswer
const CITATION =
  /(?:قانون|نظام|تعليمات|تعليمة)\s+\d+\s*\/\s*\d+(?:\s*·?\s*(?:المادة|م\.?)\s*\d+(?:\s*\/\s*[^\s،.؛)]+)?)?/g;

const inlineMd = (s: string): string =>
  esc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(CITATION, (m) => `<span class="cite">${m}</span>`);

/** تحويل إجابة المستشار (ماركداون مبسّط: عناوين/نقاط/عريض) إلى HTML — يحافظ على النصّ حرفياً. */
export function answerToHtml(text: string): string {
  const out: string[] = [];
  let list: string[] = [];
  let para: string[] = [];
  const flushP = (): void => {
    if (para.length) {
      out.push(`<p>${inlineMd(para.join(" "))}</p>`);
      para = [];
    }
  };
  const flushL = (): void => {
    if (list.length) {
      out.push(`<ul>${list.map((li) => `<li>${inlineMd(li)}</li>`).join("")}</ul>`);
      list = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushP();
      flushL();
      continue;
    }
    const h = line.match(/^#{2,4}\s+(.+)/);
    if (h) {
      flushP();
      flushL();
      out.push(`<h3>${inlineMd(h[1]!)}</h3>`);
      continue;
    }
    const b = line.match(/^[-•]\s+(.+)/);
    if (b) {
      flushP();
      list.push(b[1]!);
      continue;
    }
    flushL();
    para.push(line);
  }
  flushP();
  flushL();
  return out.join("");
}

export function consultationReportBody(c: {
  title: string | null;
  consulted_at: string;
  question: string | null;
  answer: string | null;
}): { title: string; html: string } {
  const t = c.title?.trim() || "استشارة قانونية";
  const head = `<div class="title"><h1>${esc(t)}</h1><div class="meta"><span>${esc(formatDate(c.consulted_at))}</span></div></div>`;
  const q = `<div class="qa-q"><div class="lbl">السؤال</div><div>${inlineMd(c.question ?? "")}</div></div>`;
  // الإجابة تنساب طبيعياً بعد السؤال (لا section بإطار/break-inside) — تقرير متّسق بلا فراغات صفحات
  const a = `<div class="qa-a"><h2>الإجابة</h2>${answerToHtml(c.answer ?? "")}</div>`;
  return { title: t, html: `<div class="consult">${head + q + a}</div>` };
}
