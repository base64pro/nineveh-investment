// م9.8 · أنواع مكتبة البناء — مصدر واحد للأنواع (Mesh3 · Extra · TowerMeshes · ModelKind · الخامات).
// عقد العرض (الشبكات الستّ المسمّاة + extras) مُجمَّد: مطابق لما يستهلكه model-render.ts.

export interface Mesh3 {
  positions: Float32Array;
  normals: Float32Array;
  colors?: Float32Array; // م9.7.6 · لون رأسيّ (تدرّج قاعدة→قمّة + AO) يضاعف لون الخامة — عمق وتظليل واقعيّ
  texCoords?: Float32Array; // م9.8 · إحداثيّات UV (إسقاط ثلاثيّ المحاور) لتطبيق الخامات (textures)
}
// م9.7.3 · «ملحق» = شبكة مرفق/عنصر إضافي بلونه وخامته (باركات/حدائق/أشجار/قبّة...) — تُرسَم بطبقة مستقلّة.
export interface Extra {
  mesh: Mesh3;
  color: [number, number, number, number];
  lit: boolean; // مضاء (تظليل) أو منبعث (توهّج)
  tex?: string; // م9.8 · اسم خامة إجرائيّة اختياريّة (tile/asphalt/metal...)
}
export interface TowerMeshes {
  body: Mesh3; // الهيكل (مضاء) — بوديوم/أعمدة/شُرفات/بارابيت/بنتهاوس
  glassA: Mesh3; // زجاج سماوي فاتح (نغمة 1)
  glassB: Mesh3; // زجاج أزرق غامق (نغمة 2) — تفاوت ألواح
  winCool: Mesh3; // نوافذ مضيئة سماوية متناثرة (حياة)
  winWarm: Mesh3; // نوافذ مضيئة دافئة قليلة (تنوّع لوني)
  accent: Mesh3; // حلقة/خطوط مميِّزة منبعثة (هوية)
  extras?: Extra[]; // م9.7.3 · مرافق وملحقات (لكلّ نوع) — باركات/حدائق/أشجار/قبّة/ساحة...
  height: number;
}
export type ModelKind = "tower" | "mall" | "hotel";

// مخزَّن هندسيّ خام (مواضع + نواظم) قبل التجميد (freeze).
export type Buf = { P: number[]; N: number[] };
// مخازن واجهة (هيكل + زجاج بنغمتين + نوافذ بنمطين) — تُبنى محليّاً ثمّ تُدوَّر إلى الأوجه الأربعة.
export interface FaceBufs {
  body: Buf;
  gA: Buf;
  gB: Buf;
  winC: Buf;
  winW: Buf;
}

// م9.8 · سجلّ الخامات — هويّة السطح موحّدة: لون + دور إضاءة (مضاء Phong / منبعث) + وسائط Phong.
export type MaterialId =
  | "glass"
  | "glassWarm"
  | "stone"
  | "metal"
  | "concrete"
  | "vegetation"
  | "water"
  | "asphalt"
  | "roadPaint"
  | "sand"
  | "wood"
  | "signage"
  // م9.8 (تطوير المول) · خامات إضافيّة: بورسلين · بانر مضيء · حشد · سيّارات + زجاجها · قماش مظلّات
  | "porcelain"
  | "bannerLight"
  | "crowd"
  | "carBody"
  | "carAccent"
  | "carGlass"
  | "fabric"
  | "navy"
  | "crystal"
  | "crystalLight"
  | "roofTile"
  | "marble"
  | "iron"
  | "skyTile"
  | "skyGray";
export type MaterialRole = "lit" | "emissive";
export interface PhongParams {
  ambient: number;
  diffuse: number;
  shininess: number;
  specularColor: [number, number, number];
}
export interface MaterialDef {
  color: [number, number, number, number]; // لون أساسيّ (قبل أي تلوين حسب النوع)
  role: MaterialRole; // lit → خامة Phong · emissive → material:false (توهّج)
  phong?: PhongParams; // مطلوبة حين role==='lit'
}
