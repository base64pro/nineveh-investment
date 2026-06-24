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
const PALETTES: Record<ModelKind, Palette> = {
  tower: { body: [46, 58, 78, 255], glassA: [110, 210, 245, 255], glassB: [35, 130, 190, 255], winCool: [188, 224, 248, 255], winWarm: [255, 200, 120, 255], accent: [100, 230, 255, 255] },
  mall: { body: [92, 96, 108, 255], glassA: [150, 225, 250, 255], glassB: [95, 165, 210, 255], winCool: [200, 228, 250, 255], winWarm: [255, 196, 120, 255], accent: [120, 236, 255, 255] },
  hotel: { body: [120, 110, 92, 255], glassA: [150, 200, 232, 255], glassB: [95, 150, 196, 255], winCool: [255, 228, 180, 255], winWarm: [255, 190, 110, 255], accent: [245, 206, 130, 255] },
};
const TOWER_RING: [number, number, number, number] = [60, 180, 240, 240]; // حلقات أرضية أزرق متوهّج
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
function meshLayer(id: string, mesh: Mesh3, position: [number, number, number], color: [number, number, number, number], lit: boolean, material?: object): SimpleMeshLayer {
  const attrs: Record<string, { value: Float32Array; size: number }> = {
    positions: { value: mesh.positions, size: 3 },
    normals: { value: mesh.normals, size: 3 },
  };
  if (mesh.colors && mesh.colors.length) attrs.colors = { value: mesh.colors, size: 3 }; // تدرّج/AO رأسيّ يضاعف اللون
  return new SimpleMeshLayer({
    id,
    data: [{ position }],
    mesh: { attributes: attrs } as never,
    getPosition: (d: { position: [number, number, number] }) => d.position,
    getOrientation: [0, 0, 0],
    sizeScale: 1,
    getColor: color,
    material: lit ? (material ?? MAT_BODY) : false, // مضاء بخامة Phong · أو منبعث (توهّج)
    pickable: false,
  });
}

export function buildTowerLayers(items: TowerItem[]): Layer[] {
  const layers: Layer[] = [];
  for (const it of items) {
    const position: [number, number, number] = [it.center[0], it.center[1], 0];
    // الترتيب من الأسفل للأعلى: ظلّ التماس → الحلقات → المجسّم.
    if (it.shadow && it.shadow.positions.length) layers.push(meshLayer(`tower-shadow-${it.id}`, it.shadow, position, TOWER_SHADOW, false));
    if (it.rings && it.rings.positions.length) layers.push(meshLayer(`tower-rings-${it.id}`, it.rings, position, TOWER_RING, false));
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
      const pal = PALETTES[it.kind ?? "tower"];
      layers.push(meshLayer(`tower-body-${it.id}`, m.body, position, pal.body, true));
      if (m.glassA.positions.length) layers.push(meshLayer(`tower-glassA-${it.id}`, m.glassA, position, pal.glassA, false));
      if (m.glassB.positions.length) layers.push(meshLayer(`tower-glassB-${it.id}`, m.glassB, position, pal.glassB, false));
      if (m.winCool.positions.length) layers.push(meshLayer(`tower-winC-${it.id}`, m.winCool, position, pal.winCool, false));
      if (m.winWarm.positions.length) layers.push(meshLayer(`tower-winW-${it.id}`, m.winWarm, position, pal.winWarm, false));
      if (m.accent.positions.length) layers.push(meshLayer(`tower-accent-${it.id}`, m.accent, position, pal.accent, false));
      (m.extras ?? []).forEach((ex, i) => {
        if (ex.mesh.positions.length) layers.push(meshLayer(`tower-extra-${it.id}-${i}`, ex.mesh, position, ex.color, ex.lit));
      });
    }
  }
  return layers;
}
