"use client";

// م9.3ب · عرض النموذج ثلاثي الأبعاد المرفوع على الخريطة (محلّ الكتلة الإجرائية):
//  - glb/gltf → ScenegraphLayer (loaders.gl يحمّل الرابط ذاتياً · Draco مدعوم)
//  - stl       → SimpleMeshLayer بشبكة محلَّلة يدوياً (لا محمّل STL في loaders.gl)
// مرسىً عند مركز القطعة، بتحويل (مقياس/دوران/ارتفاع) المحفوظ. النموذج «تصوّر تصميمي».
import type { Layer, LayerExtension } from "@deck.gl/core";
import { ScenegraphLayer, SimpleMeshLayer } from "@deck.gl/mesh-layers";
import { registerLoaders } from "@loaders.gl/core";
import { GLTFLoader } from "@loaders.gl/gltf";
import { DracoWorkerLoader } from "@loaders.gl/draco";
import type { ParcelModel } from "@/features/parcels/models/model-lib";
import { fillRgba } from "./parcel-colors";
import { getTexture } from "./building/textures";
import { ENV_REFLECT_BODY, ENV_REFLECT_GLASS } from "./reflect-extension";
import { HOLO_SKETCH } from "./holo-sketch-extension";
import type { Extra, Mesh3, ModelKind, TowerMeshes } from "./parametric-tower";

let registered = false;
/** تسجيل محمّلات glTF/Draco مرّة واحدة (عميل فقط). */
export function registerModelLoaders(): void {
  if (registered) return;
  registerLoaders([GLTFLoader, DracoWorkerLoader]);
  registered = true;
}

export interface StlMesh {
  positions: Float32Array;
  normals: Float32Array;
}

/** محلِّل STL ثنائي (هيدر 80 + uint32 عدد المثلّثات + 50 بايت/مثلّث). صفر تأليف — هندسة الملف كما هي. */
export function parseBinaryStl(buf: ArrayBuffer): StlMesh {
  const dv = new DataView(buf);
  const triCount = dv.getUint32(80, true);
  const positions = new Float32Array(triCount * 9);
  const normals = new Float32Array(triCount * 9);
  let o = 84;
  for (let i = 0; i < triCount; i++) {
    const nx = dv.getFloat32(o, true);
    const ny = dv.getFloat32(o + 4, true);
    const nz = dv.getFloat32(o + 8, true);
    o += 12;
    for (let v = 0; v < 3; v++) {
      const idx = i * 9 + v * 3;
      positions[idx] = dv.getFloat32(o, true);
      positions[idx + 1] = dv.getFloat32(o + 4, true);
      positions[idx + 2] = dv.getFloat32(o + 8, true);
      normals[idx] = nx;
      normals[idx + 1] = ny;
      normals[idx + 2] = nz;
      o += 12;
    }
    o += 2; // attribute byte count
  }
  return { positions, normals };
}

export interface ModelRenderItem {
  model: ParcelModel;
  center: [number, number]; // مركز القطعة (محور الإرساء)
  mesh?: StlMesh; // مطلوبة لـstl (تُحمَّل وتُحلَّل في المكوّن)
}

