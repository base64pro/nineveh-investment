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

// كتم الصوت العام (طلب معتمد) — يُحفظ في localStorage فيثبت بين الجلسات.
let muted = false;
if (typeof window !== "undefined") {
  try {
    muted = window.localStorage.getItem("sfx-muted") === "1";
  } catch {
    /* تجاهل */
  }
}
export function isSfxMuted(): boolean {
  return muted;
}
export function setSfxMuted(v: boolean): void {
  muted = v;
  try {
    window.localStorage.setItem("sfx-muted", v ? "1" : "0");
  } catch {
    /* تجاهل */
  }
}

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
  if (muted || !unlocked || !ctx) return null;
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

/** انبثاق نافذة معلومات «مركز أمني رقمي متقدّم» — مهيب درامي يوحي بالأهمية:
 *  سويلة سفلية تتصاعد (ثِقل) + كنس صاعد متوتّر (تشغيل) + رنّة معلومات بلّورية عالية + ذيل صدى واسع. */
export function sfxOpen(): void {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;

  // 1) سويلة سفلية مهيبة تتصاعد ببطء (الجاذبية/الأهمية)
  tone(a, { type: "sine", f0: 70, f1: 150, dur: 0.6, peak: 0.09, filter: 600, reverb: 0.25 });
  tone(a, { type: "triangle", f0: 140, f1: 210, dur: 0.55, peak: 0.04, filter: 900, reverb: 0.3 });

  // 2) كنس صاعد متوتّر (إحساس «التشغيل/التحميل») — ضوضاء عبر تمرير نطاقي يصعد
  const len = Math.floor(a.sampleRate * 0.42);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.min(1, (i / len) * 1.6);
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(280, t);
  bp.frequency.exponentialRampToValueAtTime(2600, t + 0.4);
  const ng = a.createGain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime(0.045, t + 0.18);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  src.connect(bp);
  bp.connect(ng);
  routeOut(a, ng, 0.4);
  src.start(t);
  src.stop(t + 0.42);

  // 3) رنّة المعلومات البلّورية العالية عند الذروة (لحظة «جاهز/مهم») — جرسان FM بفاصل خامسة
  fm(a, { carrier: 1175, ratio: 2.0, index: 5, dur: 0.5, peak: 0.1, delay: 0.22, filter: 7000, reverb: 0.62 });
  fm(a, { carrier: 1760, ratio: 3.0, index: 3.5, dur: 0.42, peak: 0.055, delay: 0.27, filter: 8000, reverb: 0.7 });
  // 4) بريق علوي خاطف يثبّت اللحظة
  tone(a, { type: "sine", f0: 3000, f1: 3600, dur: 0.05, peak: 0.03, delay: 0.24, reverb: 0.4 });
}

/** م9.13 · انبثاق بطاقة هولوغراميّة — ومضة ظهور أنصع/أقصر من sfxOpen: نفخة صاعدة خاطفة (تشكّل المادّة) + جرسا FM لامعان + بريق علويّ. */
export function sfxPop(): void {
  const a = audio();
  if (!a) return;
  tone(a, { type: "sine", f0: 180, f1: 520, dur: 0.22, peak: 0.06, filter: 1500, reverb: 0.3 }); // نفخة صاعدة (مادّة تتشكّل)
  fm(a, { carrier: 1320, ratio: 2.0, index: 5, dur: 0.3, peak: 0.085, delay: 0.04, filter: 7200, reverb: 0.5 }); // جرس بلّوريّ
  fm(a, { carrier: 1980, ratio: 3.0, index: 3, dur: 0.24, peak: 0.04, delay: 0.07, filter: 8200, reverb: 0.55 }); // جرس أعلى (فاصل خامسة)
  tone(a, { type: "sine", f0: 3200, f1: 3900, dur: 0.05, peak: 0.025, delay: 0.05, reverb: 0.4 }); // بريق علويّ خاطف
}

let lastTypeAt = 0;
let typeStep = 0;
/** م9.15 · نقرة طباعة **ميكانيكيّة حقيقيّة** (لوحة مفاتيح): (١) نقرة علويّة حادّة جافّة (المفتاح يلامس) عبر دفعة ضوضاء
 *  عالية ~١٣مللي + (٢) ثوك الكيكاب السفليّ (يستقرّ) عبر نغمتين منخفضتين جافّتين. صدى ضئيل جدّاً (واقعيّ لا فضائيّ). */
export function sfxType(): void {
  const a = audio();
  if (!a) return;
  const now = performance.now();
  if (now - lastTypeAt < 42) return;
  lastTypeAt = now;
  typeStep = (typeStep + 1) % 7;
  const t = a.currentTime;
  // (1) النقرة العلويّة الحادّة (لمسة المفتاح) — ضوضاء عالية قصيرة جدّاً عبر تمرير عالٍ
  const len = Math.floor(a.sampleRate * 0.013);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const dch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) dch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
  const src = a.createBufferSource();
  src.buffer = buf;
  const hp = a.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1500 + typeStep * 90; // تنويع طفيف بين الضربات
  const ng = a.createGain();
  ng.gain.setValueAtTime(0.085, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.014);
  src.connect(hp);
  hp.connect(ng);
  routeOut(a, ng, 0.04);
  src.start(t);
  src.stop(t + 0.02);
  // (2) ثوك الكيكاب السفليّ (الاستقرار) — نغمتان منخفضتان جافّتان
  tone(a, { type: "sine", f0: 188 + typeStep * 9, f1: 130, dur: 0.045, peak: 0.05, filter: 820 });
  tone(a, { type: "triangle", f0: 360, f1: 248, dur: 0.022, peak: 0.018, filter: 1500 });
}

