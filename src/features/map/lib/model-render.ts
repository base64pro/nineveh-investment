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