/** طبقات deck للنماذج المرفوعة (نموذج لكل قطعة مفترضة لها نموذج). */
export function buildModelLayers(items: ModelRenderItem[]): Layer[] {
  const [hr, hg, hb] = fillRgba("assumed"); // لون هولوكرامي للنماذج بلا خامات (stl)
  const layers: Layer[] = [];
  for (const it of items) {
    const t = it.model.transform ?? {};
    const sizeScale = typeof t.scale === "number" ? t.scale : 1;
    const yaw = typeof t.rotationDeg === "number" ? t.rotationDeg : 0;
    const elev = typeof t.elevationM === "number" ? t.elevationM : 0;
    const position: [number, number, number] = [it.center[0], it.center[1], elev];
    if (it.model.format === "stl") {
      if (!it.mesh) continue; // بانتظار تحميل الشبكة
      layers.push(
        new SimpleMeshLayer({
          id: `model-${it.model.id}`,
          data: [{ position }],
          // deck.gl 9: الشبكة تحتاج attributes بصيغة {value,size} (لا مصفوفات مباشرة) — وإلا يتعطّل normalizeGeometryAttributes.
          mesh: {
            attributes: {
              positions: { value: it.mesh.positions, size: 3 },
              normals: { value: it.mesh.normals, size: 3 },
            },
          } as never,
          getPosition: (d: { position: [number, number, number] }) => d.position,
          getOrientation: [0, yaw, 0],
          sizeScale,
          getColor: [hr, hg, hb, 235],
          material: false, // مسطّح منبعث = طابع هولوكرامي (يناسب STL بلا خامات)
          pickable: false,
        }),
      );
    } else {
      layers.push(
        new ScenegraphLayer({
          id: `model-${it.model.id}`,
          data: [{ position }],
          scenegraph: it.model.url,
          loaders: [GLTFLoader],
          getPosition: (d: { position: [number, number, number] }) => d.position,
          getOrientation: [0, yaw, 90], // glTF محوره Y → roll 90 لتقويمه في فضاء الخريطة Z
          sizeScale,
          _lighting: "pbr",
          pickable: false,
        }),
      );
    }
  }
  return layers;
}

// م9.7.1ج · البرج البارامتري: طبقتان لكل برج — الجسم (أزرق غامق، مضاء بالـLightingEffect فيقرأ صلباً ثلاثياً)
// والنوافذ (سماوية منبعثة `material:false` فتتوهّج كالنوافذ المضيئة). أغمق من الحلقات وفوقها.
export interface TowerItem {
  id: string;
  center: [number, number]; // مركز القطعة (lng,lat)
  meshes?: TowerMeshes; // النموذج الإجرائيّ (احتياطيّ)
  glb?: { url: string; sizeScale: number; yaw: number; elevationM?: number; scale?: [number, number, number]; lighting?: "flat" | "pbr" }; // م9.7.5/م9.11 · نموذج واقعيّ glb (scale = أبعاد لكلّ محور · lighting=flat ⇒ سطوع كامل مستقلّ عن الإضاءة العامّة)
  base?: { mesh: Mesh3; color: RGBA }; // م9.11 · قاعدة/أساس بسُمك تحت الـglb (يملأ الفجوة فيلتصق بالأرض)
  kind?: ModelKind; // م9.7.2 · نوع النموذج (لاختيار لوحة الألوان)
  yaw?: number; // م9.7.8 · توجيه المجسّم (دوران حول المحور الرأسيّ، درجات)
  instances?: { center: [number, number]; yaw: number }[]; // م9.9 (B1) · نُسخ متعدّدة بنفس الشبكة — تُرسَم instanced (نداء رسم واحد/سطح بدل N)
  rings?: Mesh3; // م9.7.1هـ · حلقات أرضية متوهّجة تملأ القطعة (تحت البرج)
  ringSpread?: { min: number; max: number }; // م9.11 · مدى تمدّد الموجة (×نصف القطر): للنموذج الواقعيّ تبدأ من حول قاعدته للخارج فلا تغطّي بلاط الساحة
  shadow?: Mesh3; // م9.7.1و+ · ظلّ تماسٍ أرضيّ مُخبوز (أسفل كلّ شيء)
}
type RGBA = [number, number, number, number];
interface Palette {
  body: RGBA;
  glassA: RGBA;
  glassB: RGBA;
  winCool: RGBA;
  winWarm: RGBA;
  accent: RGBA;
}
// لوحات حسب النوع — هويّة بصريّة متمايزة (ليست أزرق موحّداً): برج بارد · مول محايد بلافتات · فندق دافئ فاخر.
// الزجاج الآن «مضاء لمّاع» (يُظلَّل ثلاثياً) لا منبعثاً — ألوانه أغمق إذ تُضيئها الإضاءة؛ التوهّج يأتي من النوافذ/الحلقة المنبعثة.
const PALETTES: Record<ModelKind, Palette> = {
  // م9.8 · الثيمة على البرج: هيكل أزرق مطفأ (بلا لمعان) + زجاج **أزرق أعمق لامع** (لمعان زجاج فقط)
  tower: { body: [150, 182, 216, 255], glassA: [60, 148, 222, 255], glassB: [26, 116, 210, 255], winCool: [200, 234, 255, 255], winWarm: [255, 214, 160, 255], accent: [110, 220, 255, 255] },
  // م9.8 · body = حجر/كونكريت **أبيض** · glassA = زجاج رؤية أزرق شفّاف · glassB = ألواح نوافذ **زرقاء براقة** · accent = أحزمة كحليّة-سماويّة
  mall: { body: [242, 242, 244, 255], glassA: [120, 196, 242, 150], glassB: [56, 146, 224, 255], winCool: [206, 236, 255, 255], winWarm: [255, 206, 138, 255], accent: [120, 224, 255, 255] },
  // م9.8 · الثيمة على الفندق (منتجع فاخر): هيكل كريميّ دافئ فاتح + زجاج أزرق منقّى + تتويج **ذهبيّ** (هويّة المنتجع)
  hotel: { body: [226, 214, 192, 255], glassA: [120, 168, 206, 255], glassB: [86, 140, 186, 255], winCool: [255, 234, 190, 255], winWarm: [255, 200, 122, 255], accent: [252, 216, 142, 255] },
};
const TOWER_SHADOW: [number, number, number, number] = [2, 6, 14, 140]; // ظلّ تماسٍ داكن شفّاف (أوضح)
// م9.9 · زجاج موحّد لكلّ المباني = **أزرق القبّة الكريستاليّ المنبعث** (نغمة crystal [96,172,255])، مع انعكاس سماء برّاق ⇒ لامع مبهر.
const GLASS_BLUE_A: [number, number, number, number] = [58, 112, 206, 255]; // زجاج أزرق **مائل للكحليّ** لامع (رؤية)
const GLASS_BLUE_B: [number, number, number, number] = [34, 80, 180, 255]; // ألواح كحليّة أعمق (تباين)