/** انسياب طيران تقني فخم — **أطول وأنعم وأجمل**: سووش طويل بقوس تردّدي رشيق + قاع نغمي حالم + شمرة هوائية. */
export function sfxFly(): void {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const DUR = 1.35; // أطول
  const len = Math.floor(a.sampleRate * DUR);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; // ضوضاء كاملة (الظرف من الغين لنعومة أعلى)
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.9; // أعرض = أنعم
  bp.frequency.setValueAtTime(380, t);
  bp.frequency.exponentialRampToValueAtTime(2600, t + 0.6);
  bp.frequency.exponentialRampToValueAtTime(820, t + DUR);
  const g = a.createGain();
  // ظرف ناعم: هجوم متدرّج · استدامة · تلاشٍ مطوّل
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.07, t + 0.22);
  g.gain.setValueAtTime(0.07, t + 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + DUR);
  src.connect(bp);
  bp.connect(g);
  routeOut(a, g, 0.38);
  src.start(t);
  src.stop(t + DUR + 0.05);
  // قاع نغمي حالم صاعد ثم مستقرّ (إقلاع → استقرار لطيف)
  fm(a, { carrier: 300, ratio: 1.5, index: 1.8, dur: 0.85, glide: 760, peak: 0.045, filter: 2600, reverb: 0.34 });
  fm(a, { carrier: 450, ratio: 2.0, index: 1.4, dur: 0.6, glide: 600, peak: 0.022, delay: 0.1, filter: 3200, reverb: 0.34 });
  // شمرة هوائية عالية خافتة تنساب
  tone(a, { type: "sine", f0: 2200, f1: 3000, dur: 0.7, peak: 0.012, delay: 0.08, reverb: 0.3 });
}

/** م9.18 · مقبض «سووش طيران» مستمرّ ومُتحكَّم به بالسرعة (للجولة السينمائيّة). */
export type FlightWhooshHandle = { setSpeed: (v: number) => void; stop: () => void };

/**
 * م9.18 · محرّك سووش طيران **مستمرّ** يُقاد إطاراً بإطار من سرعة الكاميرا الفعليّة — يبقى الصوت متّسقاً مع الحركة دائماً
 * (بدل طلقة sfxFly المنفصلة): طبقة هواء (ضوضاء دوّارة عبر تمرير نطاقيّ يتّسع تردّده مع السرعة) + قاع محرّك (منشاريّة منخفضة عبر تمرير منخفض).
 * كلّ المعاملات تتبع setSpeed(0..1) بتنعيم setTargetAtTime. يعيد null إن كان الصوت مكتوماً/غير مهيّأ.
 */
export function createFlightWhoosh(): FlightWhooshHandle | null {
  const a = audio();
  if (!a) return null;
  const t = a.currentTime;
  // سووش هوائيّ **هادئ ناعم**: ضوضاء ورديّة (تمرير منخفض بسيط على البيضاء ⇒ بلا هسهسة حادّة) → تمرير منخفض + تمرير عالٍ يزيل الهدير.
  const len = Math.floor(a.sampleRate * 2);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  let lp1 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    lp1 = lp1 * 0.96 + w * 0.04; // تنعيم ⇒ ضوضاء ورديّة ناعمة
    d[i] = lp1 * 6;
  }
  const src = a.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lp = a.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = 0.5;
  lp.frequency.setValueAtTime(560, t);
  const hp = a.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 150; // أزِل الهدير السفليّ
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  src.connect(lp);
  lp.connect(hp);
  hp.connect(g);
  routeOut(a, g, 0.3); // صدى لطيف = سلاسة إضافيّة
  src.start(t);
  let stopped = false;
  const setSpeed = (v: number): void => {
    if (stopped || !ctx) return;
    const s = muted ? 0 : Math.max(0, Math.min(1, v)); // كتمٌ أثناء التشغيل ⇒ صمت
    const tt = ctx.currentTime;
    g.gain.setTargetAtTime(0.0002 + 0.03 * s, tt, 0.13); // **خفيف جداً** (ذروة ~٠٫٠٣) وسلس
    lp.frequency.setTargetAtTime(520 + 800 * s, tt, 0.13); // يفتح قليلاً مع السرعة (ناعم لا حادّ)
  };
  const stop = (): void => {
    if (stopped || !ctx) return;
    stopped = true;
    const tt = ctx.currentTime;
    g.gain.setTargetAtTime(0.0001, tt, 0.2); // تلاشٍ ناعم
    try {
      src.stop(tt + 0.8);
    } catch {
      /* تجاهل */
    }
  };
  return { setSpeed, stop };
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
