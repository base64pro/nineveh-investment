"use client";

// م7.9/م7.10 · أصوات الواجهة المستقبلية (طلب معتمد): توليف WebAudio خالص — بلا ملفات صوت.
// سلسلة معالجة موحّدة: مذبذبات → مرشّح ترددي → صدى خفيف (تأخير بتغذية راجعة) → ماستر.
// نغمة افتتاح عند الدخول · نقرة تقنية فخمة للأزرار/التابات · ومضة أقوى للبطاقات · انسياب طيران ناعم.
// المستوى رصين (مركز قيادة لا لعبة)، وأول إيماءة مستخدم تفعّل السياق (سياسة المتصفحات).

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverbIn: GainNode | null = null;
let lastClickAt = 0;
let booted = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(ctx.destination);
      // صدى خوارزمي خفيف (تأخير بتغذية راجعة مكتومة) — يمنح العمق «الفخم» دون ملف impulse
      reverbIn = ctx.createGain();
      reverbIn.gain.value = 0.5;
      const delay = ctx.createDelay(0.5);
      delay.delayTime.value = 0.085;
      const fb = ctx.createGain();
      fb.gain.value = 0.32;
      const wet = ctx.createGain();
      wet.gain.value = 0.28;
      const damp = ctx.createBiquadFilter();
      damp.type = "lowpass";
      damp.frequency.value = 2600;
      reverbIn.connect(delay);
      delay.connect(fb);
      fb.connect(damp);
      damp.connect(delay); // حلقة التغذية الراجعة
      delay.connect(wet);
      wet.connect(master);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface ToneOpts {
  type?: OscillatorType;
  f0: number;
  f1?: number;
  dur: number;
  peak: number;
  delay?: number;
  detune?: number;
  filter?: number; // تردد قطع المرشّح (تلميع الحدّة)
  reverb?: number; // نسبة الإرسال للصدى
}

function voice(a: AudioContext, o: ToneOpts): void {
  const t0 = a.currentTime + (o.delay ?? 0);
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.f0, t0);
  if (o.f1 && o.f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + o.dur);
  if (o.detune) osc.detune.value = o.detune;
  const atk = Math.min(0.014, o.dur * 0.2);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.peak, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  let node: AudioNode = g;
  osc.connect(g);
  if (o.filter) {
    const f = a.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = o.filter;
    f.Q.value = 0.7;
    g.connect(f);
    node = f;
  }
  node.connect(master!);
  if (o.reverb && reverbIn) node.connect(reverbIn);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.03);
}

/** نقرة تقنية فخمة — بليب ثنائي الطبقة مع تلميع مرشّح وصدى خفيف. */
export function sfxClick(): void {
  const a = ac();
  if (!a) return;
  const now = performance.now();
  if (now - lastClickAt < 40) return;
  lastClickAt = now;
  voice(a, { type: "triangle", f0: 1880, f1: 2520, dur: 0.05, peak: 0.05, filter: 5200, reverb: 0.12 });
  voice(a, { type: "sine", f0: 3760, f1: 4400, dur: 0.032, peak: 0.016, delay: 0.004 });
  voice(a, { type: "sine", f0: 940, f1: 1180, dur: 0.06, peak: 0.014, filter: 2200 }); // قاع دافئ
}

/** ومضة افتتاح هولوكرامية أقوى — كورد صاعد رباعي مع صدى (انبثاق البطاقات والنوافذ). */
export function sfxOpen(): void {
  const a = ac();
  if (!a) return;
  voice(a, { type: "sine", f0: 523, f1: 1046, dur: 0.22, peak: 0.05, filter: 4200, reverb: 0.4 }); // C5←C6
  voice(a, { type: "sine", f0: 659, f1: 1318, dur: 0.2, peak: 0.04, delay: 0.03, reverb: 0.4 }); // E
  voice(a, { type: "triangle", f0: 1568, f1: 2637, dur: 0.18, peak: 0.022, delay: 0.05, filter: 6000, reverb: 0.5 }); // G علوي لامع
  voice(a, { type: "sine", f0: 262, f1: 523, dur: 0.26, peak: 0.03, filter: 1800 }); // أساس
}

/** انسياب طيران تقني فخم وناعم (سووش) — للانتقال للقطعة على الخريطة. */
export function sfxFly(): void {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  // سووش مُرشَّح متحرّك: ضوضاء بيضاء عبر تمرير نطاقي يكنس صعوداً ثم هبوطاً (إقلاع → استقرار)
  const len = a.sampleRate * 0.95;
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len); // ضوضاء متلاشية
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.1;
  bp.frequency.setValueAtTime(420, t);
  bp.frequency.exponentialRampToValueAtTime(2400, t + 0.4);
  bp.frequency.exponentialRampToValueAtTime(900, t + 0.9);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06, t + 0.12);
  g.gain.setValueAtTime(0.06, t + 0.42);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.92);
  src.connect(bp);
  bp.connect(g);
  g.connect(master!);
  if (reverbIn) g.connect(reverbIn);
  src.start(t);
  src.stop(t + 0.95);
  // طبقة نغمية صاعدة ناعمة تحت السووش (الإحساس «الفخم»)
  voice(a, { type: "sine", f0: 330, f1: 880, dur: 0.5, peak: 0.03, filter: 2400, reverb: 0.3 });
  voice(a, { type: "sine", f0: 660, f1: 990, dur: 0.34, peak: 0.012, delay: 0.05, reverb: 0.3 });
}

/** نغمة افتتاح النظام عند الدخول — كورد مهيب صاعد قصير (يُشغَّل مرّة عند أول تفعيل للصوت). */
export function sfxBoot(): void {
  if (booted) return;
  const a = ac();
  if (!a) return;
  booted = true;
  voice(a, { type: "sine", f0: 196, f1: 392, dur: 0.6, peak: 0.045, filter: 1600, reverb: 0.5 }); // G3 أساس
  voice(a, { type: "sine", f0: 392, f1: 587, dur: 0.55, peak: 0.038, delay: 0.08, filter: 3200, reverb: 0.5 });
  voice(a, { type: "triangle", f0: 784, f1: 1175, dur: 0.5, peak: 0.026, delay: 0.16, filter: 5200, reverb: 0.6 });
  voice(a, { type: "sine", f0: 1568, f1: 2350, dur: 0.42, peak: 0.014, delay: 0.24, reverb: 0.6 }); // بريق علوي
}