// م9.7.5 · مكتبة النماذج الواقعية حسب النوع (glb احترافيّة CC0 في public/models) — تحلّ محلّ الإجرائيّ.
// footprint = أكبر بُعد أفقيّ (glTF X/Z) · height = بُعد Y — لحساب مقياس الملاءمة في الخريطة.
export const TYPE_MODELS: Record<ModelKind, { url: string; footprint: number; height: number }> = {
  tower: { url: "/models/tower.glb", footprint: 1.39, height: 5.47 },
  mall: { url: "/models/mall.glb", footprint: 2.08, height: 1.69 },
  hotel: { url: "/models/hotel.glb", footprint: 1.24, height: 3.15 },
};

// م9.7.6 · خامات Phong حسب السطح (لمعان الزجاج · مطّ الهيكل) — تُطبَّق على المضاء فقط.
const MAT_BODY = { ambient: 0.32, diffuse: 0.82, shininess: 70, specularColor: [200, 212, 230] as [number, number, number] };
// م9.9 · لمعان قويّ على الهياكل (والبلاط الكرستاليّ يستخدم هذه الخامة) — بريق حادّ ساطع ⇒ سطح لامع حقيقيّ ثلاثيّ الأبعاد (بلا ظلال).
const MAT_BODY_BY_KIND: Record<ModelKind, typeof MAT_BODY> = {
  tower: { ambient: 0.5, diffuse: 0.8, shininess: 58, specularColor: [205, 220, 240] }, // هيكل أزرق لامع
  mall: { ambient: 0.4, diffuse: 0.8, shininess: 62, specularColor: [210, 218, 230] },
  hotel: { ambient: 0.46, diffuse: 0.76, shininess: 56, specularColor: [246, 232, 205] }, // كريميّ دافئ لامع
};
// م9.9 (B1) · موضع نسخة واحدة (مركز + توجيه). نسخة مفردة = مصفوفة بعنصر واحد؛ نُسخ متعدّدة = instanced بنداء رسم واحد.
type Placement = { position: [number, number, number]; yaw: number };
function meshLayer(id: string, mesh: Mesh3, placements: Placement[], color: [number, number, number, number], lit: boolean, material?: object, texture?: string, reflect?: LayerExtension, holo?: LayerExtension): SimpleMeshLayer {
  const attrs: Record<string, { value: Float32Array; size: number }> = {
    positions: { value: mesh.positions, size: 3 },
    normals: { value: mesh.normals, size: 3 },
  };
  if (mesh.colors && mesh.colors.length) attrs.colors = { value: mesh.colors, size: 3 }; // تدرّج/AO رأسيّ يضاعف اللون
  const useTex = texture && mesh.texCoords && mesh.texCoords.length;
  if (useTex) attrs.texCoords = { value: mesh.texCoords as Float32Array, size: 2 }; // م9.8 · إحداثيّات الخامة
  return new SimpleMeshLayer({
    id,
    data: placements,
    mesh: { attributes: attrs } as never,
    getPosition: (d: Placement) => d.position,
    getOrientation: (d: Placement) => [0, d.yaw, 0], // م9.7.8/م9.9 · توجيه كلّ نسخة حول المحور الرأسيّ
    sizeScale: 1,
    getColor: color,
    ...(useTex ? { texture } : {}), // خامة إجرائيّة تُضاعَف باللون والإضاءة
    material: lit ? (material ?? MAT_BODY) : false, // مضاء بخامة Phong · أو منبعث (توهّج)
    extensions: [reflect, holo].filter(Boolean) as LayerExtension[], // م9.9 (③) انعكاس سماء + م9.14 (③) تحوّل هولوكراميّ — يتعايشان (وحدتا مظلّل منفصلتان بنفس الخطّاف)

    pickable: false,
  });
}

