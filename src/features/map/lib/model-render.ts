"use client";

// م9.3ب · عرض النموذج ثلاثي الأبعاد المرفوع على الخريطة (محلّ الكتلة الإجرائية):
//  - glb/gltf → ScenegraphLayer (loaders.gl يحمّل الرابط ذاتياً · Draco مدعوم)
//  - stl       → SimpleMeshLayer بشبكة محلَّلة يدوياً (لا محمّل STL في loaders.gl)
// مرسىً عند مركز القطعة، بتحويل (مقياس/دوران/ارتفاع) المحفوظ. النموذج «تصوّر تصميمي».
import type { Layer } from "@deck.gl/core";
import { ScenegraphLayer, SimpleMeshLayer } from "@deck.gl/mesh-layers";
import { registerLoaders } from "@loaders.gl/core";
import { GLTFLoader } from "@loaders.gl/gltf";
import { DracoWorkerLoader } from "@loaders.gl/draco";
import type { ParcelModel } from "@/features/parcels/models/model-lib";
import { fillRgba } from "./parcel-colors";
import { getTexture } from "./building/textures";
import type { Mesh3, ModelKind, TowerMeshes } from "./parametric-tower";

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
  glb?: { url: string; sizeScale: number; yaw: number; elevationM?: number }; // م9.7.5 · نموذج واقعيّ glb (يُفضَّل)
  kind?: ModelKind; // م9.7.2 · نوع النموذج (لاختيار لوحة الألوان)
  yaw?: number; // م9.7.8 · توجيه المجسّم (دوران حول المحور الرأسيّ، درجات)
  rings?: Mesh3; // م9.7.1هـ · حلقات أرضية متوهّجة تملأ القطعة (تحت البرج)
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
const MAT_GLASS = { ambient: 0.55, diffuse: 0.46, shininess: 160, specularColor: [190, 232, 255] as [number, number, number] }; // زجاج لمّاع عالي البريق
// م9.8 (الثيمة) · زجاج لكل نوع — البرج **أهدأ لمعاناً** (طلب المستخدم: تقليل لمعان البرج)؛ المول/الفندق بالبريق العالي.
const MAT_GLASS_BY_KIND: Record<ModelKind, typeof MAT_GLASS> = {
  tower: { ambient: 0.56, diffuse: 0.46, shininess: 140, specularColor: [180, 225, 255] }, // زجاج أزرق مبهر
  mall: MAT_GLASS,
  hotel: MAT_GLASS,
};
const TOWER_CRYSTAL: [number, number, number, number] = [96, 172, 255, 240]; // مادّة المكعّب الكريستاليّ المنبعث (= زجاج طوابق البرج)
const TOWER_RING: [number, number, number, number] = [100, 165, 205, 255]; // حلقات أرضية أزرق هولوكراميّ أهدأ (حدّة لون أقلّ — م9.7.11)
const TOWER_SHADOW: [number, number, number, number] = [2, 6, 14, 140]; // ظلّ تماسٍ داكن شفّاف (أوضح)

// م9.7.5 · مكتبة النماذج الواقعية حسب النوع (glb احترافيّة CC0 في public/models) — تحلّ محلّ الإجرائيّ.
// footprint = أكبر بُعد أفقيّ (glTF X/Z) · height = بُعد Y — لحساب مقياس الملاءمة في الخريطة.
export const TYPE_MODELS: Record<ModelKind, { url: string; footprint: number; height: number }> = {
  tower: { url: "/models/tower.glb", footprint: 1.39, height: 5.47 },
  mall: { url: "/models/mall.glb", footprint: 2.08, height: 1.69 },
  hotel: { url: "/models/hotel.glb", footprint: 1.24, height: 3.15 },
};

// م9.7.6 · خامات Phong حسب السطح (لمعان الزجاج · مطّ الهيكل) — تُطبَّق على المضاء فقط.
const MAT_BODY = { ambient: 0.32, diffuse: 0.86, shininess: 18, specularColor: [70, 80, 95] as [number, number, number] };
// م9.8 · خامة هيكل لكل نوع — هويّة سطح متمايزة: برج بارد لمّاع · مول أحيد · فندق أدفأ أنعم.
const MAT_BODY_BY_KIND: Record<ModelKind, typeof MAT_BODY> = {
  tower: { ambient: 0.52, diffuse: 0.82, shininess: 4, specularColor: [96, 110, 130] }, // هيكل أزرق مطفأ (بلا لمعان)
  mall: { ambient: 0.4, diffuse: 0.82, shininess: 14, specularColor: [120, 124, 132] },
  hotel: { ambient: 0.46, diffuse: 0.78, shininess: 12, specularColor: [190, 178, 156] }, // كريميّ دافئ فاتح
};
function meshLayer(id: string, mesh: Mesh3, position: [number, number, number], color: [number, number, number, number], lit: boolean, material?: object, yaw = 0, texture?: string): SimpleMeshLayer {
  const attrs: Record<string, { value: Float32Array; size: number }> = {
    positions: { value: mesh.positions, size: 3 },
    normals: { value: mesh.normals, size: 3 },
  };
  if (mesh.colors && mesh.colors.length) attrs.colors = { value: mesh.colors, size: 3 }; // تدرّج/AO رأسيّ يضاعف اللون
  const useTex = texture && mesh.texCoords && mesh.texCoords.length;
  if (useTex) attrs.texCoords = { value: mesh.texCoords as Float32Array, size: 2 }; // م9.8 · إحداثيّات الخامة
  return new SimpleMeshLayer({
    id,
    data: [{ position }],
    mesh: { attributes: attrs } as never,
    getPosition: (d: { position: [number, number, number] }) => d.position,
    getOrientation: [0, yaw, 0], // م9.7.8 · توجيه المجسّم حول المحور الرأسيّ
    sizeScale: 1,
    getColor: color,
    ...(useTex ? { texture } : {}), // خامة إجرائيّة تُضاعَف باللون والإضاءة
    material: lit ? (material ?? MAT_BODY) : false, // مضاء بخامة Phong · أو منبعث (توهّج)
    pickable: false,
  });
}

