import centroid from "@turf/centroid";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";

/**
 * استنتاج مكاني حتمي (§هـ.4 — لا ذكاء): اسم المنطقة (name_ar) التي يقع مركز المضلّع داخلها.
 * يُستخدم لاستنتاج القضاء/الناحية للقطعة المرسومة من حدود الخريطة.
 */
export function inferName(polygon: Feature<Polygon>, boundaries: FeatureCollection): string | null {
  const c = centroid(polygon);
  for (const f of boundaries.features) {
    const g = f.geometry;
    if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) continue;
    if (booleanPointInPolygon(c, f as Feature<Polygon | MultiPolygon>)) {
      const n = f.properties?.name_ar;
      return typeof n === "string" ? n : null;
    }
  }
  return null;
}