// م9.9 (B2) · دمج المرافق المعتمة في نداءات رسم أقلّ — **بلا أيّ تغيير بصريّ**.
// نُمرّر على extras بترتيبها، ونجمع **التتابعات المتّصلة** من المرافق المعتمة (alpha=255) غير المكسوّة في mesh
// واحد (مفصول lit/منبعث لاختلاف الخامة)، بخبز لون كلّ مرفق في ألوان رأسه (grayscale×color/255) وgetColor=أبيض.
// المعتم يُختبَر عمقياً ⇒ ترتيبه داخل التتابع لا يؤثّر؛ والمرافق الشفّافة/المكسوّة تبقى طبقات مفردة **بموضعها الأصليّ بالضبط**
// فلا يتغيّر ترتيب المزج معتم↔شفّاف. النتيجة مخبّأة بمرجع مصفوفة extras (WeakMap) فتبقى مراجع Float32Array ثابتة (لا رفع GPU متكرّر).
type ExtraOp = { idSuffix: string; mesh: Mesh3; color: [number, number, number, number]; lit: boolean; tex?: string };
const WHITE_RGBA: [number, number, number, number] = [255, 255, 255, 255];
const extrasOpsCache = new WeakMap<readonly Extra[], ExtraOp[]>();
function bakeRun(run: { P: number[]; N: number[]; C: number[] }): Mesh3 {
  return { positions: new Float32Array(run.P), normals: new Float32Array(run.N), colors: new Float32Array(run.C) };
}
function extrasRenderOps(extras: readonly Extra[]): ExtraOp[] {
  const hit = extrasOpsCache.get(extras);
  if (hit) return hit;
  const ops: ExtraOp[] = [];
  let runLit: { P: number[]; N: number[]; C: number[] } | null = null;
  let runEmis: { P: number[]; N: number[]; C: number[] } | null = null;
  let runIdx = 0;
  const flush = (): void => {
    if (runLit) ops.push({ idSuffix: `M${runIdx}l`, mesh: bakeRun(runLit), color: WHITE_RGBA, lit: true });
    if (runEmis) ops.push({ idSuffix: `M${runIdx}e`, mesh: bakeRun(runEmis), color: WHITE_RGBA, lit: false });
    if (runLit || runEmis) runIdx++;
    runLit = null;
    runEmis = null;
  };
  extras.forEach((ex, i) => {
    if (!ex.mesh.positions.length) return; // فارغ — لا طبقة (مطابق للسابق)
    const mergeable = ex.color[3] === 255 && !ex.tex && !!ex.mesh.colors && ex.mesh.colors.length === ex.mesh.positions.length;
    if (!mergeable) {
      flush(); // اقطع التتابع قبل أيّ مرفق شفّاف/مكسوّ — صون ترتيب المزج
      ops.push({ idSuffix: `${i}`, mesh: ex.mesh, color: ex.color, lit: ex.lit, tex: ex.tex });
      return;
    }
    if (ex.lit) { if (!runLit) runLit = { P: [], N: [], C: [] }; }
    else if (!runEmis) runEmis = { P: [], N: [], C: [] };
    const buf = ex.lit ? (runLit as { P: number[]; N: number[]; C: number[] }) : (runEmis as { P: number[]; N: number[]; C: number[] });
    const P = ex.mesh.positions;
    const N = ex.mesh.normals;
    const C = ex.mesh.colors as Float32Array;
    const r = ex.color[0] / 255;
    const g = ex.color[1] / 255;
    const b = ex.color[2] / 255;
    for (let v = 0; v < P.length; v += 3) {
      buf.P.push(P[v]!, P[v + 1]!, P[v + 2]!);
      buf.N.push(N[v]!, N[v + 1]!, N[v + 2]!);
      buf.C.push(C[v]! * r, C[v + 1]! * g, C[v + 2]! * b);
    }
  });
  flush();
  extrasOpsCache.set(extras, ops);
  return ops;
}

