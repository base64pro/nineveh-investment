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
import type { Mesh3, TowerMeshes } from "./parametric-tower";

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
  meshes: TowerMeshes;
  rings?: Mesh3; // م9.7.1هـ · حلقات أرضية متوهّجة تملأ القطعة (تحت البرج)
  shadow?: Mesh3; // م9.7.1و+ · ظلّ تماسٍ أرضيّ مُخبوز (أسفل كلّ شيء)
}
const TOWER_BODY: [number, number, number, number] = [46, 58, 78, 255]; // هيكل فولاذي أزرق-رماديّ مضاء (تظليل 3D · أغمق من الزجاج)
const GLASS_A: [number, number, number, number] = [110, 210, 245, 255]; // زجاج سماوي فاتح منبعث (نغمة 1)
const GLASS_B: [number, number, number, number] = [35, 130, 190, 255]; // زجاج أزرق غامق منبعث (نغمة 2)
const WIN_COOL: [number, number, number, number] = [188, 224, 248, 255]; // نوافذ مضيئة سماوية (حياة)
const WIN_WARM: [number, number, number, number] = [255, 200, 120, 255]; // نوافذ مضيئة دافئة (تنوّع لوني)
const TOWER_ACCENT: [number, number, number, number] = [100, 230, 255, 255]; // حلقة/خطوط مميِّزة منبعثة (هوية)
const TOWER_RING: [number, number, number, number] = [60, 180, 240, 240]; // حلقات أرضية أزرق متوهّج
const TOWER_SHADOW: [number, number, number, number] = [4, 10, 20, 95]; // ظلّ تماسٍ داكن شفّاف

function meshLayer(id: string, mesh: Mesh3, position: [number, number, number], color: [number, number, number, number], lit: boolean): SimpleMeshLayer {
  return new SimpleMeshLayer({
    id,
    data: [{ position }],
    mesh: { attributes: { positions: { value: mesh.positions, size: 3 }, normals: { value: mesh.normals, size: 3 } } } as never,
    getPosition: (d: { position: [number, number, number] }) => d.position,
    getOrientation: [0, 0, 0],
    sizeScale: 1,
    getColor: color,
    material: lit, // مضاء (تظليل واقعي) أو منبعث (توهّج هولوكرامي)
    pickable: false,
  });
}

export function buildTowerLayers(items: TowerItem[]): Layer[] {
  const layers: Layer[] = [];
  for (const it of items) {
    const position: [number, number, number] = [it.center[0], it.center[1], 0];
    const m = it.meshes;
    // الترتيب من الأسفل للأعلى: ظلّ التماس → الحلقات → الهيكل (مضاء) → الزجاج/النوافذ/الحلقة المميِّزة (منبعثة).
    if (it.shadow && it.shadow.positions.length) layers.push(meshLayer(`tower-shadow-${it.id}`, it.shadow, position, TOWER_SHADOW, false));
    if (it.rings && it.rings.positions.length) layers.push(meshLayer(`tower-rings-${it.id}`, it.rings, position, TOWER_RING, false));
    layers.push(meshLayer(`tower-body-${it.id}`, m.body, position, TOWER_BODY, true)); // الهيكل (مضاء — تظليل 3D)
    if (m.glassA.positions.length) layers.push(meshLayer(`tower-glassA-${it.id}`, m.glassA, position, GLASS_A, false));
    if (m.glassB.positions.length) layers.push(meshLayer(`tower-glassB-${it.id}`, m.glassB, position, GLASS_B, false));
    if (m.winCool.positions.length) layers.push(meshLayer(`tower-winC-${it.id}`, m.winCool, position, WIN_COOL, false));
    if (m.winWarm.positions.length) layers.push(meshLayer(`tower-winW-${it.id}`, m.winWarm, position, WIN_WARM, false));
    if (m.accent.positions.length) layers.push(meshLayer(`tower-accent-${it.id}`, m.accent, position, TOWER_ACCENT, false));
  }
  return layers;
}
