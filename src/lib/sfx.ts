"use client";

// م7.9/م7.13 · أصوات الواجهة المستقبلية (طلب معتمد): توليف WebAudio خالص — بلا ملفات صوت.
// سلسلة موحّدة: مذبذبات → مرشّح → صدى زجاجي خفيف → ماستر. أصوات «تكنولوجية رقمية فخمة».
// **سياسة المتصفّحات:** AudioContext لا يُنشأ ولا يُستأنف إلا داخل إيماءة مستخدم (unlock)؛
// لذا لا نلمسه عند التحميل (يمنع تحذير «AudioContext was not allowed to start»).

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverbIn: GainNode | null = null;
let unlocked = false;
let lastClickAt = 0;
let booted = false;

/** يُستدعى **حصراً** من معالج إيماءة (نقر/مفتاح) — ينشئ السياق ويستأنفه ضمن الإيماءة. */
export function unlockSfx(): void {
  if (typeof window === "undefined") return;
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(ctx.destination);
      // صدى خوارزمي زجاجي (تأخير بتغذية راجعة مكتومة) — يمنح العمق «الفخم» دون ملف impulse
      reverbIn = ctx.createGain();
      reverbIn.gain.value = 0.5;
      const delay = ctx.createDelay(0.6);
      delay.delayTime.value = 0.09;
      const fb = ctx.createGain();
      fb.gain.value = 0.34;
      const wet = ctx.createGain();
      wet.gain.value = 0.26;
      const damp = ctx.createBiquadFilter();
      damp.type = "lowpass";
      damp.frequency.value = 2400;
      reverbIn.connect(delay);
      delay.connect(fb);
      fb.connect(damp);
      damp.connect(delay);
      delay.connect(wet);
      wet.connect(master);
    }
    if (ctx.state === "suspended") void ctx.resume();
    unlocked = true;
  } catch {
    /* تجاهل */
  }
}

/** السياق إن كان مفتوحاً (بعد أول إيماءة) — وإلا null فتُتجاهَل الأصوات بصمت قبل التفاعل. */
function audio(): AudioContext | null {
  if (!unlocked || !ctx) return null;
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface ToneOpts {
  type?: OscillatorType;
  f0: number;
  f1?: number;
  dur: number;
  peak: number;
  delay?: number;
  detune?: number;
  filter?: number;
  reverb?: number;
  attack?: number;
}

function voice(a: AudioContext, o: ToneOpts): void {
  const t0 = a.currentTime + (o.delay ?? 0);
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.f0, t0);
  if (o.f1 && o.f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + o.dur);
  if (o.detune) osc.detune.value = o.detune;
  const atk = o.attack ?? Math.min(0.012, o.dur * 0.18);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.peak, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  let node: AudioNode = g;
  osc.connect(g);
  if (o.filter) {
    const f = a.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = o.filter;
    f.Q.value = 0.8;
    g.connect(f);
    node = f;
  }
  node.connect(master!);
  if (o.reverb && reverbIn) {
    const send = a.createGain();
    send.gain.value = o.reverb;
    node.connect(send);
    send.connect(reverbIn);
  }
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.04);
}

/** نقرة تكنولوجية فخمة — بليب زجاجي حادّ نظيف بثلاث طبقات + ذيل صدى خفيف. */
export function sfxClick(): void {
  const a = audio();
  if (!a) return;
  const now = performance.now();
  if (now - lastClickAt < 35) return;
  lastClickAt = now;
  // طبقة علوية مصقولة (الحدّة الرقمية) + جسم دافئ + بريق هارموني خاطف
  voice(a, { type: "sine", f0: 2400, f1: 3000, dur: 0.045, peak: 0.045, filter: 6000, reverb: 0.1 });
  voice(a, { type: "triangle", f0: 1200, f1: 1500, dur: 0.055, peak: 0.026, filter: 3400 });
  voice(a, { type: "sine", f0: 4600, dur: 0.022, peak: 0.012, delay: 0.004, reverb: 0.08 });
}

/** ومضة انبثاق هولوكرامية فخمة — تجسيد بكورد صاعد بنغمات نقية + بريق علوي + صدى زجاجي. */
export function sfxOpen(): void {
  const a = audio();
  if (!a) return;
  // كورد ثلاثي صاعد (C–E–G) متعاقب + لمعة علوية لامعة + أساس دافئ — إحساس «تجسّد البطاقة»
  voice(a, { type: "sine", f0: 587, f1: 1175, dur: 0.24, peak: 0.05, filter: 4600, reverb: 0.42 });
  voice(a, { type: "sine", f0: 740, f1: 1480, dur: 0.22, peak: 0.04, delay: 0.035, reverb: 0.42 });
  voice(a, { type: "triangle", f0: 1760, f1: 2960, dur: 0.2, peak: 0.022, delay: 0.06, filter: 6500, reverb: 0.5 });
  voice(a, { type: "sine", f0: 294, f1: 588, dur: 0.28, peak: 0.03, filter: 1700 });
}

/** انسياب طيران تقني فخم وناعم (سووش) — للانتقال للقطعة على الخريطة. */
export function sfxFly(): void {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const len = Math.floor(a.sampleRate * 0.95);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(420, t);
  bp.frequency.exponentialRampToValueAtTime(2600, t + 0.4);
  bp.frequency.exponentialRampToValueAtTime(900, t + 0.9);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.055, t + 0.12);
  g.gain.setValueAtTime(0.055, t + 0.42);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.92);
  src.connect(bp);
  bp.connect(g);
  g.connect(master!);
  if (reverbIn) {
    const send = a.createGain();
    send.gain.value = 0.3;
    g.connect(send);
    send.connect(reverbIn);
  }
  src.start(t);
  src.stop(t + 0.95);
  // طبقة نغمية صاعدة ناعمة تحت السووش (الإحساس «الفخم»)
  voice(a, { type: "sine", f0: 330, f1: 880, dur: 0.5, peak: 0.028, filter: 2400, reverb: 0.3 });
  voice(a, { type: "sine", f0: 660, f1: 990, dur: 0.34, peak: 0.011, delay: 0.05, reverb: 0.3 });
}

/** نغمة افتتاح النظام عند أوّل تفاعل — كورد مهيب صاعد قصير (مرّة واحدة). */
export function sfxBoot(): void {
  if (booted) return;
  const a = audio();
  if (!a) return;
  booted = true;
  voice(a, { type: "sine", f0: 196, f1: 392, dur: 0.62, peak: 0.045, filter: 1600, reverb: 0.5 });
  voice(a, { type: "sine", f0: 392, f1: 587, dur: 0.56, peak: 0.038, delay: 0.08, filter: 3200, reverb: 0.5 });
  voice(a, { type: "triangle", f0: 784, f1: 1175, dur: 0.5, peak: 0.026, delay: 0.16, filter: 5200, reverb: 0.6 });
  voice(a, { type: "sine", f0: 1568, f1: 2350, dur: 0.42, peak: 0.014, delay: 0.24, reverb: 0.6 });
}
