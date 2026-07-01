"use client";
// م9.14 (③) · تحوّل مادّة المجسّم المستقرّ إلى **مخطّط هولوكراميّ سكتشيّ** عبر LayerExtension تحقن خطّافات deck.gl —
// شقيق EnvReflectExtension (نفس آليّة الفضاء الآمنة: التقاط العاديّ/النظر/الارتفاع في vs:DECKGL_FILTER_COLOR، والحساب في fs).
// **مرحلة الجزء فقط** ⇒ لا مساس بالإحداثيّات/الأبعاد/التوجيه (الشكل مطابق رياضيّاً). يقوده uniform واحد holoT:0→1 يُمزِج
// المادّة الأصليّة نحو هولوغرام (حافّة Fresnel متوهّجة + خطوط مسح صاعدة + سطح شفيف كحليّ-سماويّ). gated: عند holoT≈0 لا أثر.
import { LayerExtension, project } from "@deck.gl/core";
import type { Layer } from "@deck.gl/core";
import type { ShaderModule } from "@luma.gl/shadertools";

export type HoloStyleId = "blueprint" | "edges" | "ghost";

// النمط المعتمد = **حوافّ متوهّجة** (glow أعلى = أبرز توهّجاً). edgeK أصغر=هالة أوسع · glow=شدّة الانبعاث الحافّيّ · alpha=شفافيّة السطح.
export const HOLO_STYLES: Record<HoloStyleId, { edgeK: number; scanFreq: number; scanSpeed: number; scanAmt: number; tint: [number, number, number]; alpha: number; glow: number }> = {
  blueprint: { edgeK: 4.0, scanFreq: 5.0, scanSpeed: 1.2, scanAmt: 0.16, tint: [0.13, 0.76, 0.95], alpha: 0.6, glow: 1.6 }, // إطار سلكيّ مخطّطيّ + شبكة
  edges: { edgeK: 2.0, scanFreq: 0.0, scanSpeed: 0.0, scanAmt: 0.0, tint: [0.2, 0.8, 1.0], alpha: 0.42, glow: 2.6 }, // **الافتراضيّ**: حوافّ متوهّجة ساطعة + سطح شبح شفيف
  ghost: { edgeK: 2.5, scanFreq: 3.0, scanSpeed: 3.0, scanAmt: 0.5, tint: [0.18, 0.8, 1.0], alpha: 0.5, glow: 1.9 }, // موجة مسح صاعدة
};

// حالة مشتركة قابلة للتغيير (يقرؤها draw كلّ إطار): التقدّم 0→1، الزمن، معرّف المجسّم المستقرّ، النمط (مثبَّت «حوافّ متوهّجة»).
export const HOLO_STATE: { progress: number; time: number; settledId: string; style: HoloStyleId } = { progress: 0, time: 0, settledId: "", style: "edges" };

const vs = `\
out vec3 vHoloNormal;
out vec3 vHoloView;
out float vHoloZ;
`;

const fs = `\
layout(std140) uniform holoUniforms {
  float holoT;
  float edgeK;
  float scanFreq;
  float scanSpeed;
  float scanAmt;
  float time;
  float tintR;
  float tintG;
  float tintB;
  float alpha;
  float glow;
} holo;
in vec3 vHoloNormal;
in vec3 vHoloView;
in float vHoloZ;
`;

const inject = {
  "vs:DECKGL_FILTER_COLOR": `
    vHoloNormal = geometry.normal;
    vHoloView = project.cameraPosition - geometry.position.xyz;
    vHoloZ = geometry.position.z;
  `,
  "fs:DECKGL_FILTER_COLOR": `
    if (holo.holoT > 0.002) {
      vec3 vhN = normalize(vHoloNormal);
      vec3 vhV = normalize(vHoloView);
      float vhFres = pow(1.0 - clamp(dot(vhN, vhV), 0.0, 1.0), max(holo.edgeK, 0.3)); // حافّة الظلّ (silhouette)
      float vhCrease = clamp(length(fwidth(vHoloNormal)) * 18.0, 0.0, 1.0); // **خطوط الزوايا الهندسيّة**: انكسار العاديّ بين الأوجه
      float vhEdge = max(vhFres, vhCrease); // كلّ الحوافّ والزوايا المضيئة
      float vhScan = holo.scanAmt * (0.5 + 0.5 * sin(vHoloZ * holo.scanFreq - holo.time * holo.scanSpeed));
      vec3 vhTint = vec3(holo.tintR, holo.tintG, holo.tintB);
      float vhA = clamp(holo.holoT, 0.0, 1.0);
      // (1) السطح يتحوّل لشبح شفيف مصبوغ نظيف
      color.rgb = mix(color.rgb, mix(color.rgb * 0.24, vhTint, 0.6), vhA);
      // (2) خطوط الهولوكرام الساطعة على **كلّ الزوايا الهندسيّة + الظلّ** — إضافة انبعاثيّة قويّة (سماويّ↔أبيض)
      color.rgb += mix(vhTint, vec3(1.0), 0.6) * vhEdge * holo.glow * vhA;
      // (3) موجة المسح (إن وُجدت) + (4) شفافيّة: السطح شبح والخطوط تستعيد العتامة فتبرز هندسة المجسّم
      color.rgb += vhTint * vhScan * vhA;
      color.a = mix(color.a, clamp(holo.alpha + vhEdge * 0.85, 0.0, 1.0), vhA);
      color.rgb = min(color.rgb, vec3(1.0));
    }
  `,
};

const holoModule: ShaderModule = {
  name: "holo",
  dependencies: [project],
  vs,
  fs,
  inject,
  uniformTypes: {
    holoT: "f32",
    edgeK: "f32",
    scanFreq: "f32",
    scanSpeed: "f32",
    scanAmt: "f32",
    time: "f32",
    tintR: "f32",
    tintG: "f32",
    tintB: "f32",
    alpha: "f32",
    glow: "f32",
  },
};

/** تحوّل هولوكراميّ سكتشيّ — يُرفَق على طبقات الجسم/الزجاج/الإفريز للمجسّمات؛ يُفعَّل لكلّ طبقة فقط إن طابق معرّفُها المجسّمَ المستقرّ. */
export class HoloSketchExtension extends LayerExtension {
  static extensionName = "HoloSketchExtension";
  getShaders() {
    return { modules: [holoModule] };
  }
  draw(this: Layer): void {
    const s = HOLO_STATE;
    const id = String((this.props as { id?: string }).id ?? "");
    const on = s.settledId !== "" && id.endsWith(s.settledId); // هذه الطبقة تخصّ المجسّم المستقرّ؟
    const holoT = on ? s.progress : 0;
    const p = HOLO_STYLES[s.style] ?? HOLO_STYLES.edges;
    (this as unknown as { setShaderModuleProps: (x: Record<string, unknown>) => void }).setShaderModuleProps({
      holo: { holoT, edgeK: p.edgeK, scanFreq: p.scanFreq, scanSpeed: p.scanSpeed, scanAmt: p.scanAmt, time: s.time, tintR: p.tint[0], tintG: p.tint[1], tintB: p.tint[2], alpha: p.alpha, glow: p.glow },
    });
  }
}

// نسخة مفردة مشتركة (مرجع ثابت) — تُرفَق على كلّ طبقات الجسم/الزجاج/الإفريز؛ التصريف مرّة واحدة (بلا إعادة تصريف/تخصيص).
export const HOLO_SKETCH = new HoloSketchExtension();
