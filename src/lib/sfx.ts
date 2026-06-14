"use client";

// م7.9/م7.14 · أصوات الواجهة المستقبلية — توليف WebAudio خالص (بلا ملفات).
// **تخليق FM (تردد معدّل)** يمنح طابعاً معدنياً/زجاجياً مستقبلياً واضحاً + قوة أعلى ملحوظة.
// سلسلة: مصادر → مرشّح → صدى زجاجي → ماستر. السياق لا يُنشأ/يُستأنف إلا داخل إيماءة (autoplay).

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverbIn: GainNode | null = null;
let unlocked = false;
let lastClickAt = 0;
let booted = false;

/** يُستدعى **حصراً** من معالج إيماءة — ينشئ السياق ويستأنفه ضمن الإيماءة. */
export function unlockSfx(): void {
  if (typeof window === "undefined") return;
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 1.0;
      const limit = ctx.createDynamicsCompressor(); // حماية من القصف + تماسك «فخم»
      limit.threshold.value = -8;
      limit.ratio.value = 12;
      limit.attack.value = 0.002;
      limit.release.value = 0.18;
      master.connect(limit);
      limit.connect(ctx.destination);
      // صدى خوارزمي زجاجي
      reverbIn = ctx.createGain();
      reverbIn.gain.value = 0.5;
      const delay = ctx.createDelay(0.6);
      delay.delayTime.value = 0.085;
      const fb = ctx.createGain();
      fb.gain.value = 0.36;
      const wet = ctx.createGain();
      wet.gain.value = 0.3;
      const damp = ctx.createBiquadFilter();
      damp.type = "lowpass";
      damp.frequency.value = 2600;
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

function audio(): AudioContext | null {
  if (!unlocked || !ctx) return null;
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function routeOut(a: AudioContext, node: AudioNode, reverb?: number): void {
  node.connect(master!);
  if (reverb && reverbIn) {
    const send = a.createGain();
    send.gain.value = reverb;
    node.connect(send);
    send.connect(reverbIn);
  }
}

/** صوت FM معدني/زجاجي: حامل + معدِّل (نسبة) + مؤشّر تعديل يتلاشى (طابع نقري لامع). */
function fm(
  a: AudioContext,
  o: { carrier: number; ratio: number; index: number; dur: number; peak: number; delay?: number; glide?: number; filter?: number; reverb?: number },
): void {
  const t0 = a.currentTime + (o.delay ?? 0);
  const car = a.createOscillator();
  car.type = "sine";
  car.frequency.setValueAtTime(o.carrier, t0);
  if (o.glide) car.frequency.exponentialRampToValueAtTime(Math.max(1, o.glide), t0 + o.dur);
  const mod = a.createOscillator();
  mod.type = "sine";
  mod.frequency.setValueAtTime(o.carrier * o.ratio, t0);
  if (o.glide) mod.frequency.exponentialRampToValueAtTime(Math.max(1, o.glide * o.ratio), t0 + o.dur);
  const modGain = a.createGain();
  modGain.gain.setValueAtTime(o.carrier * o.index, t0); // عمق التعديل يتلاشى = لمعة هجومية ثم نقاء
  modGain.gain.exponentialRampToValueAtTime(Math.max(1, o.carrier * o.index * 0.04), t0 + o.dur * 0.8);
  mod.connect(modGain);
  modGain.connect(car.frequency);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.peak, t0 + Math.min(0.008, o.dur * 0.15));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  car.connect(g);
  let node: AudioNode = g;
  if (o.filter) {
    const f = a.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = o.filter;
    f.Q.value = 0.9;
    g.connect(f);
    node = f;
  }
  routeOut(a, node, o.reverb);
  car.start(t0);
  mod.start(t0);
  car.stop(t0 + o.dur + 0.05);
  mod.stop(t0 + o.dur + 0.05);
}

/** نغمة بسيطة (سينية/مثلّثة) — للطبقات الدافئة/الأساسية. */
function tone(
  a: AudioContext,
  o: { type?: OscillatorType; f0: number; f1?: number; dur: number; peak: number; delay?: number; filter?: number; reverb?: number },
): void {
  const t0 = a.currentTime + (o.delay ?? 0);
  const osc = a.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.f0, t0);
  if (o.f1 && o.f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + o.dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.peak, t0 + Math.min(0.01, o.dur * 0.18));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g);
  let node: AudioNode = g;
  if (o.filter) {
    const f = a.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = o.filter;
    g.connect(f);
    node = f;
  }
  routeOut(a, node, o.reverb);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.04);
}

