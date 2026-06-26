// م9.8 · سجلّ الخامات — مصدر الحقيقة لهويّة كل سطح (لون + دور إضاءة + وسائط Phong).
// القيم تطابق ألوان المولّد الحالية كي تبقى الوصفات متطابقة بصرياً عند اعتمادها (المرحلة 2+).
import type { MaterialDef, MaterialId, PhongParams } from "./types";

export const MATERIALS: Record<MaterialId, MaterialDef> = {
  glass: { color: [100, 154, 188, 255], role: "lit", phong: { ambient: 0.55, diffuse: 0.46, shininess: 160, specularColor: [190, 232, 255] } }, // == MAT_GLASS
  glassWarm: { color: [150, 225, 255, 235], role: "emissive" }, // قبّة أتريوم / نغمة توهّج زجاجيّ
  stone: { color: [166, 154, 126, 255], role: "lit", phong: { ambient: 0.4, diffuse: 0.82, shininess: 10, specularColor: [96, 86, 70] } },
  metal: { color: [150, 165, 180, 255], role: "lit", phong: { ambient: 0.34, diffuse: 0.84, shininess: 40, specularColor: [120, 130, 150] } },
  concrete: { color: [142, 148, 164, 255], role: "lit", phong: { ambient: 0.34, diffuse: 0.84, shininess: 14, specularColor: [78, 84, 96] } },
  vegetation: { color: [66, 116, 60, 255], role: "lit", phong: { ambient: 0.36, diffuse: 0.8, shininess: 6, specularColor: [40, 60, 40] } }, // عشب/تيجان
  water: { color: [46, 140, 200, 235], role: "emissive" }, // ماء مسبح (متوهّج خفيف)
  asphalt: { color: [128, 131, 138, 255], role: "lit", phong: { ambient: 0.42, diffuse: 0.82, shininess: 8, specularColor: [96, 100, 110] } }, // أسفلت رصاصيّ واضح (كراج رسميّ مخطّط)
  roadPaint: { color: [222, 222, 210, 255], role: "emissive" }, // دهان مسارب/مواقف
  sand: { color: [200, 186, 150, 255], role: "lit", phong: { ambient: 0.42, diffuse: 0.8, shininess: 4, specularColor: [120, 110, 80] } },
  wood: { color: [120, 92, 60, 255], role: "lit", phong: { ambient: 0.38, diffuse: 0.8, shininess: 8, specularColor: [80, 60, 40] } }, // جذوع/ديك
  signage: { color: [142, 244, 255, 255], role: "emissive" }, // لافتات/أحزمة متوهّجة
  // م9.8 (تطوير المول)
  porcelain: { color: [244, 244, 242, 255], role: "lit", phong: { ambient: 0.52, diffuse: 0.62, shininess: 110, specularColor: [250, 250, 248] } }, // بلاط بورسلين أبيض لامع
  bannerLight: { color: [96, 202, 255, 255], role: "emissive" }, // بانر/فانوس إعلانيّ مضيء
  crowd: { color: [126, 122, 134, 255], role: "lit", phong: { ambient: 0.44, diffuse: 0.82, shininess: 6, specularColor: [74, 72, 80] } }, // أشخاص (ظلال)
  carBody: { color: [208, 212, 218, 255], role: "lit", phong: { ambient: 0.32, diffuse: 0.78, shininess: 100, specularColor: [225, 228, 234] } }, // سيّارة فضيّة لمّاعة
  carAccent: { color: [150, 62, 58, 255], role: "lit", phong: { ambient: 0.34, diffuse: 0.82, shininess: 88, specularColor: [184, 122, 118] } }, // سيّارة بلون داكن
  carGlass: { color: [40, 52, 70, 255], role: "lit", phong: { ambient: 0.4, diffuse: 0.5, shininess: 130, specularColor: [150, 178, 208] } }, // زجاج سيّارة داكن لمّاع
  fabric: { color: [198, 120, 76, 255], role: "lit", phong: { ambient: 0.48, diffuse: 0.84, shininess: 5, specularColor: [120, 80, 60] } }, // قماش مظلّات المقاهي
  navy: { color: [28, 42, 84, 255], role: "lit", phong: { ambient: 0.32, diffuse: 0.84, shininess: 26, specularColor: [80, 100, 150] } }, // كحليّ لامع (أعمدة/زوايا/كرنيش)
  crystal: { color: [96, 172, 255, 240], role: "emissive" }, // زجاج كريستاليّ أزرق متوهّج (القبّة)
  crystalLight: { color: [184, 216, 250, 235], role: "emissive" }, // كريستال أفتح (غطاء قاعدة القبّة)
  roofTile: { color: [126, 130, 136, 255], role: "lit", phong: { ambient: 0.4, diffuse: 0.78, shininess: 16, specularColor: [110, 116, 126] } }, // بلاط سطح رماديّ مميّز
  marble: { color: [236, 234, 228, 255], role: "lit", phong: { ambient: 0.5, diffuse: 0.64, shininess: 64, specularColor: [242, 240, 234] } }, // رخام أبيض (قاعدة السور/الكشك)
  iron: { color: [40, 42, 50, 255], role: "lit", phong: { ambient: 0.3, diffuse: 0.8, shininess: 32, specularColor: [96, 100, 112] } }, // حديد مزخرف داكن (سياج/بوّابة)
  skyTile: { color: [208, 218, 230, 255], role: "lit", phong: { ambient: 0.5, diffuse: 0.64, shininess: 28, specularColor: [206, 214, 226] } }, // بلاط أزرق-رماديّ فاتح جدّاً (ساحة البرج)
  skyGray: { color: [150, 164, 186, 255], role: "lit", phong: { ambient: 0.46, diffuse: 0.82, shininess: 6, specularColor: [120, 130, 148] } }, // رماديّ سماويّ مطفأ (قاعدة/شرفة البرج)
};

export const matColor = (id: MaterialId): [number, number, number, number] => MATERIALS[id].color;
export const matLit = (id: MaterialId): boolean => MATERIALS[id].role === "lit";
export const matPhong = (id: MaterialId): PhongParams | undefined => MATERIALS[id].phong;
