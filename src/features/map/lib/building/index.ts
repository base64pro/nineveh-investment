// م9.8 · مكتبة البناء — الواجهة العامّة. هذا الباريل هو نقطة الاستيراد الوحيدة لبقيّة التطبيق.
// المعماريّة: types → geom → materials/facade → recipes → ground (طبقات قابلة للتوسّع: components/ + facilities/).
export type { Mesh3, Extra, TowerMeshes, ModelKind, MaterialId, MaterialRole, MaterialDef, PhongParams } from "./types";
export { generateModel, generateTower, generateMall, generateHotel, generateGardenStrip } from "./recipes";
export { generateGroundRings, generateContactShadow, generateFoundation } from "./ground";
export { MATERIALS, matColor, matLit, matPhong } from "./materials";
