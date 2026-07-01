"use client";

// م9.15 (المرحلة B) · سلسلة بطاقات هولوغراميّة فوق المجسّم المستقرّ — **مروحة ثلاثيّة الأبعاد كعائلة واحدة**: البطاقة قيد
// السرد (الفعّالة) تتقدّم للأمام وتواجه الناظر فتُقرأ بوضوح، والمكتملة تنضمّ للمروحة خلفها بميلٍ وعمق. الحدّ الكامل للفعّالة
// وحدها (تنسيق)؛ والبقيّة أهدأ. التتالي مدفوع بانتهاء السرد، عناصر السرد تتدرّج بالظهور بصوت طباعة حقيقيّ. صفر تأليف.
// البطاقات: ① الأساسيّة · ② الضوابط (§ج.9) · ③ الجاهزيّة (تايم-لاين تقدّم) · ④ التوصيات.

import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatArea, orNA } from "@/lib/display";
import { sectorLabel } from "@/lib/sectors";
import { StateBadge } from "@/features/parcels/state-badge";
import { sfxPop, sfxType } from "@/lib/sfx";
import { useTypewriter } from "./use-typewriter";
import type { ControlsResult } from "@/features/parcels/legal/controls-engine";
import type { ParcelProps } from "../lib/use-map-parcels";
import type { ParcelState } from "@/types/entities";
import type { SelectedEntityInfo } from "./selected-parcel-card";
import { AUTHORITY_CARD, SIX_TOWER_STEPS, isAuthoritySite, isSixTowerSite } from "../lib/site-content";

const STATE_HEX: Record<string, string> = { announced: "#C7A24E", "in-progress": "#5775A8", completed: "#5E977A", withdrawn: "#B5616A", assumed: "#22C3F3" };
// ألوان العقد: حالات §ج.9 + أنواع خطوات المسار (تسلسليّ/متوازٍ/مشروط).
const FULFILL_HEX: Record<string, string> = { met: "#5E977A", not_met: "#B5616A", needs_action: "#C7A24E", needs_input: "#5775A8", not_applicable: "#6b7a90", seq: "#5775A8", parallel: "#5E977A", conditional: "#C7A24E" };

const CARD_W = 270;
const CARD_H = 264; // ثابت لكلّ البطاقات (أحجام موحّدة)
const CONN_W = 48; // عرض الرابط الهولوكراميّ بين بطاقتَين