/** نقرة تكنولوجية فخمة وقوية — جرس FM معدني لامع + بريق علوي + ثِقل سفلي خاطف. */
export function sfxClick(): void {
  const a = audio();
  if (!a) return;
  const now = performance.now();
  if (now - lastClickAt < 30) return;
  lastClickAt = now;
  fm(a, { carrier: 1320, ratio: 2.0, index: 6, dur: 0.08, peak: 0.16, filter: 6500, reverb: 0.14 }); // الجرس المعدني (الطابع الحديث)
  tone(a, { type: "sine", f0: 3400, f1: 4200, dur: 0.03, peak: 0.07 }); // بريق علوي حادّ
  tone(a, { type: "sine", f0: 200, f1: 150, dur: 0.05, peak: 0.06, filter: 900 }); // ثِقل سفلي يمنح «القوة»
}

/** ومضة انبثاق هولوكرامية فخمة وقوية — كورد FM يتجسّد صاعداً + سووش مادّي + بريق + صدى زجاجي. */
export function sfxOpen(): void {
  const a = audio();
  if (!a) return;
  // كورد FM ثلاثي (C–E–G) متعاقب — معدني لامع يتجسّد
  fm(a, { carrier: 523, ratio: 1.5, index: 4, dur: 0.32, peak: 0.12, filter: 5000, reverb: 0.5 });
  fm(a, { carrier: 659, ratio: 2.0, index: 3.5, dur: 0.3, peak: 0.1, delay: 0.04, filter: 5600, reverb: 0.5 });
  fm(a, { carrier: 784, ratio: 3.0, index: 3, dur: 0.28, peak: 0.07, delay: 0.08, filter: 7000, reverb: 0.6 });
  tone(a, { type: "sine", f0: 262, f1: 523, dur: 0.34, peak: 0.06, filter: 1700 }); // أساس دافئ صاعد
  // سووش مادّي خاطف يصاحب التجسّد
  const t = a.currentTime;
  const len = Math.floor(a.sampleRate * 0.28);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.0;
  bp.frequency.setValueAtTime(700, t);
  bp.frequency.exponentialRampToValueAtTime(3200, t + 0.26);
  const ng = a.createGain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime(0.05, t + 0.04);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  src.connect(bp);
  bp.connect(ng);
  routeOut(a, ng, 0.4);
  src.start(t);
  src.stop(t + 0.28);
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
  bp.Q.value = 1.3;
  bp.frequency.setValueAtTime(420, t);
  bp.frequency.exponentialRampToValueAtTime(2800, t + 0.4);
  bp.frequency.exponentialRampToValueAtTime(900, t + 0.9);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.08, t + 0.12);
  g.gain.setValueAtTime(0.08, t + 0.42);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.92);
  src.connect(bp);
  bp.connect(g);
  routeOut(a, g, 0.32);
  src.start(t);
  src.stop(t + 0.95);
  // طبقة FM صاعدة ناعمة تحت السووش (الإحساس «الفخم»)
  fm(a, { carrier: 330, ratio: 2.0, index: 2, dur: 0.5, glide: 880, peak: 0.05, filter: 3000, reverb: 0.3 });
}

/** نغمة افتتاح النظام عند أوّل تفاعل — كورد FM مهيب صاعد (مرّة واحدة). */
export function sfxBoot(): void {
  if (booted) return;
  const a = audio();
  if (!a) return;
  booted = true;
  fm(a, { carrier: 196, ratio: 2.0, index: 3, dur: 0.7, glide: 392, peak: 0.07, filter: 2200, reverb: 0.55 });
  fm(a, { carrier: 392, ratio: 1.5, index: 3, dur: 0.62, glide: 587, peak: 0.055, delay: 0.09, filter: 4000, reverb: 0.55 });
  fm(a, { carrier: 784, ratio: 2.0, index: 2.5, dur: 0.54, glide: 1175, peak: 0.035, delay: 0.18, filter: 6000, reverb: 0.65 });
  tone(a, { type: "sine", f0: 1568, f1: 2350, dur: 0.44, peak: 0.018, delay: 0.26, reverb: 0.6 });
}