export function buildTowerLayers(items: TowerItem[]): Layer[] {
  const layers: Layer[] = [];
  for (const it of items) {
    // م9.9 (B1) · مواضع النُسخ: نسخة مفردة من center/yaw، أو عدّة نُسخ instanced بنفس الشبكة (نداء رسم واحد/سطح).
    const placements: Placement[] =
      it.instances && it.instances.length ? it.instances.map((ins) => ({ position: [ins.center[0], ins.center[1], 0] as [number, number, number], yaw: ins.yaw })) : [{ position: [it.center[0], it.center[1], 0] as [number, number, number], yaw: it.yaw ?? 0 }];
    // الترتيب من الأسفل للأعلى: ظلّ التماس → المجسّم. (الحلقات تُرسَم نابضةً منفصلةً عبر buildRingLayers — تحت المجسّم.)
    if (it.shadow && it.shadow.positions.length) layers.push(meshLayer(`tower-shadow-${it.id}`, it.shadow, placements, TOWER_SHADOW, false));
    if (it.base && it.base.mesh.positions.length) layers.push(meshLayer(`tower-base-${it.id}`, it.base.mesh, placements, it.base.color, true)); // م9.11 · أساس تحت الـglb (يصله بالأرض)
    if (it.glb) {
      // م9.7.5 · نموذج واقعيّ glb (PBR) محلّ الإجرائيّ — glTF محوره Y → roll 90 لتقويمه في Z
      layers.push(
        new ScenegraphLayer({
          id: `tower-glb-${it.id}`,
          data: [{ position: [it.center[0], it.center[1], it.glb.elevationM ?? 0] as [number, number, number] }],
          scenegraph: it.glb.url,
          loaders: [GLTFLoader],
          getPosition: (d: { position: [number, number, number] }) => d.position,
          getOrientation: [0, it.glb.yaw, 90],
          getScale: it.glb.scale ?? [1, 1, 1], // م9.11 · أبعاد لكلّ محور (عرض/ارتفاع/عمق) — للتحكّم اليدويّ
          sizeScale: it.glb.sizeScale,
          _lighting: it.glb.lighting ?? "pbr", // م9.11 · flat للهيئة ⇒ سطوع مستقلّ (تبقى مضيئة وإن عادت الإضاءة العامّة لأصلها)
          // م9.14 · لا تحوّل هولوكراميّ على مبنى الهيئة (glb) — يبقى بخامته الواقعيّة (طلب المستخدم)
          pickable: false,
        }),
      );
    } else if (it.meshes) {
      const m = it.meshes;
      const k = it.kind ?? "tower";
      const pal = PALETTES[k];
      if (m.body.positions.length) layers.push(meshLayer(`tower-body-${it.id}`, m.body, placements, pal.body, true, MAT_BODY_BY_KIND[k], getTexture("facade"), ENV_REFLECT_BODY, HOLO_SKETCH)); // واجهة مكسوّة — انعكاس سماء + تحوّل هولوكراميّ (يُفعَّل للمستقرّ فقط)
      // م9.9 · زجاج كلّ المباني = **أزرق القبّة الكريستاليّ المنبعث** (مضيء، نفس مادّة القبّة) + انعكاس سماء برّاق ⇒ لامع مبهر مثل القبّة.
      if (m.glassA.positions.length) layers.push(meshLayer(`tower-glassA-${it.id}`, m.glassA, placements, GLASS_BLUE_A, false, undefined, undefined, ENV_REFLECT_GLASS, HOLO_SKETCH));
      if (m.glassB.positions.length) layers.push(meshLayer(`tower-glassB-${it.id}`, m.glassB, placements, GLASS_BLUE_B, false, undefined, undefined, ENV_REFLECT_GLASS, HOLO_SKETCH));
      if (m.winCool.positions.length) layers.push(meshLayer(`tower-winC-${it.id}`, m.winCool, placements, pal.winCool, false, undefined, undefined, undefined, HOLO_SKETCH));
      if (m.winWarm.positions.length) layers.push(meshLayer(`tower-winW-${it.id}`, m.winWarm, placements, pal.winWarm, false, undefined, undefined, undefined, HOLO_SKETCH));
      if (m.accent.positions.length) layers.push(meshLayer(`tower-accent-${it.id}`, m.accent, placements, pal.accent, false, undefined, undefined, undefined, HOLO_SKETCH));
      for (const op of extrasRenderOps(m.extras ?? [])) {
        // م9.14 · المعرّف ينتهي بـref_id (يطابقه حارس الهولو endsWith)؛ الهولو يشمل **كلّ المرافق/الحدائق/الممرّات الملحقة**
        layers.push(meshLayer(`tower-extra-${op.idSuffix}-${it.id}`, op.mesh, placements, op.color, op.lit, undefined, op.tex ? getTexture(op.tex) : undefined, undefined, HOLO_SKETCH));
      }
    }
  }
  return layers;
}

