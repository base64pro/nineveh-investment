// م9.8 · انتقلت مكتبة المجسّمات إلى ./building (مكتبة طبقيّة بمعماريّة برمجية قوية + وصف ممنهج docs/مكتبة_البناء.md).
// هذا الملف shim إعادة تصدير — صفر كسر لمواقع الاستيراد الحالية (model-render · investment-map · model-lib · parametric-section).
export type { Mesh3, Extra, TowerMeshes, ModelKind } from "./building";
export { generateModel, generateTower, generateMall, generateHotel, generateGardenStrip, generateGroundRings, generateContactShadow, generateFoundation } from "./building";