export function buildTowerLayers(items: TowerItem[]): Layer[] {
  const layers: Layer[] = [];
  for (const it of items) {
    const position: [number, number, number] = [it.center[0], it.center[1], 0];
    // الترتيب من الأسفل للأعلى: ظلّ التماس → المجسّم. (الحلقات تُرسَم نابضةً منفصلةً عبر buildRingLayers — تحت المجسّم.)
    if (it.shadow && it.shadow.positions.length) layers.push(meshLayer(`tower-shadow-${it.id}`, it.shadow, position, TOWER_SHADOW, false));
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
          sizeScale: it.glb.sizeScale,
          _lighting: "pbr",
          pickable: false,
        }),
      );
    } else if (it.meshes) {
      const m = it.meshes;
      const k = it.kind ?? "tower";
      const pal = PALETTES[k];
      const y = it.yaw ?? 0; // توجيه المجسّم
      if (m.body.positions.length) layers.push(meshLayer(`tower-body-${it.id}`, m.body, position, pal.body, true, MAT_BODY_BY_KIND[k], y, getTexture("facade"))); // واجهة مكسوّة (الجسم قد يكون فارغاً لكيان حديقة الممرّ)
      if (m.glassA.positions.length) {
        if (k === "tower") layers.push(meshLayer(`tower-glassA-${it.id}`, m.glassA, position, TOWER_CRYSTAL, false, undefined, y)); // زجاج الطوابق = مادّة المكعّب الكريستاليّ المنبعث
        else { layers.push(meshLayer(`tower-glassA-${it.id}`, m.glassA, position, pal.glassA, true, MAT_GLASS_BY_KIND[k], y, getTexture("glass"))); layers.push(meshLayer(`tower-glowA-${it.id}`, m.glassA, position, [Math.min(255, pal.glassA[0] + 75), Math.min(255, pal.glassA[1] + 90), Math.min(255, pal.glassA[2] + 85), 125], false, undefined, y)); }
      }
      if (m.glassB.positions.length) {
        if (k === "tower") layers.push(meshLayer(`tower-glassB-${it.id}`, m.glassB, position, TOWER_CRYSTAL, false, undefined, y));
        else { layers.push(meshLayer(`tower-glassB-${it.id}`, m.glassB, position, pal.glassB, true, MAT_GLASS_BY_KIND[k], y, getTexture("glass"))); layers.push(meshLayer(`tower-glowB-${it.id}`, m.glassB, position, [Math.min(255, pal.glassB[0] + 55), Math.min(255, pal.glassB[1] + 75), Math.min(255, pal.glassB[2] + 30), 110], false, undefined, y)); }
      }
      if (m.winCool.positions.length) layers.push(meshLayer(`tower-winC-${it.id}`, m.winCool, position, pal.winCool, false, undefined, y));
      if (m.winWarm.positions.length) layers.push(meshLayer(`tower-winW-${it.id}`, m.winWarm, position, pal.winWarm, false, undefined, y));
      if (m.accent.positions.length) layers.push(meshLayer(`tower-accent-${it.id}`, m.accent, position, pal.accent, false, undefined, y));
      (m.extras ?? []).forEach((ex, i) => {
        if (ex.mesh.positions.length) layers.push(meshLayer(`tower-extra-${it.id}-${i}`, ex.mesh, position, ex.color, ex.lit, undefined, y, ex.tex ? getTexture(ex.tex) : undefined));
      });
    }
  }
  return layers;
}

// م9.7.7 · حلقات نابضة منفصلة تحت المجسّم — تتدفّق من قلبه نحو الخارج (موجتان متعاقبتان)، تظهر فقط بعد تجاوز حدوده.
// phase ∈ [0,1) من حلقة الرسم؛ الحلقة الأساس بنصف قطر بصمة المجسّم، تتمدّد بالمقياس وتتلاشى.
export function buildRingLayers(items: TowerItem[], phase: number): Layer[] {
  const layers: Layer[] = [];
  for (const it of items) {
    if (!it.rings || !it.rings.positions.length) continue;
    const position: [number, number, number] = [it.center[0], it.center[1], 0];
    const WAVES = 3;
    for (let wv = 0; wv < WAVES; wv++) {
      const p = (phase + wv / WAVES) % 1; // موجات متعاقبة لتدفّق مستمرّ
      const ss = 1.0 + 1.7 * p; // من حدّ بصمة المجسّم (1×) نحو الخارج (2.7×) — لا تدخل تحت جسمه أبداً (نفس تساريع التمدّد)
      const a = Math.round(180 * Math.pow(Math.sin(Math.PI * p), 1.35)); // أهدأ وأشفّ + غلاف أنعم: ظهور/تلاشٍ سلس مريح (ذروة ١٨٠/٢٥٥ بدل ٢٣٥)
      layers.push(
        new SimpleMeshLayer({
          id: `ring-${it.id}-${wv}`,
          data: [{ position }],
          mesh: { attributes: { positions: { value: it.rings.positions, size: 3 }, normals: { value: it.rings.normals, size: 3 } } } as never,
          getPosition: (d: { position: [number, number, number] }) => d.position,
          getOrientation: [0, 0, 0],
          sizeScale: ss,
          getColor: [TOWER_RING[0], TOWER_RING[1], TOWER_RING[2], a],
          material: false,
          pickable: false,
        }),
      );
    }
  }
  return layers;
}
