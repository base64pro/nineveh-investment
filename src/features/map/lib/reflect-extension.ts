"use client";
// م9.9 (③) · انعكاس بيئة سماء **إجرائيّ تحليليّ** على الأسطح المضاءة (زجاج/هيكل) عبر LayerExtension تحقن خطّافات
// deck.gl في SimpleMeshLayer. **بلا خامة/ربط/جهاز/دورة حياة** ⇒ كلفة ضئيلة جداً (تحديث UBO موحّد/إطار فقط، لا تخصيص
// ولا إعادة تصريف)، حتميّ تماماً، ولا يُعتِم (يضيف ضوءاً فقط).
//
// آليّة الفضاء (مهمّة): خطّاف fs:DECKGL_FILTER_COLOR يُجمَّع داخل دالّة قبل تصريح varyings الطبقة (cameraPosition…)،
// فلا يمكن الإشارة إليها هناك. لذا نلتقط العاديّ ومتّجه النظر في خطّاف vs:DECKGL_FILTER_COLOR (حيث geometry.normal و
// geometry.position و project.cameraPosition متاحة — تُضبط قبل الاستدعاء في مظلّل الرأس)، ونمرّرها عبر varyings خاصّة
// بنا (vEnvNormal/vEnvView) يقرأها خطّاف الجزء فيحسب الانعكاس لكلّ جزء. يُطبَّق على المضاء فقط (هيكل + زجاج المول/الفندق)؛
// لا على المنبعث (نوافذ/توهّج/كريستال البرج) ولا الحلقات ولا الظلّ — العقد المُجمَّد محفوظ تماماً.
import { LayerExtension, project } from "@deck.gl/core";
import type { Layer } from "@deck.gl/core";
import type { ShaderModule } from "@luma.gl/shadertools";

export type EnvReflectOptions = { intensity?: number; fresnel?: number; tint?: number };

// مظلّل الرأس: varyings خاصّة تحمل العاديّ ومتّجه النظر (الفضاء المشترك) إلى الجزء.
const vs = `\
out vec3 vEnvNormal;
out vec3 vEnvView;
`;

// مظلّل الجزء: كتلة موحّدات (UBO · std140) + استقبال الـvaryings.
const fs = `\
layout(std140) uniform envReflectUniforms {
  float intensity;
  float fresnel;
  float tint;
} envReflect;
in vec3 vEnvNormal;
in vec3 vEnvView;
`;

const inject = {
  // التقاط العاديّ ومتّجه النظر في الفضاء المشترك (نفس فضاء إضاءة الطبقة) — geometry مضبوطة قبل هذا الاستدعاء.
  "vs:DECKGL_FILTER_COLOR": `
    vEnvNormal = geometry.normal;
    vEnvView = project.cameraPosition - geometry.position.xyz;
  `,
  // سماء متدرّجة من متّجه الانعكاس (z = أعلى) + حافّة فرينل لامعة. max() يمنع الإعتام؛ الإضافة لمسة زرقاء على الحوافّ.
  "fs:DECKGL_FILTER_COLOR": `
    {
      vec3 vrN = normalize(vEnvNormal);
      vec3 vrV = normalize(vEnvView);
      vec3 vrR = reflect(-vrV, vrN);
      float vrUp = clamp(vrR.z * 0.5 + 0.5, 0.0, 1.0);
      vec3 vrHorizon = vec3(0.90, 0.94, 1.00); // أفق ناصع
      vec3 vrZenith  = vec3(0.52, 0.70, 0.98); // سمت أزرق فاتح لامع
      vec3 vrSky = mix(vrHorizon, vrZenith, smoothstep(0.30, 1.0, vrUp));
      float vrFres = pow(1.0 - clamp(dot(vrN, vrV), 0.0, 1.0), max(envReflect.fresnel, 0.5));
      // البريق مطويّ داخل لون السماء (تبيضّ نحو الحوافّ المماسّة) بدل إضافة فوق-إضاءيّة تطمس الواجهة عند الزوايا الحادّة.
      vec3 vrEnv = mix(vrSky, vec3(1.0), clamp(vrFres * envReflect.tint, 0.0, 1.0));
      float vrAmt = clamp(envReflect.intensity * (0.5 + 0.5 * vrFres), 0.0, 1.0); // انعكاس قويّ ويشتدّ عند الحوافّ
      color.rgb = mix(color.rgb, max(color.rgb, vrEnv), vrAmt); // مزج محدود (≤1) ⇒ لمعان برّاق دون غسل لون المبنى لأبيض
      color.rgb = min(color.rgb, vec3(1.0)); // أمان
    }
  `,
};

const envReflectModule: ShaderModule = {
  name: "envReflect",
  dependencies: [project],
  vs,
  fs,
  inject,
  uniformTypes: { intensity: "f32", fresnel: "f32", tint: "f32" },
};

const DEFAULTS: Required<EnvReflectOptions> = { intensity: 0.9, fresnel: 2.0, tint: 0.5 };

/** انعكاس سماء إجرائيّ — يُرفَق عبر extensions على طبقات SimpleMeshLayer المضاءة فقط (الهيكل/الزجاج). */
export class EnvReflectExtension extends LayerExtension<Required<EnvReflectOptions>> {
  static extensionName = "EnvReflectExtension";
  constructor(opts: EnvReflectOptions = {}) {
    super({ ...DEFAULTS, ...opts });
  }
  getShaders() {
    return { modules: [envReflectModule] };
  }
  draw(this: Layer, _params: unknown, extension: EnvReflectExtension): void {
    const o = extension.opts;
    (this as unknown as { setShaderModuleProps: (p: Record<string, unknown>) => void }).setShaderModuleProps({
      envReflect: { intensity: o.intensity, fresnel: o.fresnel, tint: o.tint },
    });
  }
}

/** مصنع نسخ — لإعدادات مختلفة (الزجاج أقوى من الهيكل). */
export function createEnvReflect(opts: EnvReflectOptions = {}): EnvReflectExtension {
  return new EnvReflectExtension(opts);
}
// نُسَخ مشتركة (مراجع ثابتة): الزجاج لمعان زجاجيّ برّاق قويّ؛ الهيكل أهدأ وحافّيّ كي لا يُغسَل لون الواجهة.
// (intensity = قوّة الانعكاس · fresnel = حدّة تركّزه على الحوافّ · tint = ابيضاض البريق نحو الحوافّ)
export const ENV_REFLECT_GLASS = createEnvReflect({ intensity: 1.0, fresnel: 1.8, tint: 0.85 }); // زجاج كحليّ: انعكاسات **متقدّمة قصوى** + بريق حادّ برّاق
export const ENV_REFLECT_BODY = createEnvReflect({ intensity: 0.62, fresnel: 2.4, tint: 0.4 }); // الهيكل: لمعان أوضح