// م9.9 · حلقات سونار **بيضاء خفيفة**: **طبقة instanced واحدة لكلّ موقع** تضمّ كلّ الموجات كـ«نُسخ» — لكلّ نسخة **مقياسها
// وشفافيّتها** (getScale/getColor)؛ يضمن deck قيماً مستقلّة لكلّ حلقة ⇒ **حلقة تتبع حلقة بتدفّق مستمرّ لا ينقطع**.
// لونها أبيض بمزج عاديّ + شبكة بأرضيّة سطوع عالية ⇒ **توهّج أبيض خفيف بلا أسود/إعتام** (المزج الجمعيّ لا يُطبَّق في وضع deck المتراكب).
const RING_RGB: [number, number, number] = [242, 248, 255]; // أبيض متوهّج بمسحة زرقاء **خفيفة جداً** — لا تُعتِم
const RING_WAVES = 6; // حلقات أقلّ ⇒ تباعد أكبر بينها (تأخير الانبثاق)
// م9.9 · حلقات فرعيّة متراكبة لكلّ موجة بشفافيّة متدرّجة ⇒ الحافّة الداخليّة والخارجيّة **تتلاشيان بنعومة** (لا حافّة حادّة).
const RING_SUB: { d: number; f: number }[] = [
  { d: -0.08, f: 0.1 }, // الحافّة الداخليّة — خافتة (تتلاشى) — تباعد مضاعَف (×٢ سُمك)
  { d: -0.04, f: 0.42 },
  { d: 0, f: 1 }, // القلب — أنصع
  { d: 0.04, f: 0.42 },
  { d: 0.08, f: 0.1 }, // الحافّة الخارجيّة — خافتة (تتلاشى)
];
export function buildRingLayers(items: TowerItem[], phase: number): Layer[] {
  const layers: Layer[] = [];
  for (const it of items) {
    if (!it.rings || !it.rings.positions.length || !it.rings.colors) continue;
    const position: [number, number, number] = [it.center[0], it.center[1], 0];
    // نُسخ: لكلّ موجة عدّة حلقات فرعيّة متراكبة (مقياس + شفافيّة مستقلّان) ⇒ نطاق ناعم يتلاشى عند حافّتيه + تدفّق مستقلّ لكلّ موجة.
    const rMin = it.ringSpread?.min ?? 0.25; // م9.11 · بداية تمدّد الموجة (الافتراضيّ من المركز؛ النموذج الواقعيّ يبدأ من حول قاعدته)
    const rMax = it.ringSpread?.max ?? 1.9;
    const waves: { s: number; a: number }[] = [];
    for (let wv = 0; wv < RING_WAVES; wv++) {
      const p = (phase + wv / RING_WAVES) % 1;
      const baseS = rMin + (rMax - rMin) * p; // نصف القطر يتباعد بوتيرة ثابتة سلسة ضمن المدى
      const baseA = 165 * Math.min(1, p / 0.08) * Math.pow(1 - p, 0.85); // م9.17 · ذروة أخفض (شفافيّة أعلى — حدّة أقلّ)
      for (const sub of RING_SUB) waves.push({ s: baseS * (1 + sub.d), a: Math.round(baseA * sub.f) });
    }
    layers.push(
      new SimpleMeshLayer({
        id: `ring-${it.id}`,
        data: waves,
        mesh: { attributes: { positions: { value: it.rings.positions, size: 3 }, normals: { value: it.rings.normals, size: 3 }, colors: { value: it.rings.colors, size: 3 } } } as never,
        getPosition: () => position, // كلّ النُسخ في مركز الموقع
        getOrientation: [0, 0, 0],
        getScale: (d: { s: number }) => [d.s, d.s, d.s], // نصف قطر كلّ موجة (مستقلّ)
        getColor: (d: { a: number }) => [RING_RGB[0], RING_RGB[1], RING_RGB[2], d.a], // أبيض بشفافيّة كلّ موجة (مستقلّة)
        material: false, // منبعث (بلا تظليل) + مزج عاديّ شفّاف (deck الافتراضيّ) ⇒ أبيض خفيف بلا إعتام
        shadowEnabled: false, // لا تُلقي الحلقات ظلّاً
        updateTriggers: { getScale: phase, getColor: phase }, // إعادة تقييم لكلّ إطار مع تقدّم الطور
        pickable: false,
      }),
    );
  }
  return layers;
}
