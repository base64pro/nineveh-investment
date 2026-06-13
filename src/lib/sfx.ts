"use client";

// م7.9 · أصوات الواجهة المستقبلية (طلب معتمد): توليف WebAudio خالص — بلا ملفات صوت.
// نقرة رقمية لكل زر/تاب · ومضة افتتاح للبطاقات الهولوكرامية · انسياب طيران للانتقال على الخريطة.
// مستوى الصوت مكتوم عمداً (مركز قيادة رصين لا لعبة)، وأول إيماءة مستخدم تفعّل السياق (سياسة المتصفحات).

let ctx: AudioContext | null = null;
let lastClickAt = 0;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  a: AudioContext,
  type: OscillatorType,
  f0: number,
  f1: number,
  t0: number,
  dur: number,
  peak: number,
): void {
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.012, dur * 0.25));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** نقرة رقمية قصيرة (بليب تقني) — لكل الأزرار والتابات. */
export function sfxClick(): void {
  const a = ac();
  if (!a) return;
  const now = performance.now();
  if (now - lastClickAt < 45) return; // لا تكدّس عند النقر السريع
  lastClickAt = now;
  const t = a.currentTime;
  tone(a, "triangle", 1750, 2450, t, 0.045, 0.045);
  tone(a, "sine", 3500, 4200, t, 0.03, 0.018);
}

/** ومضة افتتاح هولوكرامية — انبثاق البطاقات والنوافذ. */
export function sfxOpen(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  tone(a, "sine", 620, 1480, t, 0.16, 0.04);
  tone(a, "sine", 1860, 2960, t + 0.04, 0.14, 0.022);
  tone(a, "triangle", 310, 740, t, 0.12, 0.02);
}

/** انسياب طيران تقني ناعم — الانتقال للقطعة على الخريطة. */
export function sfxFly(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  // انزلاق صاعد ثم استقرار هابط (إقلاع → هبوط لطيف)
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.exponentialRampToValueAtTime(960, t + 0.32);
  osc.frequency.exponentialRampToValueAtTime(540, t + 0.7);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.08);
  g.gain.setValueAtTime(0.05, t + 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + 0.8);
  // طبقة هواء عالية خفيفة
  tone(a, "sine", 2300, 3300, t + 0.05, 0.3, 0.012);
}