function useSequenceReveal(count: number, stepMs: number, onDone: () => void): number {
  const [n, setN] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (count <= 0) {
      doneRef.current();
      return;
    }
    let i = 0;
    let last = 0;
    let raf = 0;
    const tick = (now: number): void => {
      if (!last) last = now;
      if (now - last >= stepMs) {
        last = now;
        i += 1;
        setN(i);
        sfxType();
        if (i >= count) {
          doneRef.current();
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [count, stepMs]);
  return n;
}

function Rise({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <motion.div initial={{ opacity: 0, x: -10, filter: "blur(2px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} transition={{ duration: 0.34, ease: "easeOut" }} className={className} style={style}>
      {children}
    </motion.div>
  );
}

function Corner({ pos, accent }: { pos: "tl" | "tr" | "bl" | "br"; accent: string }) {
  const map: Record<string, string> = {
    tl: "left-1 top-1 border-l-2 border-t-2 rounded-tl-[7px]",
    tr: "right-1 top-1 border-r-2 border-t-2 rounded-tr-[7px]",
    bl: "left-1 bottom-1 border-l-2 border-b-2 rounded-bl-[7px]",
    br: "right-1 bottom-1 border-r-2 border-b-2 rounded-br-[7px]",
  };
  return <span aria-hidden className={cn("pointer-events-none absolute z-20 size-3.5", map[pos])} style={{ borderColor: accent, filter: `drop-shadow(0 0 7px ${accent})` }} />;
}

function Typed({ value, enabled, accent, onDone, cps = 32 }: { value: string; enabled: boolean; accent: string; onDone?: () => void; cps?: number }) {
  const { shown, done } = useTypewriter(value, { enabled, cps, onTick: sfxType, onDone });
  return (
    <span>
      {shown || (enabled ? "" : " ")}
      {enabled && !done ? (
        <motion.span aria-hidden animate={{ opacity: [1, 0.12, 1] }} transition={{ duration: 0.7, repeat: Infinity }} className="ms-px inline-block h-[1em] w-[2px] translate-y-[2px] rounded-full align-middle" style={{ background: accent, boxShadow: `0 0 7px ${accent}` }} />
      ) : null}
    </span>
  );
}

// القشرة الزجاجيّة المشتركة — الحدّ الكامل **للفعّالة** فقط (تنسيق العائلة)؛ والبقيّة بحدّ أهدأ وتعتيم خفيف.
function HoloShell({ accent, active, children, height = CARD_H }: { accent: string; active: boolean; children: ReactNode; height?: number }) {
  return (
    <div className="relative rounded-2xl p-[1.5px]" style={{ filter: active ? `drop-shadow(0 20px 26px rgba(0,0,0,0.55)) drop-shadow(0 0 36px ${accent}88)` : `drop-shadow(0 14px 20px rgba(0,0,0,0.5)) drop-shadow(0 0 16px ${accent}33)` }}>
      <div className="absolute inset-0 overflow-hidden rounded-2xl" style={{ opacity: active ? 0.46 : 0.34 }}>
        <motion.span aria-hidden className="absolute left-1/2 top-1/2 aspect-square w-[185%] -translate-x-1/2 -translate-y-1/2" style={{ background: `conic-gradient(from 0deg, ${accent}, #7fd6ff, ${accent}, #9ee4ff, ${accent}, #7fd6ff, ${accent})` }} animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} />
        {active ? <motion.span aria-hidden className="absolute left-1/2 top-1/2 aspect-square w-[185%] -translate-x-1/2 -translate-y-1/2 mix-blend-screen" style={{ background: `conic-gradient(from 120deg, transparent, transparent, #ffffffcc, transparent, transparent, ${accent}cc, transparent, transparent)` }} animate={{ rotate: -360 }} transition={{ duration: 16, repeat: Infinity, ease: "linear" }} /> : null}
      </div>
      <div className="relative flex flex-col overflow-hidden rounded-[15px] bg-[hsl(213_64%_13%_/_0.62)] backdrop-blur-2xl backdrop-saturate-[1.9] ring-1 ring-inset ring-white/25" style={{ height }}>
        <span aria-hidden className="pointer-events-none absolute inset-0 z-0" style={{ background: "radial-gradient(140% 100% at 50% 0%, rgba(205,242,255,0.3), transparent 60%), linear-gradient(150deg, rgba(110,205,255,0.22), transparent 48%), linear-gradient(325deg, rgba(150,230,255,0.14), transparent 44%)" }} />
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/65 to-transparent" />
        <span aria-hidden className="pointer-events-none absolute inset-0 z-0 opacity-60" style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(175,218,255,0.06) 0px, rgba(175,218,255,0.06) 1px, transparent 1px, transparent 4px)" }} />
        {active ? <motion.span aria-hidden initial={{ y: "-40%" }} animate={{ y: "140%" }} transition={{ duration: 5.4, repeat: Infinity, ease: "linear" }} className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8" style={{ background: `linear-gradient(to bottom, transparent, ${accent}1f, transparent)` }} /> : null}
        <Corner pos="tl" accent={accent} />
        <Corner pos="tr" accent={accent} />
        <Corner pos="bl" accent={accent} />
        <Corner pos="br" accent={accent} />
        {children}
      </div>
    </div>
  );
}

function CardHead({ accent, title, badge }: { accent: string; title: ReactNode; badge?: ReactNode }) {
  return (
    <>
      <div className="relative z-10 flex shrink-0 items-center gap-1.5 px-3.5 pb-1.5 pt-3">
        <motion.span aria-hidden animate={{ opacity: [1, 0.3, 1], scale: [1, 1.25, 1] }} transition={{ duration: 1.6, repeat: Infinity }} className="size-1.5 shrink-0 rounded-full" style={{ background: accent, boxShadow: `0 0 8px 1px ${accent}` }} />
        <h4 className="min-w-0 flex-1 truncate text-[13px] font-bold leading-snug text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">{title}</h4>
        {badge}
      </div>
      <span aria-hidden className="relative z-10 mx-3 block h-px shrink-0" style={{ background: `linear-gradient(90deg, transparent, ${accent}cc, transparent)` }} />
    </>
  );
}

function BasicBody({ props, info, accent, onDone }: { props: ParcelProps; info: SelectedEntityInfo; accent: string; onDone: () => void }) {
  const [reveal, setReveal] = useState(-1);
  const done = useRef(false);
  useEffect(() => {
    sfxPop();
    const t = setTimeout(() => setReveal(0), 340);
    return () => clearTimeout(t);
  }, []);
  const lines = [
    { label: "القطاع", value: sectorLabel(info.sector) },
    { label: "المساحة", value: formatArea(info.area) },
    { label: "الحي", value: orNA(props.neighborhood) },
    { label: "رقم القطعة", value: orNA(props.parcel_no) },
  ];
  useEffect(() => {
    if (reveal >= lines.length + 1 && !done.current) {
      done.current = true;
      onDone();
    }
  }, [reveal, lines.length, onDone]);
  const advance = (i: number) => () => setReveal((r) => Math.max(r, i + 1));
  return (
    <>
      <CardHead accent={accent} title={<Typed value={orNA(props.label)} enabled={reveal >= 0} accent={accent} onDone={advance(0)} />} badge={<StateBadge state={props.state as ParcelState} />} />
      <div className="relative z-10 grid flex-1 grid-cols-2 content-start gap-x-3 gap-y-3.5 px-3.5 pb-3.5 pt-3.5">
        {lines.map((ln, i) =>
          reveal >= i + 1 ? (
            <Rise key={ln.label} className="min-w-0">
              <div className="text-[8.5px] font-semibold uppercase tracking-wider text-white/75 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{ln.label}</div>
              <div className="truncate text-[12px] font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
                <Typed value={ln.value} enabled accent={accent} onDone={advance(i + 1)} />
              </div>
            </Rise>
          ) : (
            <div key={ln.label} className="min-w-0" />
          ),
        )}
      </div>
    </>
  );
}

// ② الضوابط — **ملخّص نظيف بلا تمرير**: شارة الأهليّة + توزيع الحالات (عدّ لكلّ حالة بلونها)؛ التفصيل البنديّ في مسار الإنجاز أسفل الصفّ.
const FULFILL_LABEL: { key: string; label: string }[] = [
  { key: "met", label: "منجَز" },
  { key: "needs_action", label: "يحتاج إجراءً" },
  { key: "needs_input", label: "بانتظار مُدخلات" },
  { key: "not_met", label: "غير مستوفى" },
  { key: "not_applicable", label: "غير منطبق" },
];
function ControlsBody({ controls, accent, onDone }: { controls: ControlsResult; accent: string; onDone: () => void }) {
  const rows = [...controls.projectControls, ...controls.investorCriteria];
  const chips = FULFILL_LABEL.map((c) => ({ ...c, count: rows.filter((r) => r.fulfillment === c.key).length, color: FULFILL_HEX[c.key] ?? "#6b7a90" })).filter((c) => c.count > 0);
  useEffect(() => {
    sfxPop();
  }, []);
  const n = useSequenceReveal(chips.length, 230, onDone);
  return (
    <>
      <CardHead accent={accent} title="الضوابط القانونيّة والشروط" badge={<span className="shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold text-white ring-1 ring-inset" style={{ background: `${accent}22`, borderColor: `${accent}55` }}>{controls.eligibilityLabel}</span>} />
      <div className="relative z-10 flex flex-1 flex-col gap-2 px-3.5 pb-3.5 pt-3">
        <div className="text-[8.5px] font-semibold uppercase tracking-wider text-white/65">
          <span className="tabular-nums">{rows.length}</span> بنداً · <span className="tabular-nums">{controls.projectControls.length}</span> ضابط مشروع · <span className="tabular-nums">{controls.investorCriteria.length}</span> معيار مستثمر
        </div>
        <div className="flex flex-col gap-1.5">
          {chips.slice(0, n).map((c) => (
            <Rise key={c.key} className="flex items-center justify-between rounded-lg px-2.5 py-1.5 ring-1 ring-inset ring-white/10" style={{ background: `${c.color}14` }}>
              <span className="flex items-center gap-2">
                <span className="size-2 shrink-0 rounded-full" style={{ background: c.color, boxShadow: `0 0 6px ${c.color}` }} />
                <span className="text-[11px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{c.label}</span>
              </span>
              <span className="text-[13px] font-bold tabular-nums text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{c.count}</span>
            </Rise>
          ))}
        </div>
      </div>
    </>
  );
}

// ③ الجاهزيّة والفرص — **ملخّص نظيف بلا تمرير**: حلقة نسبة الجاهزيّة + إحصاءات مفتاحيّة؛ تفصيل الخطوات في مسار الإنجاز أسفل الصفّ.
function ReadinessBody({ controls, accent, onDone }: { controls: ControlsResult; accent: string; onDone: () => void }) {
  const steps = [...controls.projectControls, ...controls.investorCriteria];
  const metCount = steps.filter((s) => s.fulfillment === "met").length;
  const pct = steps.length ? Math.round((metCount / steps.length) * 100) : 0;
  const actionable = steps.filter((s) => s.fulfillment === "needs_action" || s.fulfillment === "needs_input").length;
  const blocking = steps.filter((s) => s.fulfillment === "not_met").length;
  const stats = [
    { label: "بنود مكتملة", value: `${metCount} / ${steps.length}` },
    { label: "تحتاج إجراءً", value: `${actionable}` },
    { label: "عوائق قائمة", value: `${blocking}` },
  ];
  useEffect(() => {
    sfxPop();
  }, []);
  const n = useSequenceReveal(stats.length, 260, onDone);
  return (
    <>
      <CardHead accent={accent} title="الجاهزيّة والفرص الممكنة" badge={<span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold text-white ring-1 ring-inset tabular-nums" style={{ background: `${accent}22`, borderColor: `${accent}55` }}>{pct}%</span>} />
      <div className="relative z-10 flex flex-1 items-center gap-3.5 px-3.5 pb-3 pt-3">
        {/* حلقة نسبة الجاهزيّة */}
        <div className="relative grid size-[74px] shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${accent} ${pct}%, rgba(255,255,255,0.1) ${pct}%)`, boxShadow: `0 0 14px ${accent}66` }}>
          <div className="grid size-[58px] place-items-center rounded-full bg-[hsl(216_56%_11%)] ring-1 ring-inset ring-white/15">
            <span className="text-[17px] font-bold tabular-nums text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
              {pct}
              <span className="text-[9px]">%</span>
            </span>
          </div>
        </div>
        {/* إحصاءات مفتاحيّة */}
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          {stats.slice(0, n).map((s) => (
            <Rise key={s.label} className="flex items-baseline justify-between gap-2 border-b border-white/10 pb-1.5 last:border-0">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-white/70">{s.label}</span>
              <span className="text-[13px] font-bold tabular-nums text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{s.value}</span>
            </Rise>
          ))}
        </div>
      </div>
      <div className="relative z-10 mx-3.5 mb-3 shrink-0 rounded-lg px-2.5 py-1.5 text-center text-[8.5px] font-semibold text-white/70 ring-1 ring-inset ring-white/10" style={{ background: `${accent}12` }}>مسار الإنجاز والموافقات الكامل ↓ أسفل البطاقات</div>
    </>
  );
}

// مسار الإنجاز والموافقات — **عقد متدفّقة أسفل الصفّ** (لا تمرير): رقائق متوهّجة تنبثق تباعاً، ملوّنة بنوع كلّ خطوة، تلتفّ سطوراً.
// steps عامّة (title + tone + tag اختياريّ): من بنود §ج.9، أو من مسار الرخصة الحقيقيّ لموقع بعينه.
type FlowStep = { title: string; tone: string; tag?: string };
function FlowPath({ steps, accent, width, footer, onDone }: { steps: FlowStep[]; accent: string; width: number; footer?: string; onDone?: () => void }) {
  useEffect(() => {
    sfxPop();
  }, []);
  const n = useSequenceReveal(steps.length, 105, onDone ?? (() => {}));
  return (
    <motion.div initial={{ opacity: 0, y: -16, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.55, ease: "easeOut" }} className="shrink-0" style={{ width }}>
      <div className="relative overflow-hidden rounded-2xl bg-[hsl(213_64%_13%_/_0.62)] px-3 py-2.5 ring-1 ring-inset ring-white/20 backdrop-blur-2xl backdrop-saturate-[1.9]" style={{ boxShadow: `0 16px 26px rgba(0,0,0,0.5), 0 0 22px ${accent}33` }}>
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" />
        <div className="mb-2 flex items-center gap-2 px-1">
          <motion.span aria-hidden animate={{ opacity: [1, 0.3, 1], scale: [1, 1.25, 1] }} transition={{ duration: 1.6, repeat: Infinity }} className="size-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 8px 1px ${accent}` }} />
          <h4 className="text-[12px] font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">مسار الإنجاز والموافقات</h4>
          <span className="rounded-full px-2 py-0.5 text-[8px] font-bold text-white ring-1 ring-inset tabular-nums" style={{ background: `${accent}22`, borderColor: `${accent}55` }}>
            {steps.length} خطوة
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
          {steps.slice(0, n).map((s, i) => {
            const dot = FULFILL_HEX[s.tone] ?? "#6b7a90";
            return (
              <Fragment key={`${i}-${s.title}`}>
                {i > 0 ? <span aria-hidden className="h-px w-3 shrink-0" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}55)`, boxShadow: `0 0 5px ${accent}88` }} /> : null}
                <Rise className="flex items-center gap-1.5 rounded-full py-1 pe-2.5 ps-1 ring-1 ring-inset ring-white/15" style={{ background: `${dot}1f` }}>
                  <span className="grid size-[18px] shrink-0 place-items-center rounded-full text-[8px] font-bold tabular-nums text-white" style={{ background: dot, boxShadow: `0 0 7px ${dot}` }}>
                    {i + 1}
                  </span>
                  {s.tag ? <span className="shrink-0 rounded px-1 text-[7.5px] font-bold text-white/80" style={{ background: `${dot}33` }}>{s.tag}</span> : null}
                  <span className="max-w-[150px] truncate text-[10px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{s.title}</span>
                </Rise>
              </Fragment>
            );
          })}
        </div>
        {footer ? <div className="mt-2 px-1 text-[8px] font-semibold text-white/55">{footer}</div> : null}
      </div>
    </motion.div>
  );
}

function RecommendBody({ accent, onDone }: { accent: string; onDone: () => void }) {
  const items = ["نوع المشروع الأنسب", "المواصفات المقترَحة", "الشركة المطابِقة"];
  useEffect(() => {
    sfxPop();
  }, []);
  const n = useSequenceReveal(items.length, 260, onDone);
  return (
    <>
      <CardHead accent={accent} title="التوصيات الذكيّة" badge={<span className="shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold text-state-assumed ring-1 ring-inset ring-state-assumed/40">اجتهاد غير مُلزِم</span>} />
      <div className="relative z-10 flex-1 space-y-2.5 px-3.5 pb-3.5 pt-3">
        {items.slice(0, n).map((t) => (
          <Rise key={t}>
            <div className="text-[8.5px] font-semibold uppercase tracking-wider text-white/70">{t}</div>
            <div className="text-[11px] font-bold text-white/45">— يُضاف لاحقاً —</div>
          </Rise>
        ))}
      </div>
    </>
  );
}

// م9.17 · مبنى الهيئة — **بطاقة واحدة نصّيّة** (بدل السلسلة): الأساس التشريعيّ للخارطة + التوقيع. النصّ حرفيّ (صفر تأليف).
function AuthorityBody({ accent, onDone }: { accent: string; onDone: () => void }) {
  const paras = AUTHORITY_CARD.paragraphs;
  const [reveal, setReveal] = useState(-1); // ‑1 لم يبدأ · i الفقرة i تُسرَد
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const fired = useRef(false);
  useEffect(() => {
    sfxPop(); // مرّة واحدة عند الانبثاق (deps فارغة — لا يُعاد مع كلّ إعادة رسم/حركة) ⇒ لا رنّات متتالية
    const t = setTimeout(() => setReveal(0), 320);
    return () => clearTimeout(t);
  }, []);
  const advance = (i: number) => () => setReveal((r) => Math.max(r, i + 1));
  useEffect(() => {
    if (reveal >= paras.length && !fired.current) {
      fired.current = true;
      doneRef.current();
    }
  }, [reveal, paras.length]);
  return (
    <>
      <CardHead accent={accent} title={AUTHORITY_CARD.title} />
      {/* النصّ يُسرَد بالطباعة تباعاً (فقرةً فقرة) بصوت الطباعة — كبقيّة البطاقات. */}
      <div className="pointer-events-auto relative z-10 flex-1 space-y-2.5 overflow-y-auto px-6 pb-3 pt-2.5 text-[12px] leading-relaxed text-white/90">
        {paras.map((p, i) =>
          reveal >= i ? (
            <Rise key={i}>
              <p className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                <Typed value={p} enabled accent={accent} cps={70} onDone={advance(i)} />
              </p>
            </Rise>
          ) : null,
        )}
        {reveal >= paras.length ? (
          <Rise>
            <div className="mt-3 border-t border-white/15 pt-2 text-center text-[13px] font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
              {AUTHORITY_CARD.signName} {AUTHORITY_CARD.signPerson}
            </div>
          </Rise>
        ) : null}
      </div>
    </>
  );
}

// رابط هولوكراميّ رشيق بين بطاقتَين + نقاط مضيئة تسير من الأقدم (يمين) للأحدث (يسار).
function Connector({ accent }: { accent: string }) {
  return (
    <motion.div layout initial={{ opacity: 0, scaleX: 0.2 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ duration: 0.4, ease: "easeOut" }} className="relative shrink-0 self-stretch" style={{ width: CONN_W }}>
      <div className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2" style={{ background: `linear-gradient(90deg, ${accent}, #cdf2ff, ${accent})`, boxShadow: `0 0 7px ${accent}` }} />
      {[0, 0.6, 1.2].map((d, k) => (
        <motion.span key={k} aria-hidden className="absolute top-1/2 size-1.5 rounded-full" style={{ left: 0, marginTop: -3, background: "#eaf7ff", boxShadow: `0 0 8px ${accent}` }} initial={{ x: CONN_W - 6, opacity: 0 }} animate={{ x: [CONN_W - 6, 2], opacity: [0, 1, 1, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "linear", delay: d }} />
      ))}
    </motion.div>
  );
}

export function HoloModelCards({
  props,
  info,
  controls,
  matrixRef,
  onDismiss,
  onNarrationComplete,
}: {
  props: ParcelProps;
  info: SelectedEntityInfo;
  controls: ControlsResult | null;
  matrixRef: Ref<HTMLDivElement>; // يُحدَّث transform عليه مباشرةً كلّ إطار (بلا ارتجاف)
  onDismiss?: () => void; // نقر أيّ بطاقة يُخفي السلسلة (طلب صريح) — لا تختفي بغيره
  onNarrationComplete?: () => void; // م9.18 · يُطلَق مرّة عند اكتمال انبثاق كلّ البطاقات وسرد نصوصها (للجولة)
}) {
  const accent = STATE_HEX[props.state] ?? "#22C3F3";
  const authority = isAuthoritySite(props.label); // الهيئة ⇒ بطاقة واحدة نصّيّة
  const sixTower = isSixTowerSite(props.label); // «٦ أبراج» ⇒ مسار الرخصة الحقيقيّ
  const cardW = authority ? 960 : CARD_W; // م9.17 · بطاقة الهيئة أفقيّة عريضة (٢.٥× العرض السابق ٣٨٤)
  const cardH = authority ? 300 : CARD_H; // وأقصر ٢٥٪ (من ٤٠٠) ⇒ خطّ أكبر مقروء
  const [shown, setShown] = useState(1);
  const next = () => setShown((s) => s + 1);

  const all: { id: string; body: (onDone: () => void) => ReactNode }[] = authority
    ? [{ id: "authority", body: (d) => <AuthorityBody accent={accent} onDone={d} /> }]
    : [
        { id: "basic", body: (d) => <BasicBody props={props} info={info} accent={accent} onDone={d} /> },
        ...(controls ? [{ id: "controls", body: (d: () => void) => <ControlsBody controls={controls} accent={accent} onDone={d} /> }] : []),
        ...(controls ? [{ id: "readiness", body: (d: () => void) => <ReadinessBody controls={controls} accent={accent} onDone={d} /> }] : []),
        { id: "recommend", body: (d: () => void) => <RecommendBody accent={accent} onDone={d} /> },
      ];
  const cards = all.slice(0, Math.min(shown, all.length));
  const N = cards.length;

  const modelDrop = cardH + 150; // مسافة هبوط ① حتى المجسّم (فضاء محلّيّ): تُولد صغيرة ثمّ تصعد
  const rowW = all.length * cardW + Math.max(0, all.length - 1) * CONN_W; // عرض الصفّ الكامل (لمحاذاة مسار الإنجاز تحته)
  const flowSteps: FlowStep[] = sixTower
    ? SIX_TOWER_STEPS.map((s) => ({ title: s.title, tone: s.tone, tag: s.tag }))
    : controls
      ? [...controls.projectControls, ...controls.investorCriteria].map((c) => ({ title: c.title, tone: c.fulfillment }))
      : [];
  const flowFooter = sixTower ? "المسار الكامل: 24 خطوة عبر 4 مراحل (م0–م3)" : "مسار الرخصة الكامل (20+ خطوة) — يُستبدَل به حين تصل بياناته.";
  const willFlow = !authority && flowSteps.length > 0;
  const flowOn = willFlow && shown > all.length; // يظهر بعد اكتمال سرد البطاقة الأخيرة

  // م9.18 · اكتمال السرد: (المسار مكتمل إن وُجد) وإلّا (اكتملت آخر بطاقة). يُطلَق مرّة واحدة.
  const [flowDone, setFlowDone] = useState(false);
  const narrated = willFlow ? flowDone : shown > all.length;
  const ncRef = useRef(onNarrationComplete);
  ncRef.current = onNarrationComplete;
  const ncFired = useRef(false);
  useEffect(() => {
    if (narrated && !ncFired.current) {
      ncFired.current = true;
      ncRef.current?.();
    }
  }, [narrated]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[15]">
      {/* مستوى العالم: transform (matrix3d) يُضبَط عبر ref كلّ إطار رسمٍ للخريطة — الصفّ كيان ثابت تدور حوله الكاميرا فترى جوانبه. */}
      <div ref={matrixRef} style={{ position: "absolute", left: 0, top: 0, transformStyle: "preserve-3d", transformOrigin: "0 0", visibility: "hidden" }}>
        <div dir="rtl" style={{ position: "absolute", left: 0, top: 0, transformStyle: "preserve-3d", transform: "translate(-50%, -100%)" }}>
          <div style={{ position: "relative" }}>
            <motion.div layout className="flex items-start">
              {cards.map((c, i) => (
                <Fragment key={c.id}>
                  {i > 0 ? <Connector accent={accent} /> : null}
                  <motion.div layout className="shrink-0 cursor-pointer" style={{ width: cardW, pointerEvents: "auto" }} onClick={onDismiss} title="انقر لإخفاء البطاقات">
                    <motion.div
                      style={{ transformOrigin: "bottom center" }}
                      initial={i === 0 ? { opacity: 0, scale: 0.16, y: modelDrop } : { opacity: 0, scale: 0.5, x: 80 }}
                      animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                      transition={{ type: "spring", stiffness: 150, damping: 20 }}
                    >
                      <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: i * 0.45 }}>
                        <HoloShell accent={accent} active height={cardH}>
                          {c.body(i === N - 1 ? next : () => {})}
                        </HoloShell>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                </Fragment>
              ))}
            </motion.div>
            {/* مسار الإنجاز: absolute فوق الصفّ (نحو السماء) — نمط tooltip القياسيّ (bottom:100%+margin-bottom) فلا يُزحزح البطاقات الثابتة. */}
            {flowOn ? (
              <div style={{ position: "absolute", left: "50%", bottom: "100%", transform: "translateX(-50%)", marginBottom: 12 }}>
                <FlowPath steps={flowSteps} accent={accent} width={rowW} footer={flowFooter} onDone={() => setFlowDone(true)} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
