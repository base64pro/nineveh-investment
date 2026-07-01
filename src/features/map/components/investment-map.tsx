"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import bbox from "@turf/bbox";
import mask from "@turf/mask";
import centroid from "@turf/centroid";
import turfArea from "@turf/area";
import turfCircle from "@turf/circle";
import destination from "@turf/destination";
import distance from "@turf/distance";
import type { GeoJSONSource, Map as GLMap, StyleSpecification } from "maplibre-gl";
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from "geojson";
import { ChevronDown, Crosshair, FilterX, Layers, MapPinned, Maximize2, Rotate3d, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BASES,
  BOUNDARY_COLORS,
  DEFAULT_BASE,
  DIM_COLOR,
  IMAGERY_SOURCES,
  INITIAL_ZOOM,
  MAP_CENTER,
  MAX_BOUNDS_PADDING_DEG,
  MAX_ZOOM,
  NAVY,
  SATELLITE_PROVIDER,
  styleUrl,
  type BaseStyle,
  type SatelliteProvider,
} from "../lib/map-config";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { AmbientLight, DirectionalLight, LightingEffect, WebMercatorViewport } from "@deck.gl/core";
import { GeoJsonLayer, IconLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import { type ParcelProps, useMapParcels } from "../lib/use-map-parcels";
import { fillRgba, glowRgba, lineRgba } from "../lib/parcel-colors";
import { getPinIcons } from "../lib/parcel-markers";
import { TerraDraw, TerraDrawCircleMode, TerraDrawPolygonMode, TerraDrawRectangleMode, TerraDrawSelectMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { deleteParcelGeometry, updateParcelGeometry } from "../lib/geometry-actions";
import { useMapAnnotations } from "../lib/use-map-annotations";
import { useFieldOptions } from "@/lib/data/use-field-options";
import { useRole } from "@/features/auth/role-context";
import { createFlightWhoosh, type FlightWhooshHandle, isSfxMuted, setSfxMuted, sfxFly } from "@/lib/sfx";
import { createMapElement, deleteMapElement, renameMapElement } from "../lib/annotation-actions";
import { DrawDock, type DrawModeId } from "./draw-dock";
import { DimensionDialog, type DimShape } from "./dimension-dialog";
import { AnnotateCreateDialog, AnnotateEditDialog } from "./annotate-dialogs";
import { SelectedParcelCard, type SelectedEntityInfo } from "./selected-parcel-card";
import { HoloModelCards } from "./holo-model-cards";
import { evaluateControls, type ControlsResult } from "@/features/parcels/legal/controls-engine";
import { toControlsInput } from "@/features/parcels/legal/parcel-input";
import { MarkerCallout } from "./marker-callout";
import { HoloStatsChart } from "./holo-stats-chart";
import { useEscClose } from "@/components/ui/use-esc-close";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { inferName } from "../lib/spatial-inference";
import { onFlyTo, onFlyToCoords, onResetView, onStartCinematicTour, onStartDraw, onStartTour, onStopCinematicTour, onStopTour, onZoom, type ParcelKind, requestFlyTo, requestOpenParcelDetail, requestOpenParcelForm, requestStopCinematicTour, requestStopTour, setCinematicTourActive, setTourActive, setTourLocations, useCinematicTourActive, useTourActive } from "../lib/map-nav-store";
import type { DrawTarget } from "../lib/map-nav-store";
import { altForModel, buildTimeline, gateCameraBearing, zoomForAltitude, type StartCam, type TourLoc, type TourTimeline } from "../lib/tour-engine";
import { setMapBase } from "../lib/map-base-store";
import { buildModelLayers, buildRingLayers, buildTowerLayers, parseBinaryStl, registerModelLoaders, type ModelRenderItem, type StlMesh, type TowerItem } from "../lib/model-render";
import { HOLO_STATE } from "../lib/holo-sketch-extension";
import { generateContactShadow, generateFoundation, generateGardenStrip, generateGroundRings, generateModel, type Mesh3, type ModelKind, type TowerMeshes } from "../lib/parametric-tower";
import { prefetchOverview, featuresBBox, type PrefetchHandle } from "../lib/prefetch-tiles";
import { useAssumedModels, useAssumedParametric } from "@/features/parcels/models/model-lib";
import { useTable } from "@/lib/data/use-table";
import { useSettings } from "@/features/settings/use-settings";
import { getSheetHeight } from "@/features/shell/mobile-sheet-store";
import type { AssumedParcel, License, Opportunity } from "@/types/entities";

type MapData = {
  gov: FeatureCollection;
  districts: FeatureCollection;
  subdistricts: FeatureCollection;
  maskFC: Feature<Polygon | MultiPolygon>;
  bounds: [number, number, number, number];
};

// م8.2 · حشوة كاميرا للجوال (< md فقط): تُبقي المؤطَّر داخل الباند المرئي فوق شريط البحث والورقة السفلية.
// أعلى = شريط مؤشّرات KPI تحت الهيدبار، أسفل = شريط البحث + ارتفاع الورقة الحيّ (§6). على الديسكتوب تُعيد
// الرقم الأساس حرفياً (صفر تغيير على md+). ممنوع تغيير حجم canvas — التأطير عبر هذه الحشوة فقط.
type PadOpt = number | { top: number; bottom: number; left: number; right: number };
function framePadding(base: number, ignoreSheet = false): PadOpt {
  if (typeof window === "undefined" || !window.matchMedia("(max-width: 767px)").matches) return base;
  const KPI = 50; // شريط المؤشّرات تحت الهيدبار (صفّ واحد · م8.7)
  const SEARCH = 70; // شريط البحث السفلي + هامش
  // الورقة المفتوحة تغطّي شريط البحث ← الإقصاء السفلي = الأكبر بينهما (لا جمع مزدوج).
  // م8.10: عند الطيران تُغلق الورقة معه، فنتجاهل ارتفاعها (ignoreSheet) كي لا يتجاوز الحشو الرأسي
  // ارتفاع الخريطة فيفشل fitBounds (كان الطيران لا يعمل عند رفع الورقة للأقصى — يعمل الصوت فقط).
  const sheet = ignoreSheet ? 0 : getSheetHeight();
  return { top: base + KPI, bottom: base + Math.max(SEARCH, sheet), left: base, right: base };
}

// م9.7.11 · زوم درون يُبقي الكاميرا **بعيدة** فيظهر المبنى كاملاً ومحيطه (لا اقتراب مفرط):
// ارتفاع جوّي ≥ 1.9كم، ويتناسب طردياً مع حجم المبنى (الأكبر يرتفع أكثر فيبقى ضمن ~25% من الشاشة مع هامش محيط).
// يعكس صيغة مؤشّر الارتفاع نفسها: alt = 1.5 · ارتفاع_الكانفس · (156543·cos lat / 2^zoom) → فالارتفاع المعروض يطابق المستهدف.
function zoomForModel(footprintM: number, heightM: number, lat: number, canvasH: number, pitchDeg: number, kind?: ModelKind): number {
  const pr = (pitchDeg * Math.PI) / 180;
  const vSpan = heightM * Math.sin(pr); // إسقاط الارتفاع على الشاشة (يكبر بالميل)
  const spanM = Math.max(footprintM * 1.1, vSpan, 14); // أكبر امتداد ظاهر للمبنى
  const MIN_ALT = 1200; // حدّ أدنى للارتفاع الجوّي (متر) — لا تقترب الكاميرا أكثر
  // م9.9 · المول يُؤطَّر من ارتفاع 1200م (كان 900) — بقيّة الأنواع بلا تغيير
  const targetAlt = kind === "mall" ? 1200 : Math.max(MIN_ALT, spanM * 6); // تناسب طرديّ: المباني الكبيرة ترفع الكاميرا أكثر
  return Math.log2((1.5 * canvasH * 156543.03392 * Math.cos((lat * Math.PI) / 180)) / targetAlt);
}

// م9.17 · استقرار موحّد: بعد المدار ينزلق الدرون **انسيابيّاً ضمن نفس الحركة** إلى ارتفاع مريح وميلٍ يجعل البطاقات مستوية للناظر
// (مقروءة) بعمقٍ ثلاثيّ خفيف — يظهر المركّب كلّه (مجسّم + بطاقات + مسار) بلا اقتطاع. القيمتان قابلتان للضبط الفوريّ.
const SETTLE_ALT_M = 1300; // ارتفاع الاستقرار الجوّي الافتراضيّ (متر) — لموقعٍ بلا مشهد معتمَد
const SETTLE_PITCH = 63; // ميل الاستقرار الافتراضيّ (يواجه البطاقات للناظر مع ميلٍ خفيف يمنح الأبعاد)
const CARD_YAW_DEG = 20; // م9.17 · ميل دورانيّ أفقيّ خفيف لصفّ البطاقات حول المحور العموديّ (إزاحة اتّجاه المواجهة) ⇒ يُرى بزاوية ثلاثيّة لا مستوياً
// م9.17 · مشهد استقرار معتمَد يدويّاً: ارتفاع + ميل + اتّجاه + موضع المجسّم على الشاشة (نسبةً) — يُلتقَط ويُطبَّق **لكلّ موقع على حدة** (مفتاحه ref_id)
type SettleView = { altM: number; pitch: number; bearing: number; offXFrac: number; offYFrac: number };
const SETTLE_VIEWS_KEY = "nineveh:settleViews";
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;


type StyleSource = { url?: string; tiles?: string[]; [k: string]: unknown };
type StyleLayer = {
  id: string;
  type: string;
  source?: string;
  minzoom?: number;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
  [k: string]: unknown;
};
type StyleJson = {
  sprite?: string;
  glyphs?: string;
  sources?: Record<string, StyleSource>;
  layers?: StyleLayer[];
  [k: string]: unknown;
};

const ARABIC_LABEL = ["coalesce", ["get", "name:ar"], ["get", "name:latin"], ["get", "name"]];

/**
 * طبقاتنا فوق القاعدة: قناع التعتيم ثمّ الحدود وتسمياتها — بطبقة هرمية (م2.3):
 * كلّما قرّبت تبهت طبقة الأعلى (المحافظة←الأقضية←النواحي) وتبرز الأصغر، والعكس بالإبعاد.
 */
// م9.11 · مفتاح التحميل المسبق للبلاطات — **مُفعَّل لمزوّد Google فقط** (بلاطاته تُخبَّأ يوماً ⇒ التحميل المسبق مجدٍ وموفِّر).
// يبقى متخطّى لـMapTiler (تفادي استنزاف حصّته المجانيّة — حادثة 429). يُحمَّل **عرض المدينة + عمق حول القطع** بسقف بلاطات محافظ.
const PREFETCH_ENABLED = true;

function overlayLayers(): StyleLayer[] {
  const C = BOUNDARY_COLORS;
  const line = (id: string, color: string, width: number, minzoom: number, opacity: unknown): StyleLayer => ({
    id: `bnd-${id}-line`,
    type: "line",
    source: `bnd-${id}`,
    minzoom,
    paint: { "line-color": color, "line-width": width, "line-opacity": opacity, "line-blur": 0.4 },
  });
  const label = (id: string, minzoom: number, size: number, opacity: unknown, withStats = false): StyleLayer => ({
    id: `bnd-${id}-label`,
    type: "symbol",
    source: `bnd-${id}`,
    minzoom,
    layout: {
      // الاسم + أرقام المقاييس (م2.3) أسفله بخطّ أصغر — للأقضية/النواحي عند توفّر قطع منسوبة.
      "text-field": withStats
        ? ["format", ["coalesce", ["get", "name_ar"], ["get", "name_en"]], {}, ["coalesce", ["get", "stats_nl"], ""], { "font-scale": 0.8 }]
        : ["coalesce", ["get", "name_ar"], ["get", "name_en"]],
      "text-font": ["Noto Sans Regular"],
      "text-size": size,
      "text-max-width": 9,
    },
    paint: {
      "text-color": C.label,
      "text-halo-color": C.labelHalo,
      "text-halo-width": 1.4,
      "text-opacity": opacity,
    },
  });
  // تعبيرات التلاشي الهرمي بالزوم.
  const govLabelFade = ["interpolate", ["linear"], ["zoom"], 6.5, 1, 8, 0];
  const districtFade = ["interpolate", ["linear"], ["zoom"], 8.5, 0.9, 10.5, 0.12];
  const districtLabelFade = ["interpolate", ["linear"], ["zoom"], 8.5, 1, 10.5, 0];
  const subdFade = ["interpolate", ["linear"], ["zoom"], 8, 0, 10, 0.9];
  const subdLabelFade = ["interpolate", ["linear"], ["zoom"], 9, 0, 10.5, 1];
  return [
    { id: "dim-mask", type: "fill", source: "dim-mask", paint: { "fill-color": DIM_COLOR } },
    // م8.11 · توهّج نابض هادئ لشريط حدود نينوى — تُحرَّك line-opacity بـrAF (يعلو ويخفت بسلاسة)
    { id: "bnd-governorate-glow", type: "line", source: "bnd-governorate", paint: { "line-color": C.governorate.line, "line-width": 7, "line-blur": 5, "line-opacity": 0.3 } },
    line("governorate", C.governorate.line, C.governorate.width, 0, 0.9),
    label("governorate", 0, 18, govLabelFade),
    line("districts", C.districts.line, C.districts.width, 0, districtFade),
    label("districts", 6, 15, districtLabelFade, true),
    line("subdistricts", C.subdistricts.line, C.subdistricts.width, 8, subdFade),
    label("subdistricts", 9, 12, subdLabelFade, true),
  ];
}

/** طبقات القطع الملوّنة بالحالة (deck.gl): ملء شفّاف + حدّ أعمق + هالة توهّج + تحديد/خفوت/مرور (§هـ.4). */
// م9.3ب · إضاءة للنماذج المرفوعة (pbr) كي تظهر فوق الأرضية الداكنة بدل أن تُعتِم — إضاءة محيطة قوية + اتجاهيّتان.
// إضاءة النماذج: محيط أخفض + شمس أقوى = تظليل اتجاهيّ أوضح (عمق 3D واقعي على الهيكل المضاء).
// م9.9 · **لا ظلّ مُلقى للمجسّم** (كان يسقط على حلقات السونار ويُزعج بصريّاً) — إضاءة Phong فقط (شمس + محيط + ملء).
// إزالة `_shadow` تُلغي **تمريرة خريطة-الظلّ** كاملةً ⇒ صفر ظلّ مُلقى + **أداء أفضل** (لا تمريرة ظلّ لكلّ إطار).
const MODEL_LIGHTING = new LightingEffect({
  ambient: new AmbientLight({ color: [255, 255, 255], intensity: 0.72 }), // م9.9 · محيط أخفض ⇒ تباين اتّجاهيّ (عمق ثلاثيّ) وبروز اللمعان المرآويّ للمجسّمات الإجرائيّة (أُعيدت لأصلها — م9.11)
  sun: new DirectionalLight({ color: [255, 252, 244], intensity: 2.2, direction: [-1, -2, -3] }), // شمس أقوى ⇒ بريق زجاج لامع + وجوه مضيئة (بلا ظلّ)
  fill: new DirectionalLight({ color: [196, 214, 255], intensity: 0.55, direction: [2, 1, -1] }),
});

// م9.7.2 (مؤقّت) · نوع النموذج لكل قطعة مفترضة من اسمها — يُستبدل لاحقاً باختيار المدير من المنسدلة (م9.7.1ب/د).
const FORCE_KIND: ModelKind | null = null; // (للتحقّق فقط: اضبطه "mall"/"hotel"/"tower" لفرض النوع على كلّ القطع)
function tempKindFor(nameAr: string): ModelKind {
  if (FORCE_KIND) return FORCE_KIND;
  const n = nameAr || "";
  if (/مول|موول|mall|تسوّق/i.test(n)) return "mall";
  if (/فندق|hotel|نجوم/i.test(n)) return "hotel";
  return "tower"; // الافتراض: برج
}

// م9.11 · نماذج glb واقعيّة ثابتة لقطع محدّدة بالاسم — تحلّ محلّ المجسّم الإجرائيّ. الملفّ مُحسَّن للويب في public/models
// (Draco + قوام). extentUnits = أقصى امتداد أفقيّ للنموذج بوحدات الـglb (من فحص gltf-transform) لمواءمة المقياس مع بصمة القطعة.
type StaticModel = { match: (nameAr: string) => boolean; url: string; yaw: number; elevationM: number; extentUnits: number; flightAltM?: number; closeApproach?: boolean; lighting?: "flat" | "pbr" };
const STATIC_MODELS: readonly StaticModel[] = [
  // «هيئة استثمار نينوى» (متسامح مع همزة/ة) · elevationM يُلصقه بالأرض · flightAltM ارتفاع الاقتراب · closeApproach جولة خاصّة · lighting=flat سطوع مستقلّ عن الإضاءة العامّة
  { match: (n) => /استثمار/.test(n) && /هي[ئأ]ة|هيئه/.test(n), url: "/models/nineveh-authority.glb", yaw: 0, elevationM: 1, extentUnits: 26.3, flightAltM: 200, closeApproach: true, lighting: "flat" },
];

function parcelLayers(fc: FeatureCollection, selectedId: string | null, modelRefIds: Set<string> = new Set(), towerRefIds: Set<string> = new Set(), glbRefIds: Set<string> = new Set()) {
  const stateOf = (f: Feature): string | undefined => (typeof f.properties?.state === "string" ? f.properties.state : undefined);
  const refOf = (f: Feature): string | undefined => (typeof f.properties?.ref_id === "string" ? f.properties.ref_id : undefined);
  const sel = (f: Feature): boolean => selectedId !== null && refOf(f) === selectedId;
  const dim = (f: Feature): boolean => selectedId !== null && refOf(f) !== selectedId;
  // م9.11 · قطعة ذات نموذج glb ثابت (هيئة الاستثمار): تُخفى رسمتها الهولوكراميّة (تعبئة/حدّ/توهّج) — المبنى الواقعيّ يمثّلها ويغطّيها، فلا تظهر فوق بلاطه.
  const hideDraw = (f: Feature): boolean => {
    const r = refOf(f);
    return r != null && glbRefIds.has(r);
  };
  // ألفا: المحدّد يبرز · ما حوله يخفت · الباقي طبيعي.
  const alpha = (base: number, boost: number, f: Feature): number => (sel(f) ? boost : dim(f) ? Math.round(base * 0.3) : base);
  const icons = getPinIcons();
  const markerData = fc.features.map((f) => ({
    position: centroid(f as Feature<Polygon | MultiPolygon>).geometry.coordinates as [number, number],
    state: stateOf(f) ?? "assumed",
    ref_id: refOf(f) ?? "",
    label: typeof f.properties?.label === "string" ? f.properties.label : "",
    kind: typeof f.properties?.kind === "string" ? f.properties.kind : "assumed",
    entity_id: typeof f.properties?.entity_id === "string" ? f.properties.entity_id : "",
  }));
  const layers: Layer[] = [
    new GeoJsonLayer({
      id: "parcels-glow",
      data: fc,
      filled: false,
      stroked: true,
      getLineColor: (f: Feature) => {
        if (hideDraw(f)) return [0, 0, 0, 0];
        const [r, g, b] = glowRgba(stateOf(f));
        return [r, g, b, alpha(80, 215, f)];
      },
      getLineWidth: (f: Feature) => (sel(f) ? 13 : 6),
      lineWidthUnits: "pixels",
      lineWidthMinPixels: 3,
      updateTriggers: { getLineColor: selectedId, getLineWidth: selectedId },
    }),
    new GeoJsonLayer({
      id: "parcels",
      data: fc,
      filled: true,
      stroked: true,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 38],
      getFillColor: (f: Feature) => {
        if (hideDraw(f)) return [0, 0, 0, 0]; // م9.11 · قطعة الـglb: لا تعبئة (المبنى يغطّيها)
        const [r, g, b] = fillRgba(stateOf(f));
        // م9.3 · المفترضة كيان ثلاثي دائم: تعبئة أرضها كثيفة دائماً فتندمج الرسمة بالكتلة بنفس المادة واللون الكثيف.
        if (stateOf(f) === "assumed") return [r, g, b, alpha(205, 235, f)];
        // المحدّد يمتلئ بلون/شدّة الحدّ (≈232) — مع توهّج هولوكرامي من طبقة الهالة.
        return [r, g, b, alpha(64, 232, f)];
      },
      getLineColor: (f: Feature) => {
        if (hideDraw(f)) return [0, 0, 0, 0];
        const [r, g, b] = lineRgba(stateOf(f));
        return [r, g, b, alpha(235, 255, f)];
      },
      getLineWidth: (f: Feature) => (sel(f) ? 4 : 2),
      lineWidthUnits: "pixels",
      lineWidthMinPixels: 1.5,
      updateTriggers: { getFillColor: selectedId, getLineColor: selectedId, getLineWidth: selectedId },
    }),
  ];
  // إشارة لكل قطعة (ساق + قرص بلون الحالة) — ظاهرة من أبعد زوم، قابلة للنقر.
  if (icons.assumed) {
    const fallback = icons.assumed;
    layers.push(
      new IconLayer({
        id: "parcel-markers",
        data: markerData,
        pickable: true,
        billboard: true,
        getPosition: (d: { position: [number, number] }) => d.position,
        getIcon: (d: { state: string }) => icons[d.state] ?? fallback,
        getSize: (d: { ref_id: string }) => (selectedId !== null && d.ref_id === selectedId ? 1.32 : 1),
        sizeUnits: "pixels",
        sizeScale: 44,
        // كل الإشارات ظاهرة دائماً (لا إخفاء/تذبذب شفافية).
        updateTriggers: { getSize: selectedId },
      }),
    );
  }
  // م9.3 · كل قطعة مفترضة = كيان ثلاثي ممدود **دائم** يدمج الرسمة بالكتلة بنفس المادة واللون الكثيف —
  // لا يختفي بالنقر خارجه؛ كتلة من حدود القطعة، يُستبدَل بنموذج glb المرفوع لاحقاً (م9.3ب).
  // القطع التي لها نموذج مرفوع أو برج بارامتري تُستثنى من الكتلة الإجرائية (يحلّ محلّها — م9.3ب/م9.7.1ج).
  const assumedFeats = fc.features.filter((f) => f.properties?.kind === "assumed" && f.geometry && !modelRefIds.has(refOf(f) ?? "") && !towerRefIds.has(refOf(f) ?? ""));
  if (assumedFeats.length) {
    const [fr, fg, fb] = fillRgba("assumed");
    const [lr, lg, lb] = lineRgba("assumed");
    layers.push(
      new GeoJsonLayer({
        id: "parcel-massing",
        data: { type: "FeatureCollection", features: assumedFeats } as FeatureCollection,
        extruded: true,
        filled: true,
        stroked: false,
        wireframe: true,
        material: false, // مسطّح منبعث = نفس مادة أرض القطعة (بلا تظليل)
        getElevation: 60, // متر — ارتفاع تصوّري مبدئي (مؤشَّر «تصوّر تصميمي»)
        getFillColor: [fr, fg, fb, 232], // كثيف كحالة التحديد (اشتداد غمق اللون)
        getLineColor: [lr, lg, lb, 255],
        getLineWidth: 1.5,
        lineWidthUnits: "pixels",
      }),
    );
  }
  return layers;
}

/** المقاييس الثلاثة (م2.3): عدّ [معلَنة، رخص، مفترضة] حسب اسم القضاء/الناحية (مطابقة الحقل). */
function bumpCount(map: Map<string, number[]>, name: string | null, i: number): void {
  if (!name) return;
  const e = map.get(name) ?? [0, 0, 0];
  e[i] = (e[i] ?? 0) + 1;
  map.set(name, e);
}
function formatStats(t: number[]): string {
  const parts: string[] = [];
  if (t[0]) parts.push(`معلَنة ${t[0]}`);
  if (t[1]) parts.push(`رخص ${t[1]}`);
  if (t[2]) parts.push(`مفترضة ${t[2]}`);
  return parts.length ? `\n${parts.join(" · ")}` : "";
}
/** يضيف خاصّية stats_nl (سطر الأرقام) لكل ميزة حدود وفق اسمها. */
function augmentStats(fc: FeatureCollection, counts: Map<string, number[]>): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: fc.features.map((f) => {
      const name = typeof f.properties?.name_ar === "string" ? f.properties.name_ar : "";
      const t = counts.get(name);
      return { ...f, properties: { ...f.properties, stats_nl: t ? formatStats(t) : "" } };
    }),
  };
}

const BND_LAYER_IDS = [
  "bnd-governorate-line",
  "bnd-governorate-label",
  "bnd-districts-line",
  "bnd-districts-label",
  "bnd-subdistricts-line",
  "bnd-subdistricts-label",
];

/** يحقن أرقام المقاييس في مصادر الحدود (يُستدعى بعد التحميل وعند تغيّر القطع وتبديل القاعدة). */
function applyStats(
  m: GLMap | null,
  data: MapData | null,
  oppsData: Opportunity[],
  licsData: License[],
  assumedData: AssumedParcel[],
): void {
  if (!m || !data) return;
  const dSrc = m.getSource("bnd-districts") as GeoJSONSource | undefined;
  const sSrc = m.getSource("bnd-subdistricts") as GeoJSONSource | undefined;
  if (!dSrc || !sSrc) return;
  const dCounts = new Map<string, number[]>();
  for (const o of oppsData) bumpCount(dCounts, o.district, 0);
  for (const l of licsData) bumpCount(dCounts, l.district, 1);
  for (const a of assumedData) bumpCount(dCounts, a.district, 2);
  const sCounts = new Map<string, number[]>();
  for (const l of licsData) bumpCount(sCounts, l.subdistrict, 1);
  for (const a of assumedData) bumpCount(sCounts, a.subdistrict, 2);
  dSrc.setData(augmentStats(data.districts, dCounts));
  sSrc.setData(augmentStats(data.subdistricts, sCounts));
}

/** إظهار/إخفاء طبقة الحدود. */
function applyVisibility(m: GLMap | null, show: boolean): void {
  if (!m || !m.getLayer("bnd-districts-line")) return;
  const vis = show ? "visible" : "none";
  for (const id of BND_LAYER_IDS) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", vis);
}

// م9.9 · علم تدهور الخريطة (429/أساس احتياطيّ) — لتنبيه المستخدم **مرّة واحدة** وكتم تكرار رسائل أخطاء الخريطة بعدها.
let mapDegraded = false;

/**
 * يبني كائن النمط كاملاً: قاعدة MapTiler (عبر الوسيط، بلا تخزين، عناوين مطلقة)
 * + تعريب + ضبط كحلي + طبقاتنا (الحدود والقناع) — فتظهر من أوّل إطار وعند كل تبديل.
 */
async function buildStyle(base: BaseStyle, data: MapData, provider: SatelliteProvider): Promise<StyleSpecification> {
  // م9.8/م9.11 · القمر الصناعي بمزوّد Google = طبقة raster مُمرَّرة بدل نمط MapTiler hybrid.
  if (base === "satellite" && provider !== "maptiler") return buildSatelliteStyle(provider, data);
  // تراجع تصاعديّ عند 429 (حدّ معدّل) / 5xx، ثمّ **تدهور لطيف**: صور Google البديلة (مزوّد مستقلّ عن MapTiler) — لا انهيار.
  let res = await fetch(styleUrl(base), { cache: "no-store" });
  for (let i = 0; i < 2 && (res.status === 429 || res.status >= 500); i++) {
    await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    res = await fetch(styleUrl(base), { cache: "no-store" });
  }
  if (!res.ok) {
    // أساس احتياط نظيف بلا أيّ تبعيّة MapTiler (تفادي 429 يحجب التحميل). تُستعاد MapTiler تلقائياً عند إعادة التحميل بعد التعافي.
    if (typeof window !== "undefined" && !mapDegraded) toast.error(`تعذّر تحميل خرائط MapTiler (${res.status}) — أساس احتياطيّ (صور Google) مؤقّتاً`);
    mapDegraded = true; // كتم تكرار رسائل أخطاء الخريطة بعدها
    return fallbackStyle(data);
  }
  const style = (await res.json()) as StyleJson;
  const origin = window.location.origin;
  const abs = (u: string | undefined): string | undefined =>
    typeof u === "string" && u.startsWith("/api/maptiler") ? origin + u : u;

  style.sprite = abs(style.sprite);
  style.glyphs = abs(style.glyphs);
  for (const src of Object.values(style.sources ?? {})) {
    if (typeof src.url === "string" && src.url.startsWith("/api/maptiler")) {
      const tj = (await fetch(abs(src.url)!, { cache: "no-store" }).then((r) => r.json())) as {
        tiles?: string[];
        minzoom?: number;
        maxzoom?: number;
        bounds?: number[];
        attribution?: string;
      };
      if (Array.isArray(tj.tiles)) src.tiles = tj.tiles.map((t) => abs(t) ?? t);
      if (typeof tj.minzoom === "number") src.minzoom = tj.minzoom;
      if (typeof tj.maxzoom === "number") src.maxzoom = tj.maxzoom;
      if (Array.isArray(tj.bounds)) src.bounds = tj.bounds;
      if (typeof tj.attribution === "string") src.attribution = tj.attribution;
      delete src.url;
    } else if (typeof src.url === "string") {
      src.url = abs(src.url);
    }
    if (Array.isArray(src.tiles)) src.tiles = src.tiles.map((t) => abs(t) ?? t);
  }

  // تعريب التسميات (name:ar) + ضبط القاعدة الداكنة نحو الكحلي المات
  // م7.6 · حدّة المعالم: أرضية أغمق + خطوط (طرق/ممرات/تضاريس) أفتح قليلاً + نصوص أنصع بهالة أغمق —
  // معالجة لونية صرفة (mix نحو الأبيض/الأسود) دون أي تغيير في المعالم نفسها.
  for (const layer of style.layers ?? []) {
    if (layer.type === "symbol" && layer.layout && "text-field" in layer.layout) {
      layer.layout["text-field"] = ARABIC_LABEL;
    }
    if (base === "dark") {
      if (layer.id === "background") layer.paint = { ...layer.paint, "background-color": NAVY.background };
      const paint = (layer.paint ?? {}) as Record<string, unknown>;
      const id = layer.id.toLowerCase();
      // م8.12 · الأرضية تبقى داكنة، ومعالم نينوى (شوارع/أفرع/أنهار/مبانٍ/خطوط) تُفتَّح بتوهّج خفيف جداً لتبرز.
      if (layer.type === "line" && typeof paint["line-color"] === "string") {
        paint["line-color"] = lightenColor(paint["line-color"], 0.58); // شوارع/أفرع/أنهار/خطوط أنصع
        paint["line-blur"] = 0.6; // توهّج خفيف جداً
        layer.paint = paint as never;
      } else if (layer.type === "symbol") {
        if (typeof paint["text-color"] === "string") paint["text-color"] = lightenColor(paint["text-color"], 0.55);
        paint["text-halo-color"] = NAVY.background;
        layer.paint = paint as never;
      } else if (layer.type === "fill-extrusion" && typeof paint["fill-extrusion-color"] === "string") {
        paint["fill-extrusion-color"] = lightenColor(paint["fill-extrusion-color"], 0.32); // مبانٍ ثلاثية بارزة
        layer.paint = paint as never;
      } else if (layer.type === "fill" && typeof paint["fill-color"] === "string") {
        if (id.includes("water")) paint["fill-color"] = lightenColor(paint["fill-color"], 0.24); // أنهار/مياه أوضح
        else if (id.includes("building")) paint["fill-color"] = lightenColor(paint["fill-color"], 0.3); // مبانٍ بارزة
        else paint["fill-color"] = darkenColor(paint["fill-color"], 0.34); // أرضية الأراضي/الاستعمالات تبقى داكنة
        layer.paint = paint as never;
      }
    }
  }

  // حقن مصادرنا وطبقاتنا داخل النمط (تظهر من أوّل إطار وفوراً عند التبديل)
  const sources = style.sources ?? {};
  sources["dim-mask"] = { type: "geojson", data: data.maskFC } as unknown as StyleSource;
  sources["bnd-governorate"] = { type: "geojson", data: data.gov } as unknown as StyleSource;
  sources["bnd-districts"] = { type: "geojson", data: data.districts } as unknown as StyleSource;
  sources["bnd-subdistricts"] = { type: "geojson", data: data.subdistricts } as unknown as StyleSource;
  style.sources = sources;
  style.layers = [...(style.layers ?? []), ...overlayLayers()];

  return style as unknown as StyleSpecification;
}

/**
 * م9.8/م9.11 · نمط القمر الصناعي بمزوّد Google: طبقة raster واحدة في الأسفل (Google عبر الوسيط)
 * + خطوط/تسميات/سبرايت MapTiler (لخطوط تسميات الحدود) + طبقاتنا السيادية فوقها (الحدود والقناع).
 * الصورة في الأسفل، التسميات والحدود تُلحَق آخراً ⇒ تبقى فوق الصورة (§هـ.4). المفتاح خادمي (القاعدة 6).
 */
function buildSatelliteStyle(provider: Exclude<SatelliteProvider, "maptiler">, data: MapData): StyleSpecification {
  const origin = window.location.origin;
  const cfg = IMAGERY_SOURCES[provider];
  const sources: Record<string, StyleSource> = {
    imagery: {
      type: "raster",
      tiles: cfg.tiles.map((t) => origin + t),
      tileSize: cfg.tileSize,
      maxzoom: cfg.maxzoom,
      attribution: cfg.attribution, // يظهر في AttributionControl تلقائياً (نسب المزوّد)
    } as unknown as StyleSource,
    // طبقاتنا السيادية (نفس مصادر buildStyle) — تُحقَن فوق الصورة
    "dim-mask": { type: "geojson", data: data.maskFC } as unknown as StyleSource,
    "bnd-governorate": { type: "geojson", data: data.gov } as unknown as StyleSource,
    "bnd-districts": { type: "geojson", data: data.districts } as unknown as StyleSource,
    "bnd-subdistricts": { type: "geojson", data: data.subdistricts } as unknown as StyleSource,
  };
  const style: StyleJson = {
    version: 8,
    glyphs: origin + "/api/maptiler/fonts/{fontstack}/{range}.pbf", // خطوط تسميات الحدود (Noto Sans)
    sprite: origin + "/api/maptiler/maps/streets-v2-dark/sprite",
    sources,
    layers: [{ id: "imagery", type: "raster", source: "imagery" }, ...overlayLayers()],
  };
  return style as unknown as StyleSpecification;
}

/**
 * م9.9/م9.11 · نمط **احتياط بلا أيّ تبعيّة MapTiler** (عند 429/فشل): أساس كحليّ + صور Google (مزوّد مستقلّ عن MapTiler)
 * + حدود خطّيّة فقط — **بلا glyphs/sprite من MapTiler** وبلا تسميات نصّيّة. يُحمَّل دائماً (لا يعتمد على شبكة MapTiler).
 */
function fallbackStyle(data: MapData): StyleSpecification {
  const origin = window.location.origin;
  const sat = IMAGERY_SOURCES.google;
  const sources: Record<string, StyleSource> = {
    imagery: { type: "raster", tiles: sat.tiles.map((t) => origin + t), tileSize: sat.tileSize, maxzoom: sat.maxzoom, attribution: sat.attribution } as unknown as StyleSource,
    "dim-mask": { type: "geojson", data: data.maskFC } as unknown as StyleSource,
    "bnd-governorate": { type: "geojson", data: data.gov } as unknown as StyleSource,
    "bnd-districts": { type: "geojson", data: data.districts } as unknown as StyleSource,
    "bnd-subdistricts": { type: "geojson", data: data.subdistricts } as unknown as StyleSource,
  };
  const style: StyleJson = {
    version: 8,
    sources,
    layers: [
      { id: "bg", type: "background", paint: { "background-color": NAVY.background } } as unknown as StyleLayer,
      { id: "imagery", type: "raster", source: "imagery", paint: { "raster-fade-duration": 250 } } as unknown as StyleLayer, // تلاشٍ ناعم بدل ظهور مفاجئ
      ...overlayLayers().filter((l) => l.type !== "symbol"), // حدود خطّيّة فقط — لا تسميات (تحتاج glyphs)
    ],
  };
  return style as unknown as StyleSpecification;
}

/** مزج لون نحو الأبيض/الأسود — يدعم hex/rgb(a)/hsl(a)؛ التعبيرات تُترَك كما هي (لا تغيير معالم). */
function mixColor(color: string, amt: number, toWhite: boolean): string {
  const c = color.trim();
  const target = toWhite ? 255 : 0;
  const mix = (v: number): number => Math.round(v + (target - v) * amt);
  const mHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (mHex) {
    let h = mHex[1]!;
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
  }
  const mRgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(c);
  if (mRgb) {
    const a = mRgb[4];
    return `rgba(${mix(Number(mRgb[1]))},${mix(Number(mRgb[2]))},${mix(Number(mRgb[3]))},${a ?? "1"})`;
  }
  const mHsl = /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(c);
  if (mHsl) {
    const l = Number(mHsl[3]);
    const nl = toWhite ? l + (100 - l) * amt : l * (1 - amt);
    const a = mHsl[4];
    return a !== undefined ? `hsla(${mHsl[1]},${mHsl[2]}%,${nl.toFixed(1)}%,${a})` : `hsl(${mHsl[1]},${mHsl[2]}%,${nl.toFixed(1)}%)`;
  }
  return color;
}
const lightenColor = (c: string, a: number): string => mixColor(c, a, true);
const darkenColor = (c: string, a: number): string => mixColor(c, a, false);

// مربّعات إظهار القطع حسب الحالة (§هـ.4): قيمة الحالة ← {تسمية · لون accent}.
const STATE_TOGGLES = [
  { value: "announced", label: "معلَنة", accent: "accent-state-announced" },
  { value: "in-progress", label: "قيد الإنجاز", accent: "accent-state-inprogress" },
  { value: "completed", label: "منجزة", accent: "accent-state-completed" },
  { value: "withdrawn", label: "مسحوبة", accent: "accent-state-withdrawn" },
  { value: "assumed", label: "مفترضة", accent: "accent-state-assumed" },
] as const;

// مستطيل مضبوط جغرافياً حول مركز (متر) — turf حتمي (لوضعَي «بأبعاد» و«مربّع»).
function buildRectPolygon(lng: number, lat: number, widthM: number, heightM: number): Feature<Polygon> {
  const km = (m: number) => m / 1000;
  const n = destination([lng, lat], km(heightM / 2), 0).geometry.coordinates;
  const s = destination([lng, lat], km(heightM / 2), 180).geometry.coordinates;
  const e = destination([lng, lat], km(widthM / 2), 90).geometry.coordinates;
  const w = destination([lng, lat], km(widthM / 2), 270).geometry.coordinates;
  const [minX, maxX, minY, maxY] = [w[0]!, e[0]!, s[1]!, n[1]!];
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [[[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY]]] },
  };
}

/** ضبط مستطيل مرسوم يدوياً إلى مربّع (وضع «مربّع»): الضلع = متوسط البعدين، حول نفس المركز. */
function regularizeSquare(polygon: Feature<Polygon>): Feature<Polygon> {
  const [minX, minY, maxX, maxY] = bbox(polygon);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const widthM = distance([minX, cy], [maxX, cy]) * 1000;
  const heightM = distance([cx, minY], [cx, maxY]) * 1000;
  const side = (widthM + heightM) / 2;
  return buildRectPolygon(cx, cy, side, side);
}

const GLASS = "border border-[rgba(148,175,209,0.45)] bg-[hsl(220_36%_15%_/_0.92)] shadow-[0_8px_28px_-10px_rgba(0,0,0,0.7),0_0_22px_-8px_rgba(148,175,209,0.5)] backdrop-blur";

// طبقة التسميات المحرَّرة (م7.3 · §هـ.4 «السكتش الهولوكرامي»): مضلّعات متقطّعة + نقاط متوهّجة + أسماء عربية (RTL سليم عبر maplibre).
const ANN_SOURCE = "annotations";
const ANN_CLICK_LAYERS = ["ann-symbol", "ann-point", "ann-fill"];
function applyAnnotations(map: GLMap | null, fc: FeatureCollection, visible: boolean): void {
  if (!map) return;
  try {
    const src = map.getSource(ANN_SOURCE) as GeoJSONSource | undefined;
    if (!src) {
      map.addSource(ANN_SOURCE, { type: "geojson", data: fc });
      map.addLayer({
        id: "ann-fill",
        type: "fill",
        source: ANN_SOURCE,
        filter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
        paint: { "fill-color": "#94afd1", "fill-opacity": 0.07 },
      });
      map.addLayer({
        id: "ann-line",
        type: "line",
        source: ANN_SOURCE,
        filter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
        paint: { "line-color": "#94afd1", "line-width": 1.6, "line-dasharray": [2.5, 2] },
      });
      map.addLayer({
        id: "ann-point",
        type: "circle",
        source: ANN_SOURCE,
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 4.5,
          "circle-color": "#94afd1",
          "circle-stroke-color": "#0b1220",
          "circle-stroke-width": 1.5,
          "circle-blur": 0.15,
        },
      });
      map.addLayer({
        id: "ann-symbol",
        type: "symbol",
        source: ANN_SOURCE,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 13,
          "text-offset": [0, 0.9],
          "text-anchor": "top",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#cfe3ff",
          "text-halo-color": "#0b1220",
          "text-halo-width": 1.4,
        },
      });
    } else {
      src.setData(fc as never);
    }
    const vis = visible ? "visible" : "none";
    for (const id of ["ann-fill", "ann-line", "ann-point", "ann-symbol"]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
    }
  } catch {
    // النمط قيد التبديل — ستُعاد عند idle
  }
}

interface EditingRef {
  kind: string;
  refId: string;
  label: string;
}

export default function InvestmentMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GLMap | null>(null);
  const dataRef = useRef<MapData | null>(null);
  const baseRef = useRef<BaseStyle>(DEFAULT_BASE);
  const [base, setBase] = useState<BaseStyle>(DEFAULT_BASE);
  // م9.8 · مزوّد القمر الصناعي الفعّال (يقرأه buildStyle) — قابل للتبديل محلّياً عبر شريط المقارنة.
  const satProviderRef = useRef<SatelliteProvider>(SATELLITE_PROVIDER);
  const [satProvider, setSatProvider] = useState<SatelliteProvider>(SATELLITE_PROVIDER);
  const [map3D, setMap3D] = useState(true); // م8.12 · عرض الخريطة 3D/2D (الافتراضي 3D)
  const overlayRef = useRef<MapboxOverlay | null>(null);
  // نافذة إشارة القطعة (م7.8): بطاقة هولوكرامية بخط ربط تتبع الإشارة حيّاً — بدل Popup (كانت تختفي خلف طبقة الإشارات)
  const [mkSel, setMkSel] = useState<{ refId: string; label: string | null; kind: ParcelKind; entityId: string; lngLat: [number, number] } | null>(null);
  const [mkPx, setMkPx] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const { fc } = useMapParcels();
  const fcRef = useRef<FeatureCollection>(fc);
  fcRef.current = fc;
  // م9.9 (A1) · تخبئة مراكز القطع: تُحسب مرّة عند تغيّر القطع وتُقرأ في حلقة النبضات/التسميات كلّ إطار
  // بدل centroid() لكلّ قطعة كلّ إطار أثناء الحركة — نفس القيمة بالضبط (صفر تغيير بصريّ)؛ المفتاح ref_id.
  const centroidMap = useMemo(() => {
    const map = new Map<string, [number, number]>();
    for (const f of fc.features) {
      if (!f.geometry) continue;
      const rid = f.properties?.ref_id;
      if (rid == null) continue;
      map.set(String(rid), centroid(f as Feature).geometry.coordinates as [number, number]);
    }
    return map;
  }, [fc]);
  const centroidMapRef = useRef(centroidMap);
  centroidMapRef.current = centroidMap;
  const drawRef = useRef<TerraDraw | null>(null);
  const linkTargetRef = useRef<DrawTarget | null>(null);
  // استوديو الرسم (م7.1): وضعية الرسم + مساحة حيّة + تحرير قائم + مرسى الأبعاد + فلترة الحي + لوحة الطبقات
  const [drawMode, setDrawMode] = useState<DrawModeId>("off");
  const drawModeRef = useRef<DrawModeId>(drawMode);
  drawModeRef.current = drawMode;
  const [liveArea, setLiveArea] = useState<number | null>(null);
  const [editing, setEditing] = useState<EditingRef | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [dimAnchor, setDimAnchor] = useState<{ lng: number; lat: number } | null>(null);
  const [nbhFilter, setNbhFilter] = useState("");
  const [nbhQuery, setNbhQuery] = useState(""); // بحث قائمة الأحياء المدمجة (م7.9 — لا منسدلة منبثقة بعد اليوم)
  const [showLayers, setShowLayers] = useState(false);
  const [showNbh, setShowNbh] = useState(false); // م8.9 · منسدلة فلتر الحي العائمة (مستقلة عن لوحة الطبقات)
  const [drawOpen, setDrawOpen] = useState(false); // طيّ/فتح استوديو الرسم — لا يتعارض مع لوحة الطبقات
  const [sfxMuted, setSfxMutedState] = useState(false); // كتم الصوت العام (يُهيّأ من localStorage بعد الترطيب)
  useEffect(() => setSfxMutedState(isSfxMuted()), []);
  // مرساة شارة القطعة (إسقاط شاشة يتبع الزوم/التنقّل حيّاً)
  const [calloutPx, setCalloutPx] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const calloutAnchorRef = useRef<[number, number] | null>(null);
  // التسميات المحرَّرة (م7.3)
  const { fc: annFc } = useMapAnnotations();
  const annFcRef = useRef(annFc);
  annFcRef.current = annFc;
  const [showAnnotations, setShowAnnotations] = useState(true);
  const showAnnotationsRef = useRef(showAnnotations);
  showAnnotationsRef.current = showAnnotations;
  const [annAnchor, setAnnAnchor] = useState<{ lng: number; lat: number } | null>(null);
  const annPendingRef = useRef<{ name: string; type: string } | null>(null);
  const [annEdit, setAnnEdit] = useState<{ id: string; name: string; type: string } | null>(null);
  const [annSaving, setAnnSaving] = useState(false);
  const queryClient = useQueryClient();
  const qcRef = useRef(queryClient);
  qcRef.current = queryClient;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(selectedId);
  selectedIdRef.current = selectedId;
  // م9.3 · القطعة المفترضة المعروضة ككيان ثلاثي هولوكرامي (حالة «تركيز» مستقلّة عن التحديد/البطاقة):
  // تُضبَط عند الطيران إليها (بلا فتح بطاقة) أو نقرها، وتُصفَّر عند العودة لكامل نينوى أو نقر الفراغ.
  const [modelFocusId, setModelFocusId] = useState<string | null>(null);
  const modelFocusRef = useRef<string | null>(modelFocusId);
  modelFocusRef.current = modelFocusId;
  // م9.13 · بطاقة المجسّم الهولوغراميّة: تنبثق **بعد استقرار الكاميرا** على المجسّم المركَّز (نهاية مدار الدرون)، وتُرسى فوق قمّته.
  const [settledModelId, setSettledModelId] = useState<string | null>(null);
  const settledModelIdRef = useRef<string | null>(settledModelId);
  settledModelIdRef.current = settledModelId;
  const holoMatrixRef = useRef<HTMLDivElement | null>(null); // مستوى البطاقات — يُحدَّث transform مباشرةً كلّ إطار رسم (بلا ارتجاف)
  const modelCardAnchorRef = useRef<{ center: [number, number]; heightM: number; refZoom: number; refBearing: number } | null>(null);
  // م9.17 · تعتيم محيطيّ منسّق (vignette) حول المجسّم المركَّز عند الهبوط تحت ٢كم — يُحدَّث عبر ref كلّ إطار (بلا ارتجاف)
  const vignetteRef = useRef<HTMLDivElement | null>(null);
  const vignKeyRef = useRef<string>("off");
  // م9.7.4 · وضع الاستعراض الحرّ (تدوير المجسّم بكل الاتجاهات + زوم — شبه سكتشفاب)
  const [orbitOn, setOrbitOn] = useState(false);
  const orbitOnRef = useRef(orbitOn); // للنقر: تجاهُل نقرات الخريطة أثناء الاستعراض الحرّ (لئلّا تُلغي التركيز/البطاقات)
  orbitOnRef.current = orbitOn;
  // م9.17 · مشهد الاستقرار المعتمَد يدويّاً: يُلتقَط من الكاميرا الحيّة (ارتفاع + ميل + موضع المجسّم كنسبة من الشاشة) ويُطبَّق على كلّ استقرار. يُحفَظ محلّيّاً.
  const settleViewsRef = useRef<Record<string, SettleView>>({}); // مشهد استقرار مستقلّ لكلّ موقع (مفتاحه ref_id)
  const [savedViewIds, setSavedViewIds] = useState<string[]>([]);
  // م9.10 · الجولة السينمائيّة الأوتوماتيكيّة (تُخفي الواجهة وتقود الكاميرا بمسار RAF)
  const tourActive = useTourActive();
  const cinematicActive = useCinematicTourActive(); // م9.18 · جولة سينمائيّة نشطة (تُخفي الواجهة لكن تُبقي البطاقات)
  // م9.3ب · نماذج 3D المرفوعة لكل القطع المفترضة + شبكات STL المحلَّلة (تحلّ محلّ الكتلة الإجرائية على الخريطة)
  const { data: assumedModels = [] } = useAssumedModels();
  const { data: parametricCfg } = useAssumedParametric(); // م9.7.1ب · إعداد النموذج البارامتري لكل قطعة (من المنسدلة)
  const [stlMeshes, setStlMeshes] = useState<Map<string, StlMesh>>(new Map());
  // م9.7.1ج/هـ/و · م9.7.2 · ذاكرة شبكات النماذج البارامترية + الحلقات + ظلّ التماس لكل قطعة مفترضة (تُولَّد مرّة، تُخبّأ بالمعرّف)
  const towerCacheRef = useRef<Map<string, { tower: TowerMeshes; rings: Mesh3; shadow: Mesh3; kind: ModelKind; footprintM: number; heightM: number }>>(new Map());
  // م9.7.7 · طبقات ثابتة + عناصر الأبراج (للنبض المتحرّك) + طور النبض — يحدّثها effect الطبقات، ويحرّكها RAF
  const staticLayersRef = useRef<Layer[]>([]);
  const towerItemsRef = useRef<TowerItem[]>([]);
  // م9.7.9 · أبعاد المجسّم لكلّ قطعة (بصمة + ارتفاع بالمتر) — لتأطير الكاميرا للمجسّم كاملاً عند الطيران (زوم درون يتناسب مع الحجم)
  const modelDimsRef = useRef<Map<string, { footprintM: number; heightM: number; kind: ModelKind }>>(new Map());
  const droneRafRef = useRef(0); // م9.7.11 · مُعرّف حلقة التفاف الدرون (RAF) — لإلغائها عند طيران جديد/تغيّر التركيز/التفكيك
  const ringPhaseRef = useRef(0);
  // م9.10 · مراجع محرّك الجولة — RAF المسار + مؤقّت وضع تقليل الحركة + الخطّ الزمنيّ + قائمة المواقع الكاملة (للقائد)
  const tourActiveRef = useRef(false);
  const tourRafRef = useRef(0);
  const tourTimerRef = useRef(0);
  const tourTimelineRef = useRef<TourTimeline | null>(null);
  const tourStartTsRef = useRef(0);
  const tourLoopRef = useRef(false);
  const tourModeRef = useRef(1);
  const tourLocsRef = useRef<Map<string, TourLoc & { nameAr: string }>>(new Map());
  // م9.18 · الجولة السينمائيّة المنفصلة — سلسلة طيرانات مفردة (مشهد معتمَد + بطاقات) بين المواقع، بطاقات غير متراكمة
  const cineActiveRef = useRef(false);
  const cineLocsRef = useRef<string[]>([]);
  const cineIdxRef = useRef(0);
  const cineLoopRef = useRef(false);
  const cineTimerRef = useRef(0);
  const cineDepartRafRef = useRef(0);
  const cineWhooshRef = useRef<FlightWhooshHandle | null>(null); // م9.18 · سووش الطيران الهادئ (يُقاد بسرعة انتقال الكاميرا)
  const cineAudioRafRef = useRef(0); // م9.18 · حلقة قياس سرعة الكاميرا لقيادة السووش
  const cineFlightRef = useRef(false); // م9.18 · بوّابة الصوت: يُسمَع **فقط** أثناء الطيران نحو التالي (من بدء الانجراف حتّى الاستقرار)
  useEffect(() => {
    registerModelLoaders();
  }, []);
  useEffect(() => {
    let alive = true;
    const pending = assumedModels.filter((m) => m.format === "stl" && !stlMeshes.has(m.id));
    if (!pending.length) return;
    void Promise.all(
      pending.map(async (m) => {
        try {
          const buf = await (await fetch(m.url)).arrayBuffer();
          return [m.id, parseBinaryStl(buf)] as const;
        } catch {
          return null;
        }
      }),
    ).then((pairs) => {
      const fresh = pairs.filter(Boolean) as (readonly [string, StlMesh])[];
      if (!alive || !fresh.length) return;
      setStlMeshes((prev) => {
        const next = new Map(prev);
        for (const [id, mesh] of fresh) next.set(id, mesh);
        return next;
      });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stlMeshes حارس تخطٍّ فقط؛ التحميل يتبع تغيّر النماذج
  }, [assumedModels]);
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [showParcels, setShowParcels] = useState(true);
  const [hiddenStates, setHiddenStates] = useState<Set<string>>(() => new Set());
  const showParcelsRef = useRef(showParcels);
  showParcelsRef.current = showParcels;
  const hiddenStatesRef = useRef(hiddenStates);
  hiddenStatesRef.current = hiddenStates;
  const nbhFilterRef = useRef(nbhFilter);
  nbhFilterRef.current = nbhFilter;
  const editingRef = useRef(editing);
  editingRef.current = editing;
  // م8.3 · تسميات الدبابيس عند الزوم القريب (~1كم): بطاقات زجاجية صغيرة فوق الدبابيس، تظهر/تتلاشى مع الزوم
  const [pinLabels, setPinLabels] = useState<{ x: number; y: number; name: string; key: string }[]>([]); // م8.10 · بطاقات شفافة صغيرة فوق الدبوس
  const [labelOpacity, setLabelOpacity] = useState(0);
  const [pinPings, setPinPings] = useState<{ x: number; y: number; lng: number; lat: number; key: string; color: string }[]>([]); // م8.8 · نبضات الموقع (+ lng/lat لتموضع فوريّ متزامن مع الخريطة — م9.9)
  const [pingScale, setPingScale] = useState(1); // م8.8.2 · حجم النبضة المرن مع الزوم (يصغر عند الإبعاد لتفادي التداخل)
  const [pingTilt, setPingTilt] = useState({ deg: 48, persp: 1200 }); // م8.12.1 · ميل حلقات النبضة لتنبسط على الأرض في 3D (rotateX = ميل الكاميرا · perspective ≈ مسافة الكاميرا)
  // م9.9 · مراجع لتموضع النبضات فوريّاً بتزامن مع رسم الخريطة (يزيل انزلاق/ارتجاف الحلقات أثناء حركة الكاميرا)
  const pingScaleRef = useRef(1);
  pingScaleRef.current = pingScale;
  const pingTiltDegRef = useRef(48);
  pingTiltDegRef.current = pingTilt.deg;
  const pingLayerRef = useRef<HTMLDivElement>(null);
  const [altM, setAltM] = useState(0); // م8.8 · ارتفاع الكاميرا الفعلي (متر) من MapLibre — مؤشّر الارتفاع الجوي
  const [mapReady, setMapReady] = useState(false);
  const [webglError, setWebglError] = useState(false); // م9.11 · تعذّر إنشاء سياق WebGL (تسريع عتاد معطّل/GPU reset) — رسالة لطيفة بدل انهيار
  const [prefetchPct, setPrefetchPct] = useState<number | null>(null); // م9.9 (②) · نسبة التحميل الكامل للمدينة مسبقاً (null = خفيّ/منتهٍ)
  const prefetchRef = useRef<PrefetchHandle | null>(null);
  const prefetchStartedRef = useRef(false); // يضمن بدء التحميل الكامل مرّة واحدة (عند جهوز الخريطة + القطع)
  const { data: settingsData } = useSettings();
  const startApplied = useRef(false);
  const showBoundariesRef = useRef(showBoundaries);
  showBoundariesRef.current = showBoundaries;
  const opps = useTable<Opportunity>("opportunities");
  const lics = useTable<License>("licenses");
  const assumed = useTable<AssumedParcel>("assumed_parcels");
  const oppsRef = useRef<Opportunity[]>([]);
  oppsRef.current = opps.data ?? [];
  const licsRef = useRef<License[]>([]);
  licsRef.current = lics.data ?? [];
  const assumedRef = useRef<AssumedParcel[]>([]);
  assumedRef.current = assumed.data ?? [];

  useEffect(() => {
    let cancelled = false;
    let map: GLMap | null = null;

    void (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !containerRef.current) return;

      if (maplibregl.getRTLTextPluginStatus() === "unavailable") {
        // عنوان مطلق (origin) أمتن لعامل importScripts على الشبكة البطيئة من المسار النسبيّ؛ lazy يبقى (يُحمَّل عند أوّل نصّ عربيّ).
        maplibregl.setRTLTextPlugin(`${window.location.origin}/vendor/mapbox-gl-rtl-text.js`, true);
      }

      const [gov, districts, subdistricts] = (await Promise.all([
        fetch("/api/boundaries/governorate").then((r) => r.json()),
        fetch("/api/boundaries/districts").then((r) => r.json()),
        fetch("/api/boundaries/subdistricts").then((r) => r.json()),
      ])) as [FeatureCollection, FeatureCollection, FeatureCollection];
      if (cancelled) return;

      const bounds = bbox(gov) as [number, number, number, number];
      const maskFC = mask(gov as FeatureCollection<Polygon | MultiPolygon>) as Feature<
        Polygon | MultiPolygon
      >;
      const data: MapData = { gov, districts, subdistricts, maskFC, bounds };
      dataRef.current = data;

      const style = await buildStyle(DEFAULT_BASE, data, satProviderRef.current);
      if (cancelled || !containerRef.current) return;

      try {
        map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: MAP_CENTER,
          zoom: INITIAL_ZOOM,
          maxZoom: MAX_ZOOM,
          // م9.9 (②) · كاش بلاط كبير يُبقي البلاطات مفكوكة في الذاكرة (لا إعادة فكّ/وميض عند العودة لموقع) — مع التحميل
          // المسبق ⇒ تنقّل بلا تقطّع. أعلى على الحاسوب، أهدأ على الجوّال (ضغط الذاكرة).
          maxTileCacheSize: typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches ? 900 : 2800, // م9.11 · كاش أوسع يُبقي العرض + بلاطات الجولة في الذاكرة (يقلّل الفجوات الكحليّة عند التنقّل السريع)
          pitch: 48, // م8.12 · العرض الافتراضي ثلاثي الأبعاد (3D) — قابل للتبديل لـ2D (fitBounds/flyTo تحفظ الميل)
          maxPitch: 85, // م9.7.4 · ميل أعمق لاستعراض المجسّمات من زوايا منخفضة (تدوير حرّ شبه-سكتشفاب)
          attributionControl: false, // م8.8: لا زرّ «!» منبثق
        });
      } catch (err) {
        // م9.11 · تعذّر سياق WebGL (تسريع العتاد معطّل / GPU reset / سياقات WebGL مستنزَفة) — لا تُسقِط الواجهة، اعرض رسالة لطيفة قابلة للتعافي.
        console.error("[map] تعذّر إنشاء سياق WebGL — تهيئة الخريطة فشلت", err);
        if (!cancelled) setWebglError(true);
        return;
      }
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      // م8.8: النسب القانوني مفتوحاً دائماً بلا زرّ تبديل «!» (صون ترخيص MapTiler/OSM)
      map.addControl(new maplibregl.AttributionControl({ compact: false }), "bottom-left");

      // §ز.5 · فشل الخريطة (الشبكة): تنبيه مخفَّف (مرّة/60 ثانية) — البيانات والأقسام تبقى متاحة من السايدبار
      let lastMapErrorAt = 0;
      map.on("error", (e) => {
        if (mapDegraded) return; // في حالة التدهور (429/أساس احتياطيّ) المستخدم نُبّه مرّة — لا تكرار لرسائل الأخطاء
        const msg = e?.error?.message ?? "";
        if (!/fetch|network|http|upstream|tile|source|style|failed/i.test(msg)) return; // أخطاء الشبكة/المصادر (لا ضجيج حميد)
        const now = Date.now();
        if (now - lastMapErrorAt < 60_000 || !navigator.onLine) return; // لافتة الانقطاع تغطّي حالة الأوفلاين
        lastMapErrorAt = now;
        toast.error("تعذّر تحميل بعض طبقات الخريطة — تُعاد المحاولة تلقائياً");
      });

      // صورة شفّافة بديلة لأي صورة مفقودة (تمنع المربّعات السوداء وتُسكت التحذيرات)
      map.on("styleimagemissing", (e) => {
        const m = mapRef.current;
        if (!m || m.hasImage(e.id)) return;
        m.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
      });

      // قفل الحدود على اتحاد (صندوق المحافظة + هامش) ∪ (المنظر الحالي) → بلا قفزة + تنقّل سلس
      const lockView = () => {
        const m = mapRef.current;
        if (!m) return;
        const [w, s, e, n] = bounds;
        const p = MAX_BOUNDS_PADDING_DEG;
        const vb = m.getBounds();
        m.setMaxBounds([
          [Math.min(w - p, vb.getWest()), Math.min(s - p, vb.getSouth())],
          [Math.max(e + p, vb.getEast()), Math.max(n + p, vb.getNorth())],
        ]);
        m.setMinZoom(m.getZoom()); // الأدنى = المحافظة كاملة
      };

      map.on("load", () => {
        const m = mapRef.current;
        if (cancelled || !m) return;
        // طبقة القطع الملوّنة (deck.gl فوق الخريطة)
        // م9.9 (C) · سقف DPR للجوال: على شاشات الجوال (DPR≈3 · 120Hz) نُحدّد دقّة canvas الـ3D بـ2 (لا يتجاوز DPR الجهاز)
        // لخفض كلفة fill-rate كثيراً مع حدّة تبقى ريتينا — **الخريطة الأساس تبقى بدقّتها الكاملة** (canvas منفصل). الحاسوب بلا تغيير.
        const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
        const overlayDpr = isMobile ? Math.min(window.devicePixelRatio || 2, 2) : true;
        const overlay = new MapboxOverlay({ interleaved: false, useDevicePixels: overlayDpr, effects: [MODEL_LIGHTING], layers: parcelLayers(fcRef.current, selectedIdRef.current) });
        m.addControl(overlay);
        overlayRef.current = overlay;
        // م8.8.2 · ارفع لوحة deck (القطع + الإشارات) فوق طبقة النبضات (z-9) كي تظهر النبضات **تحت** الدبابيس
        // (لا تغطّيها عند التداخل). z=10 يبقى دون التسميات (12) ومؤشّر الارتفاع (13) والأدوات (20).
        const deckCanvas = Array.from(m.getContainer().querySelectorAll<HTMLCanvasElement>("canvas")).find((c) => !c.classList.contains("maplibregl-canvas"));
        if (deckCanvas) deckCanvas.style.zIndex = "10";
        // نقر إشارة القطعة ← نافذة منبثقة (موقع/عرض)؛ نقر قطعة ← تحديدها؛ نقر فراغ ← إلغاء
        m.on("click", (e) => {
          const ov = overlayRef.current;
          if (!ov) return;
          if (orbitOnRef.current) return; // أثناء الاستعراض الحرّ: السحب يُفسَّر نقراً — تجاهُله كي لا يُلغي تركيز/بطاقات المجسّم
          // استوديو الرسم (م7.1): الوضعيات تستهلك النقر قبل التحديد/النوافذ
          const dm = drawModeRef.current;
          if (dm === "dimensions") {
            setMkSel(null);
            setDimAnchor({ lng: e.lngLat.lng, lat: e.lngLat.lat });
            return;
          }
          if (dm === "annotate") {
            setMkSel(null);
            setAnnAnchor({ lng: e.lngLat.lng, lat: e.lngLat.lat });
            return;
          }
          if (dm === "edit") {
            const picked = ov.pickObject({ x: e.point.x, y: e.point.y, radius: 6, layerIds: ["parcels"] });
            const props = picked?.object?.properties as ParcelProps | undefined;
            if (props?.ref_id) editStartRef.current?.(props);
            return;
          }
          if (dm !== "off") return; // أثناء الإنشاء: terra-draw يتكفّل بالنقر
          // نقر تسمية محرَّرة ← تحرير/حذف (م7.3)
          const annLayers = ANN_CLICK_LAYERS.filter((l) => m.getLayer(l));
          if (annLayers.length && showAnnotationsRef.current) {
            const hit = m.queryRenderedFeatures(e.point, { layers: annLayers })[0];
            const ap = hit?.properties as { id?: string; name?: string; element_type?: string } | undefined;
            if (ap?.id) {
              setMkSel(null);
              setAnnEdit({ id: ap.id, name: ap.name ?? "", type: ap.element_type ?? "landmark" });
              return;
            }
          }
          const mk = ov.pickObject({ x: e.point.x, y: e.point.y, radius: 10, layerIds: ["parcel-markers"] });
          const mkObj = mk?.object as
            | { ref_id?: string; position?: [number, number]; label?: string; kind?: string; entity_id?: string }
            | undefined;
          if (mkObj?.ref_id) {
            // م7.8: بطاقة هولوكرامية بخط ربط تتبع الإشارة حيّاً — فوق كل الطبقات (بدل Popup التي كانت تختفي خلف الإشارات)
            setMkSel({
              refId: mkObj.ref_id,
              label: mkObj.label ?? null,
              kind: (mkObj.kind as ParcelKind) || "assumed",
              entityId: mkObj.entity_id ?? "",
              lngLat: (mkObj.position ?? [e.lngLat.lng, e.lngLat.lat]) as [number, number],
            });
            return;
          }
          const info = ov.pickObject({ x: e.point.x, y: e.point.y, radius: 5, layerIds: ["parcels"] });
          const ref = info?.object?.properties?.ref_id;
          const knd = info?.object?.properties?.kind;
          setSelectedId(typeof ref === "string" ? ref : null);
          // م9.3/م9.17 · نقر قطعة مفترضة يركّز كيانها؛ نقر الفراغ لا يُلغي التركيز/البطاقات (تبقى حتى نقر بطاقة أو العودة لكامل نينوى).
          if (typeof ref === "string" && knd === "assumed") setModelFocusId(ref);
          setMkSel(null);
        });

        // استوديو الرسم (terra-draw · م7.1): مضلّع · مستطيل · دائرة · تحرير (select) — بنمط بنفسجي موحّد
        const SHAPE_STYLE = {
          fillColor: "#22C3F3",
          fillOpacity: 0.25,
          outlineColor: "#22C3F3",
          outlineWidth: 2,
        } as const;
        const draw = new TerraDraw({
          adapter: new TerraDrawMapLibreGLAdapter({ map: m }),
          modes: [
            new TerraDrawPolygonMode({
              styles: { ...SHAPE_STYLE, closingPointColor: "#C7A24E", closingPointWidth: 5 },
              snapping: { toCoordinate: true }, // جذب لرؤوس القطع المجاورة — رسم متلاصق نظيف
            }),
            new TerraDrawRectangleMode({ styles: SHAPE_STYLE }),
            new TerraDrawCircleMode({ styles: SHAPE_STYLE }),
            new TerraDrawSelectMode({
              styles: {
                selectedPolygonColor: "#C7A24E",
                selectedPolygonFillOpacity: 0.18,
                selectedPolygonOutlineColor: "#C7A24E",
                selectedPolygonOutlineWidth: 2.5,
                selectionPointColor: "#C7A24E",
                selectionPointWidth: 6,
                selectionPointOutlineColor: "#0b1220",
                selectionPointOutlineWidth: 1.5,
                midPointColor: "#94afd1",
                midPointWidth: 4,
              },
              flags: {
                polygon: {
                  feature: { draggable: true, coordinates: { draggable: true, deletable: true, midpoints: true } },
                },
              },
            }),
          ],
        });
        draw.start();
        // مساحة حيّة توضيحية أثناء الرسم/التحرير (المساحة الرسمية من البيانات)
        draw.on("change", () => {
          try {
            const f = draw.getSnapshot().find((sf) => sf.geometry?.type === "Polygon");
            setLiveArea(f ? turfArea(f as unknown as Feature<Polygon>) : null);
          } catch {
            // تجاهل ومضات إعادة التحميل
          }
        });
        draw.on("finish", (id) => {
          if (drawModeRef.current === "edit") return; // التحرير يُحفَظ صراحةً بزرّ «حفظ الحدود»
          const d = drawRef.current;
          if (!d) return;
          const feat = d.getSnapshot().find((f) => f.id === id);
          if (!feat || feat.geometry?.type !== "Polygon") return;
          void persistRef.current?.(feat as unknown as Feature<Polygon>);
        });
        drawRef.current = draw;
        setMapReady(true);

        // مقاييس م2.3 + إظهار الحدود + التسميات المحرَّرة (بعد جهوز المصادر)
        applyStats(m, dataRef.current, oppsRef.current, licsRef.current, assumedRef.current);
        applyVisibility(m, showBoundariesRef.current);
        applyAnnotations(m, annFcRef.current, showAnnotationsRef.current);

        m.fitBounds(bounds, { padding: framePadding(48), duration: 2200 }); // دخول متسارع (حشوة جوال تؤطّر المحافظة فوق شريط البحث)
        m.once("moveend", lockView);
      });
    })();

    return () => {
      cancelled = true;
      prefetchRef.current?.cancel();
      prefetchRef.current = null;
      try {
        drawRef.current?.stop();
      } catch {
        /* تجاهل */
      }
      drawRef.current = null;
      map?.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  // تحديث طبقات القطع عند تغيّر البيانات/التحديد/الإظهار/الحالات/الحي/التحرير (انعكاس لحظي)
  useEffect(() => {
    const vis = showParcels
      ? {
          ...fc,
          features: fc.features.filter((f) => {
            const p = f.properties ?? {};
            if (hiddenStates.has(String(p.state ?? ""))) return false;
            if (nbhFilter && p.neighborhood !== nbhFilter) return false;
            if (editing && p.ref_id === editing.refId) return false; // نسخته تُحرَّر في terra-draw
            return true;
          }),
        }
      : null;
    // م9.3ب · طبقات النماذج المرفوعة (نموذج لكل قطعة مفترضة لها نموذج) + استثناؤها من الكتلة الإجرائية.
    const refIds = new Set(assumedModels.map((m) => m.refId));
    const items: ModelRenderItem[] = vis
      ? (assumedModels
          .map((m) => {
            const f = vis.features.find((ft) => ft.properties?.ref_id === m.refId);
            if (!f?.geometry) return null;
            const center = centroid(f as Feature<Polygon | MultiPolygon>).geometry.coordinates as [number, number];
            return { model: m, center, mesh: m.format === "stl" ? stlMeshes.get(m.id) : undefined } satisfies ModelRenderItem;
          })
          .filter(Boolean) as ModelRenderItem[])
      : [];
    // م9.7.1ج · أبراج بارامترية للقطع المفترضة التي لا نموذجَ مرفوع لها — تُولَّد من بصمة القطعة وتُخبّأ بالمعرّف.
    const towerItems: TowerItem[] = [];
    const towerRefIds = new Set<string>();
    const glbRefIds = new Set<string>(); // م9.11 · قطع ذات نموذج glb ثابت (تُخفى رسمتها الهولوكراميّة)
    if (vis) {
      for (const f of vis.features) {
        const rid = typeof f.properties?.ref_id === "string" ? (f.properties.ref_id as string) : null;
        if (f.properties?.kind !== "assumed" || !rid || refIds.has(rid) || !f.geometry) continue;
        const b = bbox(f as Feature) as [number, number, number, number];
        const clat = (b[1] + b[3]) / 2;
        const mPerLng = 111320 * Math.cos((clat * Math.PI) / 180);
        const wM = (b[2] - b[0]) * mPerLng; // عرض البصمة بالمتر
        const dM = (b[3] - b[1]) * 110540; // عمق البصمة بالمتر
        if (wM < 4 || dM < 4) continue;
        // م9.7.1ب · الإعداد من المنسدلة (نوع + عدد + توزيع)، وإلا تلقائيّ من الاسم.
        const cfg = parametricCfg?.get(rid);
        const kind = cfg?.modelKind ?? tempKindFor(typeof f.properties?.name_ar === "string" ? (f.properties.name_ar as string) : "");
        const count = Math.max(1, Math.min(24, cfg?.count ?? 1));
        const distribution = cfg?.distribution ?? "grid";
        const rotationDeg = cfg?.rotationDeg ?? 0; // م9.7.8 · توجيه المجسّم
        const wOv = cfg?.widthM && cfg.widthM > 0 ? cfg.widthM : null; // أبعاد يدويّة (إن وُجدت)
        const dOv = cfg?.depthM && cfg.depthM > 0 ? cfg.depthM : null;
        const hOv = cfg?.heightM && cfg.heightM > 0 ? cfg.heightM : null;
        const cols = distribution === "row" ? count : Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        // شبكة واحدة بحجم الخليّة (تُعاد استخدامها في كلّ المواضع) — تُخبّأ بمفتاح يشمل الأبعاد (الدوران يُطبَّق بالعرض لا بالشبكة).
        const cacheKey = `${rid}|${kind}|${count}|${distribution}|${wOv ?? ""}|${dOv ?? ""}|${hOv ?? ""}`;
        let cached = towerCacheRef.current.get(cacheKey);
        if (!cached) {
          const fmul = kind === "mall" ? 0.5 : kind === "hotel" ? 0.6 : 0.5; // بصمة المبنى التلقائيّة (المول يُحيط نفسه بمرافق)
          const cellWm = wM / cols;
          const cellDm = dM / rows;
          const fw = wOv ?? Math.max(8, cellWm * fmul); // عرض يدويّ أو تلقائيّ
          const fd = dOv ?? Math.max(8, cellDm * fmul); // عمق يدويّ أو تلقائيّ
          const tower = generateModel(kind, fw, fd, hOv ?? undefined);
          const bMin = Math.min(fw, fd); // بصمة المبنى الفعليّة
          const rings = generateGroundRings(0.5 * Math.hypot(fw, fd) * 1.2); // نصف قطر يُحيط بصمة المجسّم كاملةً (قطرها + هامش) فلا تتقاطع الحلقة مع زواياه — تنبض من تحت حدّه للخارج
          const sr = bMin * 0.42;
          const shadow = generateContactShadow(sr, sr * 0.28, sr * 0.55);
          cached = { tower, rings, shadow, kind, footprintM: Math.max(fw, fd), heightM: tower.height };
          towerCacheRef.current.set(cacheKey, cached);
        }
        modelDimsRef.current.set(rid, { footprintM: cached.footprintM, heightM: cached.heightM, kind: cached.kind }); // للكاميرا (يشمل إصابة التخبئة) + النوع لضبط ارتفاع الدرون
        // المواضع: واحد عند المركز · عدّة على شبكة داخل البصمة (مع نثر اختياريّ).
        if (count === 1) {
          const center = centroid(f as Feature<Polygon | MultiPolygon>).geometry.coordinates as [number, number];
          const nm = typeof f.properties?.label === "string" ? (f.properties.label as string) : ""; // اسم القطعة في label (لا name_ar)
          const sm = STATIC_MODELS.find((s) => s.match(nm));
          if (sm) {
            // م9.11 · نموذج واقعيّ (glb) محلّ الإجرائيّ لهذه القطعة — يُقاس ليطابق بصمتها، وتبقى له حلقة سونار مركزيّة.
            const autofit = Math.max(0.05, Math.min(wM, dM) / sm.extentUnits); // ملاءمة تلقائيّة لبصمة القطعة (موحّدة)
            // م9.11 · أبعاد الـglb بوحداته (من فحص gltf-transform): عرض×ارتفاع×عمق + أدنى y. التحكّم اليدويّ (المنسدلة) يقيس كلّ محور بالمتر؛ غير المضبوط يُلائم القطعة.
            const GLB_W = 26.3;
            const GLB_H = 13.8;
            const GLB_D = 22.86;
            const GLB_MIN_Y = -0.37;
            const glbScale: [number, number, number] | undefined =
              wOv || dOv || hOv ? [wOv ? wOv / GLB_W : autofit, hOv ? hOv / GLB_H : autofit, dOv ? dOv / GLB_D : autofit] : undefined;
            const sX = glbScale ? glbScale[0] : autofit;
            const sY = glbScale ? glbScale[1] : autofit;
            const sZ = glbScale ? glbScale[2] : autofit;
            const glbYaw = sm.yaw + rotationDeg;
            // م9.11 · أساس بسُمك: من أسفل المبنى (أدنى bbox × المقياس) إلى ما تحت الأرض ⇒ يملأ فجوة الرفع فيلتصق بالأرض. بنفس توجيه المبنى.
            const baseTopZ = sm.elevationM + GLB_MIN_Y * sY + 0.3;
            const base = { mesh: generateFoundation(0.5 * GLB_W * sX * 0.98, 0.5 * GLB_D * sZ * 0.98, -1.2, baseTopZ), color: [88, 79, 67, 255] as [number, number, number, number] }; // م9.11 · امتداد عمق ضحل بلون حجر داكن مطابق للجدار الخارجيّ
            // م9.11 · حلقات بنصف قطر القطعة + مدى يبدأ من حول قاعدة المبنى للخارج ⇒ تنبثق من تحته ولا تغطّي بلاط الساحة.
            glbRefIds.add(rid); // تُخفى رسمة هذه القطعة (المبنى يمثّلها ويغطّيها)
            towerItems.push({ id: rid, center, kind: cached.kind, yaw: glbYaw, glb: { url: sm.url, sizeScale: glbScale ? 1 : autofit, scale: glbScale, yaw: glbYaw, elevationM: sm.elevationM, lighting: sm.lighting }, base, rings: generateGroundRings(0.5 * Math.hypot(wM, dM)), ringSpread: { min: 0.82, max: 2.1 } });
          } else {
            towerItems.push({ id: rid, center, meshes: cached.tower, kind: cached.kind, yaw: rotationDeg, rings: cached.rings, ringSpread: { min: 0.88, max: 1.9 }, shadow: cached.shadow }); // م9.17 · تبدأ الموجة من حدّ بصمة المجسّم للخارج (لا تعبر بلاطه)
          }
        } else {
          const bw = b[2] - b[0];
          const bh = b[3] - b[1];
          const cLng = (b[0] + b[2]) / 2;
          const cLat = (b[1] + b[3]) / 2;
          // م9.9 (B1) · المجسّمات بلا حلقات فرديّة — الموقع متعدّد المجسّمات كيانٌ واحد له حلقة نابضة مركزيّة (أدناه).
          // كلّ النُسخ تتشارك نفس الشبكة/الخامة/التوجيه ⇒ تُرسَم **instanced** (نداء رسم واحد/سطح بدل N) — صفر تغيير بصريّ.
          const instances: { center: [number, number]; yaw: number }[] = [];
          for (let i = 0; i < count; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            let lng = b[0] + ((col + 0.5) * bw) / cols;
            let lat = b[1] + ((row + 0.5) * bh) / rows;
            if (distribution === "scatter") {
              const jx = (Math.abs(Math.sin((i + 1) * 12.9898) * 43758.5453) % 1) - 0.5;
              const jy = (Math.abs(Math.sin((i + 1) * 78.233) * 43758.5453) % 1) - 0.5;
              lng += (jx * bw * 0.34) / cols;
              lat += (jy * bh * 0.34) / rows;
            }
            instances.push({ center: [lng, lat], yaw: rotationDeg });
          }
          towerItems.push({ id: rid, center: [cLng, cLat], meshes: cached.tower, kind: cached.kind, instances, shadow: cached.shadow });
          // حلقة نابضة مركزيّة واحدة تُحيط المجسّمات كلّها (نفس سلوك المفرد، لكن للموقع ككيان واحد)
          towerItems.push({ id: `${rid}#rings`, center: [cLng, cLat], kind: cached.kind, rings: generateGroundRings(0.5 * Math.hypot(wM, dM) * 1.05), ringSpread: { min: 0.95, max: 2.0 } }); // م9.17 · تبدأ من حدّ القطعة وبلاطها للخارج (لا تعبر بين المباني)
          // حديقة ممرّ ممتدّة بين صفوف الأبراج (٤ أبراج فأكثر · للأبراج فقط · لا حديقة للمفرد)
          if (kind === "tower" && count >= 4 && rows >= 2) {
            const gardenMesh = generateGardenStrip(wM * 0.96, (dM / rows) * 0.44); // يملأ الممرّ بين الصفّين بالطول الكامل دون تداخل مع الأبراج
            for (let r = 1; r < rows; r++) towerItems.push({ id: `${rid}#g${r}`, center: [cLng, b[1] + (r * bh) / rows], meshes: gardenMesh, kind: cached.kind });
          }
        }
        towerRefIds.add(rid);
      }
    }
    // م9.7.7 · الطبقات الثابتة تُخبّأ؛ الحلقات النابضة تُضاف فوقها ويحرّكها RAF (تحت المجسّم).
    const staticLayers = vis ? [...parcelLayers(vis, selectedId, refIds, towerRefIds, glbRefIds), ...buildModelLayers(items), ...buildTowerLayers(towerItems)] : [];
    staticLayersRef.current = staticLayers;
    towerItemsRef.current = towerItems;
    // م9.10 · انشر مواقع الجولة (كلّ قطعة مفترضة معروضة كمجسّم) — للنافذة (اختيار المواقع) وللقائد (بناء المسار).
    const tourMap = new Map<string, TourLoc & { nameAr: string }>();
    if (vis) {
      for (const f of vis.features) {
        const rid = typeof f.properties?.ref_id === "string" ? (f.properties.ref_id as string) : null;
        if (f.properties?.kind !== "assumed" || !rid || !f.geometry || tourMap.has(rid)) continue;
        const c = centroid(f as Feature<Polygon | MultiPolygon>).geometry.coordinates as [number, number];
        const nameAr =
          typeof f.properties?.name_ar === "string" && f.properties.name_ar
            ? (f.properties.name_ar as string)
            : typeof f.properties?.label === "string" && f.properties.label
              ? (f.properties.label as string)
              : rid;
        const dims = modelDimsRef.current.get(rid);
        let footprintM: number;
        let heightM: number;
        let kind: ModelKind;
        if (dims) {
          footprintM = dims.footprintM;
          heightM = dims.heightM;
          kind = dims.kind;
        } else {
          const bb = bbox(f as Feature) as [number, number, number, number];
          const wM = (bb[2] - bb[0]) * 111320 * Math.cos((c[1] * Math.PI) / 180);
          const dM = (bb[3] - bb[1]) * 110540;
          footprintM = Math.max(wM, dM, 12);
          heightM = footprintM * 0.6;
          kind = tempKindFor(nameAr);
        }
        const cfg = parametricCfg?.get(rid);
        const upl = assumedModels.find((m) => m.refId === rid);
        const rotationDeg = cfg?.rotationDeg ?? (typeof upl?.transform?.rotationDeg === "number" ? upl.transform.rotationDeg : 0);
        const closeApproach = STATIC_MODELS.some((s) => s.closeApproach && s.match(nameAr)); // م9.11 · جولة خاصّة لمبنى الهيئة الواقعيّ
        tourMap.set(rid, { refId: rid, nameAr, center: c, footprintM, heightM, kind, rotationDeg, closeApproach });
      }
    }
    tourLocsRef.current = tourMap;
    setTourLocations([...tourMap.values()].map((l) => ({ refId: l.refId, nameAr: l.nameAr, kind: l.kind })));
    overlayRef.current?.setProps({ layers: [...staticLayers, ...buildRingLayers(towerItems, ringPhaseRef.current)] });
  }, [fc, selectedId, assumedModels, parametricCfg, stlMeshes, showParcels, hiddenStates, nbhFilter, editing]);

  // م9.11 · تحميل مسبق **موفِّر** لبلاطات Google عند الدخول: عرض المدينة (صندوق القطع) z9→z12 + عمق حول كلّ قطعة z13→z16،
  // بسقف بلاطات محافظ. بلاطات Google تُخبَّأ يوماً (route) ⇒ التحميل المسبق يُحمّي الكاش فتنقّل/طيران/جولة بلا تقطّع، وإعادة
  // الزيارة لا تُعيد طلب Google (توفير). **يُفعَّل لمزوّد google فقط** (يبقى متخطّى لـMapTiler تفادي استنزاف حصّته المجانيّة).
  useEffect(() => {
    if (!PREFETCH_ENABLED || !mapReady || prefetchStartedRef.current) return;
    const m = mapRef.current;
    const feats = fc?.features ?? [];
    if (!m || feats.length === 0) return; // انتظر تحميل القطع لتُحسَب المنطقة الصحيحة
    const prov = satProviderRef.current;
    if (prov !== "google") { prefetchStartedRef.current = true; return; } // التحميل المسبق لـGoogle حصراً (كاش يوم) — لا MapTiler
    // المنطقة = **صندوق القطع** (المدينة حيث يجري العمل) لا المحافظة كاملةً (تفادي تحميل صحارى فارغة مكلِفة).
    const wide = (featuresBBox(feats) ?? dataRef.current?.bounds) as [number, number, number, number] | undefined;
    if (!wide) return; // لا منطقة صالحة بعد — أعد المحاولة عند تحديث القطع (لا تثبّت العلم)
    // مراكز **مواقع المجسّمات (أهداف الجولة) فقط** للتحميل العميق حولها (z15–z17 = زوم الجولة القريب) — تركيز الميزانيّة
    // حيث تنقضّ الكاميرا فعلاً، فيكون الوصول حادّاً فوراً. (التنقّل العامّ يكفيه العرض المُحمَّل z9–z14.)
    const deepPoints: [number, number][] = [];
    for (const f of feats) {
      if (f.properties?.kind !== "assumed") continue;
      const rid = (f.properties as { ref_id?: string | number } | null)?.ref_id;
      const c = (rid != null ? centroidMapRef.current.get(String(rid)) : undefined) ?? (f.geometry ? (centroid(f as Feature).geometry.coordinates as [number, number]) : undefined);
      if (c) deepPoints.push(c);
    }
    prefetchStartedRef.current = true; // مرّة واحدة — بعد ضمان بدء فعليّ
    prefetchRef.current = prefetchOverview(m, wide, {
      zMin: 9,
      zMax: 17,
      wideZMax: 14, // عرض المدينة حتى z14 (يغطّي ارتفاع طيران الانتقال ≈z15 بأسلاف حادّة ⇒ لا فجوات) + عمق z15–z17 حول المواقع
      deepPoints,
      deepRadius: 2, // ٥×٥ بلاطات حول كلّ موقع — يغطّي مدار العرض القريب (٤٠٠م–١٠٠٠م) بلا فجوات
      concurrency: 6,
      maxTiles: 1500, // سقف يحدّ كلفة Google (≈ بضعة دولارات/تحميل بارد، ثمّ مجّانيّ من الكاش يوماً)
      throttleMs: 60,
      onProgress: (d, t) => setPrefetchPct(t > 0 && d < t ? Math.round((d / t) * 100) : null),
    });
  }, [mapReady, fc]);

  // م9.9 · تحريك حلقات السونار — RAF بمعدّل كامل (60fps) فقط عند التقرّب z≥13 لتوسّع/تدفّق سلس تامّ بلا تقطّع
  // (في الحركة والسكون)؛ يعيد بناء طبقات الحلقات فقط فوق الطبقات الثابتة المخبّأة.
  useEffect(() => {
    if (!mapReady) return;
    let raf = 0;
    const PERIOD = 7000; // مدّة دورة النبض (مللي) — أبطأ (م9.9: تدفّق أبطأ + تباعد أكبر بين الحلقات)
    const tick = (now: number): void => {
      raf = requestAnimationFrame(tick);
      const m = mapRef.current;
      const items = towerItemsRef.current;
      if (!m || !overlayRef.current || items.length === 0) return;
      // م9.14 (③) · قيادة تحوّل الهولوغرام: تقدّم نحو الهدف (1 عند الاستقرار · 0 عند المغادرة) + الزمن لموجة المسح.
      const want = settledModelIdRef.current;
      if (want) {
        HOLO_STATE.settledId = want;
        HOLO_STATE.progress += (1 - HOLO_STATE.progress) * 0.12; // دخول ناعم (~٧٠٠مللي)
      } else {
        HOLO_STATE.progress += (0 - HOLO_STATE.progress) * 0.2; // خروج أسرع (~٣٠٠مللي)
        if (HOLO_STATE.progress < 0.004) {
          HOLO_STATE.progress = 0;
          HOLO_STATE.settledId = "";
        }
      }
      HOLO_STATE.time = now / 1000;
      const holoActive = HOLO_STATE.progress > 0.004;
      if (m.getZoom() < 13 && !holoActive) return; // لا نبض في العرض البعيد (صون الأداء) ما لم يكن تحوّل هولوغرام جارياً
      ringPhaseRef.current = (now % PERIOD) / PERIOD;
      overlayRef.current.setProps({ layers: [...staticLayersRef.current, ...buildRingLayers(items, ringPhaseRef.current)] });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mapReady]);

  // مقاييس م2.3: إعادة العدّ والحقن عند تغيّر القطع
  useEffect(() => {
    applyStats(mapRef.current, dataRef.current, opps.data ?? [], lics.data ?? [], assumed.data ?? []);
  }, [opps.data, lics.data, assumed.data]);

  // إظهار/إخفاء طبقة الحدود
  useEffect(() => {
    applyVisibility(mapRef.current, showBoundaries);
  }, [showBoundaries]);

  // إعدادات البدء (§هـ.5 العرض): أساس الخريطة الافتراضي + الطبقات الظاهرة — مرّة عند جهوز الخريطة والإعدادات معاً
  useEffect(() => {
    const s = settingsData?.settings;
    if (!s || !mapReady || startApplied.current) return;
    startApplied.current = true;
    setShowBoundaries(s.start_layers.boundaries !== false);
    setShowParcels(s.start_layers.parcels !== false);
    const base = s.default_base as BaseStyle;
    if (base && base !== baseRef.current && ["dark", "light", "satellite"].includes(base)) void switchBase(base);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- switchBase مستقر منطقياً (refs)
  }, [settingsData, mapReady]);

  // الانتقال لقطعة (§هـ.2): طيران فقط — الشارة تنبثق حصراً عند النقر المباشر على القطعة (م7.6)
  useEffect(() => {
    return onFlyTo((refId) => {
      if (tourActiveRef.current) return; // أثناء الجولة: القائد يملك الكاميرا — لا طيران مفرد متنازع
      const m = mapRef.current;
      const f = fcRef.current.features.find(
        (ft) =>
          ft.properties?.ref_id === refId ||
          (refId !== "" && (ft.properties?.entity_id === refId || ft.properties?.parcel_no === refId)),
      );
      if (m && f?.geometry) {
        if (!cineActiveRef.current) sfxFly(); // أثر طيران تقني ناعم (م7.9) — في الجولة يتكفّل السووش المستمرّ بالصوت (لا طلقة منقطعة)
        if (droneRafRef.current) {
          cancelAnimationFrame(droneRafRef.current); // أوقِف أي التفاف درون سابق قبل طيران جديد
          droneRafRef.current = 0;
        }
        const b = bbox(f) as [number, number, number, number];
        if (f.properties?.kind === "assumed") {
          // م9.3/م9.7.9 · الطيران لقطعة مفترضة يعرض كيانها الهولوكرامي فوراً (بلا فتح بطاقة)، مع حركة سينمائية:
          //   اقتراب يؤطّر **المجسّم كاملاً** (زوم يتناسب مع حجمه وارتفاعه) ثم **التفاف درون دائرة كاملة 360°** بسلاسة.
          const r = typeof f.properties?.ref_id === "string" ? (f.properties.ref_id as string) : null;
          setSettledModelId(null); // م9.13 · انكماش بطاقة المجسّم السابق فور بدء طيران جديد (تعود عند الاستقرار)
          setModelFocusId(r);
          setSelectedId(null); // لا تُفتَح البطاقة عند الطيران (طلب معتمد)
          setMkSel(null);
          const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
          const DRONE_PITCH = 60;
          const center = centroid(f).geometry.coordinates as [number, number]; // مركز القطعة = محور الالتفاف
          // الزوم يُبقي الكاميرا بعيدة (ارتفاع جوّي ≥ 1.2كم) فيظهر المبنى كاملاً ومحيطه، بتناسب طرديّ مع حجمه.
          // الأبعاد من المجسّم إن توفّرت، وإلّا من بصمة القطعة (b) — حتميّ لا يعتمد على تحميل الشبكة.
          const dims = r ? modelDimsRef.current.get(r) : undefined;
          const canvasH = m.getCanvas().clientHeight || 800; // نفس ارتفاع الكانفس المستخدَم في مؤشّر الارتفاع
          let fpM: number;
          let hM: number;
          if (dims) {
            fpM = dims.footprintM;
            hM = dims.heightM;
          } else {
            const wM = (b[2] - b[0]) * 111320 * Math.cos((center[1] * Math.PI) / 180); // عرض البصمة بالمتر
            const dM = (b[3] - b[1]) * 110540; // عمقها بالمتر
            fpM = Math.max(wM, dM, 12);
            hM = fpM * 0.6; // تقدير ارتفاع معقول حتى تُحمَّل الشبكة
          }
          const kindHere = dims?.kind ?? tempKindFor(typeof f.properties?.name_ar === "string" ? (f.properties.name_ar as string) : ""); // نوع المجسّم (المول يُؤطَّر أقرب)
          // م9.11 · القطع ذات نموذج glb ثابت (مثل هيئة الاستثمار) لها ارتفاع طيران مخصّص (أقرب) — وإلّا التأطير التلقائيّ حسب الحجم.
          const labelHere = typeof f.properties?.label === "string" ? (f.properties.label as string) : "";
          const smHere = STATIC_MODELS.find((s) => s.match(labelHere));
          const zoom = Math.max(
            12,
            Math.min(MAX_ZOOM, smHere?.flightAltM ? zoomForAltitude(smHere.flightAltM, center[1], canvasH) : zoomForModel(fpM, hM, center[1], canvasH, DRONE_PITCH, kindHere)),
          );
          if (reduce) {
            // احترام تقليل الحركة: اقتراب قصير بلا التفاف — على المشهد المعتمَد إن وُجد، وإلّا استقرار موحّد (١٣٠٠م/٦٣°) مركزيّ
            const view = r ? settleViewsRef.current[r] : undefined;
            if (view) {
              m.easeTo({ center, zoom: zoomForAltitude(view.altM, center[1], canvasH), pitch: view.pitch, bearing: view.bearing, offset: [view.offXFrac * (m.getCanvas().clientWidth || 1200), view.offYFrac * canvasH], duration: 900, essential: true });
            } else {
              m.easeTo({ center, zoom: zoomForAltitude(SETTLE_ALT_M, center[1], canvasH), pitch: SETTLE_PITCH, duration: 900, essential: true });
            }
            m.once("moveend", () => {
              if (modelFocusRef.current === r) setSettledModelId(r); // م9.13 · الاستقرار (بلا مدار) ⇒ تنبثق البطاقات
            });
          } else {
            const startBearing = m.getBearing();
            const HORIZON_PITCH = 82; // زاوية أفقيّة (أقلّ من ٩٠° قليلاً) — رؤية المبنى من الأفق أثناء الالتفاف
            // (1) اقتراب سينمائيّ يؤطّر المبنى (٦٠°) — يتدفّق مباشرةً إلى الالتفاف (بلا توقّف).
            if (cineActiveRef.current) {
              // م9.18 · الجولة: **عبور تسارعيّ سلس** (ease-in) أطول — يبدأ بطيئاً من نهاية المغادرة (سرعة ≈٠) ويتسارع بانسيابيّة نحو التالي، لا نقلة حادّة سريعة.
              m.flyTo({ center, zoom, pitch: DRONE_PITCH, bearing: startBearing, duration: 4600, curve: 1.42, easing: (t) => t * t, essential: true });
            } else {
              m.flyTo({ center, zoom, pitch: DRONE_PITCH, bearing: startBearing, duration: 2400, curve: 1.5, essential: true });
            }
            // (2) درون: نصف دورة ١٨٠° باتجاه واحد (easeOutSine — انطلاق فوريّ سلس بلا توقّف). الميل بدلالة الدرجات المقطوعة:
            //     أول ٤٥° **تصوير جوّيّ (٦٠°)** ← نزول إلى **الأفق (٨٢°)** ← بقاء أفقيّ ← قُرب ١٨٠° **يصعد ويعود للتصوير الجوّيّ** ويستقرّ.
            m.once("moveend", () => {
              if (modelFocusRef.current !== r) return; // أُلغِيَ التركيز أثناء الاقتراب
              const base = m.getBearing();
              const SWEEP_DEG = 180; // نصف دورة
              const SWEEP_MS = 7500; // إيقاع مهيب
              const SETTLE_MS = 2200; // مدّة الاستقرار الانسيابيّ ضمن نفس الحركة (بلا قفزة منفصلة)
              const ss = (u: number): number => u * u * (3 - 2 * u); // smoothstep
              let t0 = 0;
              const spin = (now: number): void => {
                const mm = mapRef.current;
                if (!mm || modelFocusRef.current !== r) {
                  droneRafRef.current = 0; // توقّف عند تغيّر التركيز/التفكيك
                  return;
                }
                if (!t0) t0 = now;
                const elapsed = now - t0;
                if (elapsed < SWEEP_MS) {
                  // (أ) المدار: نصف دورة ١٨٠° (easeOutSine) + رقصة ميل ٦٠→٨٢→٦٠. المركز/الزوم ثابتان.
                  const p = elapsed / SWEEP_MS;
                  const d = SWEEP_DEG * Math.sin((p * Math.PI) / 2);
                  let pitch: number;
                  if (d < 45) pitch = DRONE_PITCH;
                  else if (d < 90) pitch = DRONE_PITCH + (HORIZON_PITCH - DRONE_PITCH) * ss((d - 45) / 45);
                  else if (d < 135) pitch = HORIZON_PITCH;
                  else pitch = HORIZON_PITCH + (DRONE_PITCH - HORIZON_PITCH) * ss((d - 135) / 45);
                  mm.jumpTo({ bearing: base + d, pitch });
                  droneRafRef.current = requestAnimationFrame(spin);
                } else {
                  const view = r ? settleViewsRef.current[r] : undefined;
                  if (view) {
                    // (ب-١) مشهد هذا الموقع المعتمَد: easeTo دقيق (ارتفاع + ميل + اتّجاه + موضع المجسّم كنسبة) — يعيد تركيبك بالضبط، صفر تخمين.
                    droneRafRef.current = 0;
                    const cW = mm.getCanvas().clientWidth || 1200;
                    const cH = mm.getCanvas().clientHeight || 800;
                    mm.easeTo({ center, zoom: zoomForAltitude(view.altM, center[1], cH), pitch: view.pitch, bearing: view.bearing, offset: [view.offXFrac * cW, view.offYFrac * cH], duration: 1400, essential: true });
                    mm.once("moveend", () => {
                      if (modelFocusRef.current === r) setSettledModelId(r);
                    });
                  } else {
                    // (ب-٢) افتراضيّ: انزلاق مركزيّ سلس (١٣٠٠م/٦٣°) ضمن حركة الدرون.
                    const q = Math.min(1, (elapsed - SWEEP_MS) / SETTLE_MS);
                    const e = ss(q);
                    const targetZoom = zoomForAltitude(SETTLE_ALT_M, center[1], mm.getCanvas().clientHeight || 800);
                    mm.jumpTo({ center, zoom: lerp(zoom, targetZoom, e), pitch: lerp(DRONE_PITCH, SETTLE_PITCH, e), bearing: base + SWEEP_DEG });
                    if (q < 1) {
                      droneRafRef.current = requestAnimationFrame(spin);
                    } else {
                      droneRafRef.current = 0;
                      if (modelFocusRef.current === r) setSettledModelId(r); // بلغ الاستقرار انسيابيّاً ⇒ تنبثق البطاقات
                    }
                  }
                }
              };
              droneRafRef.current = requestAnimationFrame(spin);
            });
          }
        } else {
          m.fitBounds(b, { padding: framePadding(80, true), maxZoom: 16, duration: 1000 }); // م8.10: تجاهل ارتفاع الورقة (تُغلق مع الطيران) فلا يفشل التأطير
          // ملاحظة: لا تنبثق بطاقة الصور تلقائياً عند الطيران — انبثاقها حصراً عند النقر على رسمة القطعة (طلب معتمد).
        }
      } else {
        toast.info("لا حدود مرسومة لهذه القطعة بعد — ارسمها واربطها");
      }
    });
  }, []);

  // م9.7.4 · مغادرة التركيز (كامل نينوى) تُنهي الاستعراض الحرّ
  useEffect(() => {
    if (tourActiveRef.current) return; // أثناء الجولة: تبديل التركيز بين المواقع لا يُلغي مدار درون (القائد يقود)
    if (!modelFocusId) {
      setOrbitOn(false);
      setSettledModelId(null); // م9.13 · مغادرة التركيز (كامل نينوى/نقر الفراغ) ⇒ تنكمش بطاقة المجسّم
      if (droneRafRef.current) {
        cancelAnimationFrame(droneRafRef.current); // أوقِف التفاف الدرون عند مغادرة التركيز
        droneRafRef.current = 0;
      }
    }
  }, [modelFocusId]);

  // م9.7.11 · تنظيف حلقة التفاف الدرون عند تفكيك المكوّن (منعاً لتسرّب RAF)
  useEffect(
    () => () => {
      if (droneRafRef.current) cancelAnimationFrame(droneRafRef.current);
    },
    [],
  );

  // م9.7.4 · الاستعراض الحرّ: اسحب لتدوير الكاميرا حول المجسّم (اتجاه + ميل) · العجلة للزوم — حول المركز (المجسّم) كما في sketchfab.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !mapReady || !orbitOn) return;
    m.stop(); // إيقاف أي التفاف تلقائيّ — التحكّم يدويّ الآن
    m.dragPan.disable();
    m.dragRotate.disable();
    m.scrollZoom.disable();
    const canvas = m.getCanvas();
    canvas.style.cursor = "grab";
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const down = (e: PointerEvent): void => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture?.(e.pointerId);
    };
    const moveH = (e: PointerEvent): void => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      m.setBearing(m.getBearing() - dx * 0.5); // تدوير أفقيّ كامل (360°)
      m.setPitch(Math.max(0, Math.min(85, m.getPitch() + dy * 0.4))); // ميل رأسيّ سلس
    };
    const up = (e: PointerEvent): void => {
      dragging = false;
      canvas.style.cursor = "grab";
      canvas.releasePointerCapture?.(e.pointerId);
    };
    const wheel = (e: WheelEvent): void => {
      e.preventDefault();
      const z = Math.max(m.getMinZoom(), Math.min(m.getMaxZoom(), m.getZoom() - e.deltaY * 0.003));
      m.easeTo({ zoom: z, duration: 90 }); // المركز ثابت → زوم حول المجسّم
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", moveH);
    window.addEventListener("pointerup", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", moveH);
      window.removeEventListener("pointerup", up);
      canvas.removeEventListener("wheel", wheel);
      canvas.style.cursor = "";
      const mm = mapRef.current;
      if (mm) {
        mm.dragPan.enable();
        mm.dragRotate.enable();
        mm.scrollZoom.enable();
      }
    };
  }, [orbitOn, mapReady]);

  // م9.17 · تحميل مشاهد الاستقرار المعتمَدة (لكلّ موقع) من التخزين المحلّيّ عند الإقلاع
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(SETTLE_VIEWS_KEY) : null;
      if (!raw) return;
      const obj = JSON.parse(raw) as Record<string, SettleView>;
      if (obj && typeof obj === "object") {
        settleViewsRef.current = obj;
        setSavedViewIds(Object.keys(obj));
      }
    } catch {
      /* تجاهُل */
    }
  }, []);

  // م9.17 · التقاط المشهد الحاليّ (الكاميرا + موضع المجسّم على الشاشة) واعتماده **لهذا الموقع وحده** (ref_id) — بلا تخمين.
  const captureSettleView = (): void => {
    const m = mapRef.current;
    const id = modelFocusRef.current;
    if (!m || !id) return;
    const f = fcRef.current.features.find((ft) => ft.properties?.ref_id === id);
    if (!f?.geometry) {
      toast.error("لا مجسّم مركَّز لالتقاط مشهده");
      return;
    }
    const c = centroid(f as Feature).geometry.coordinates as [number, number];
    const cW = m.getCanvas().clientWidth || 1200;
    const cH = m.getCanvas().clientHeight || 800;
    const lat = m.getCenter().lat;
    const altM = (234814.55088 * cH * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, m.getZoom());
    const p = m.project(c); // موضع المجسّم على الشاشة الآن
    const view: SettleView = { altM, pitch: m.getPitch(), bearing: m.getBearing(), offXFrac: (p.x - cW / 2) / cW, offYFrac: (p.y - cH / 2) / cH };
    settleViewsRef.current = { ...settleViewsRef.current, [id]: view };
    setSavedViewIds(Object.keys(settleViewsRef.current));
    try {
      window.localStorage.setItem(SETTLE_VIEWS_KEY, JSON.stringify(settleViewsRef.current));
    } catch {
      /* تجاهُل */
    }
    toast.success("تمّ اعتماد مشهد هذا الموقع");
  };

  // الانتقال لإحداثيات موقع جغرافي (بحث فائق · §هـ.2.ج): طيران + تنبيه بالاسم
  useEffect(() => {
    return onFlyToCoords(({ lng, lat, label }) => {
      const m = mapRef.current;
      if (!m) return;
      sfxFly(); // أثر طيران تقني ناعم (م7.9)
      m.flyTo({ center: [lng, lat], zoom: 14, duration: 1400, padding: framePadding(0, true) });
      if (label) toast.info(label);
    });
  }, []);

  // العودة لكامل نينوى (زر «كامل نينوى» في الدوك على الجوال)
  useEffect(() => {
    return onResetView(() => {
      resetView();
      setModelFocusId(null); // م9.3 · العودة لكامل نينوى تُنهي عرض الكيان الهولوكرامي
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetView مستقرّ (refs)
  }, []);

  // تكبير/تصغير من أزرار الزوم في الدوك على الجوال (م8.9) — حركة سلسة مماثلة لأزرار MapLibre
  useEffect(() => {
    return onZoom((delta) => {
      const m = mapRef.current;
      if (!m) return;
      if (delta > 0) m.zoomIn();
      else m.zoomOut();
    });
  }, []);

  // م9.10 · بدء الجولة السينمائيّة — يقود الكاميرا بمسار RAF عبر المواقع المختارة (jumpTo/إطار)، والواجهة مخفيّة.
  useEffect(() => {
    return onStartTour((cfg) => {
      const m = mapRef.current;
      if (!m) return;
      const locs = cfg.refIds.map((id) => tourLocsRef.current.get(id)).filter(Boolean) as (TourLoc & { nameAr: string })[];
      if (!locs.length) {
        toast.info("لا مواقع مختارة للجولة");
        return;
      }
      m.stop(); // أوقِف أي طيران MapLibre جارٍ (يمنع تنازع «already running»)
      if (droneRafRef.current) {
        cancelAnimationFrame(droneRafRef.current);
        droneRafRef.current = 0;
      }
      setOrbitOn(false);
      setSelectedId(null);
      setMkSel(null);
      tourActiveRef.current = true;
      tourLoopRef.current = cfg.loop;
      tourModeRef.current = cfg.mode;
      setTourActive(true); // يُخفي الواجهة في الخريطة والشيل
      m.dragPan.disable();
      m.dragRotate.disable();
      m.scrollZoom.disable();
      m.doubleClickZoom.disable();
      m.touchZoomRotate.disable();
      m.keyboard.disable();
      sfxFly();
      const canvasH = m.getCanvas().clientHeight || 800;
      const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        // تقليل الحركة: انتقال سلس لكلّ موقع (بلا مدار) ووقفة قصيرة، ثمّ التالي.
        let i = 0;
        const step = (): void => {
          if (!tourActiveRef.current) return;
          if (i >= locs.length) {
            if (tourLoopRef.current) i = 0;
            else {
              requestStopTour();
              return;
            }
          }
          const loc = locs[i++]!;
          setModelFocusId(loc.refId);
          const altM = altForModel(loc, 60);
          const zoom = Math.max(12, Math.min(MAX_ZOOM, zoomForAltitude(altM, loc.center[1], canvasH)));
          m.easeTo({ center: loc.center, zoom, pitch: 60, bearing: gateCameraBearing(loc.kind, loc.rotationDeg), duration: 1400, essential: true });
          tourTimerRef.current = window.setTimeout(step, 3400);
        };
        step();
        return;
      }
      // المسار الكامل: محرّك الخطّ الزمنيّ يقود jumpTo لكلّ إطار.
      const altFromZoom = (zoom: number, lat: number): number => (1.5 * canvasH * 156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
      const rebuild = (): void => {
        const c = m.getCenter();
        const start: StartCam = { center: [c.lng, c.lat], bearing: m.getBearing(), pitch: m.getPitch(), altM: altFromZoom(m.getZoom(), c.lat) };
        tourTimelineRef.current = buildTimeline(locs, tourModeRef.current, start);
        tourStartTsRef.current = 0;
      };
      rebuild();
      let lastRef: string | null = modelFocusRef.current;
      const frame = (now: number): void => {
        if (!tourActiveRef.current) return;
        const tl = tourTimelineRef.current;
        if (!tl) return;
        if (!tourStartTsRef.current) tourStartTsRef.current = now;
        const t = now - tourStartTsRef.current;
        const f = tl.sample(t);
        if (f.refId !== lastRef) {
          lastRef = f.refId;
          setModelFocusId(f.refId);
        }
        const zoom = Math.max(12, Math.min(MAX_ZOOM, zoomForAltitude(f.altM, f.center[1], canvasH)));
        m.jumpTo({ center: f.center, zoom, pitch: f.pitch, bearing: f.bearing });
        if (t >= tl.durationMs) {
          if (tourLoopRef.current) {
            rebuild();
            tourRafRef.current = requestAnimationFrame(frame);
            return;
          }
          requestStopTour();
          return;
        }
        tourRafRef.current = requestAnimationFrame(frame);
      };
      tourRafRef.current = requestAnimationFrame(frame);
    });
  }, []);

  // م9.10 · إنهاء الجولة — يوقف المحرّك، يعيد الإيماءات والواجهة، ويعود لكامل نينوى ويخرج من ملء الشاشة.
  useEffect(() => {
    return onStopTour(() => {
      const m = mapRef.current;
      tourActiveRef.current = false;
      if (tourRafRef.current) {
        cancelAnimationFrame(tourRafRef.current);
        tourRafRef.current = 0;
      }
      if (tourTimerRef.current) {
        clearTimeout(tourTimerRef.current);
        tourTimerRef.current = 0;
      }
      tourTimelineRef.current = null;
      setModelFocusId(null);
      setTourActive(false);
      if (m) {
        m.dragPan.enable();
        m.dragRotate.enable();
        m.scrollZoom.enable();
        m.doubleClickZoom.enable();
        m.touchZoomRotate.enable();
        m.keyboard.enable();
        resetView(); // عودة سلسة لكامل نينوى
      }
      if (typeof document !== "undefined" && document.fullscreenElement) void document.exitFullscreen?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetView مستقرّ (refs)
  }, []);

  // م9.18 · جولة سينمائيّة منفصلة: سلسلة طيرانات مفردة — كلّ موقع يُعرَض بمشهده المعتمَد + بطاقاته، بطاقات غير متراكمة، مع دوران مغادرة وحلقة.
  useEffect(() => {
    return onStartCinematicTour((cfg) => {
      const m = mapRef.current;
      if (!m) return;
      const locs = cfg.refIds.filter((id) => tourLocsRef.current.has(id));
      if (!locs.length) {
        toast.info("لا مواقع مختارة للجولة");
        return;
      }
      m.stop();
      if (droneRafRef.current) {
        cancelAnimationFrame(droneRafRef.current);
        droneRafRef.current = 0;
      }
      setOrbitOn(false);
      setSelectedId(null);
      setMkSel(null);
      cineActiveRef.current = true;
      cineLocsRef.current = locs;
      cineIdxRef.current = 0;
      cineLoopRef.current = cfg.loop;
      setCinematicTourActive(true); // البطاقات تبقى ظاهرة
      setTourActive(true); // إخفاء الواجهة (الشيل + عائمات الخريطة) — البطاقات مستثناة
      m.dragPan.disable();
      m.dragRotate.disable();
      m.scrollZoom.disable();
      m.doubleClickZoom.disable();
      m.touchZoomRotate.disable();
      m.keyboard.disable();
      // م9.18 · صوت الطيران الهادئ: سووش **خفيف** يُسمَع **فقط أثناء الطيران نحو التالي** (بوّابة cineFlightRef: من بدء الانجراف حتّى الاستقرار)،
      //   وشدّته تتبع **سرعة انتقال المركز** فقط (لا الدوران) — فيخفت طبيعيّاً أثناء مدار الوصول (مركز ثابت) ويصمت عند الاستقرار/السرد/الدوران حول المجسّم.
      cineFlightRef.current = false;
      cineWhooshRef.current = createFlightWhoosh();
      {
        let prev: { lng: number; lat: number } | null = null;
        let prevT = 0;
        let smooth = 0;
        const tick = (now: number): void => {
          if (!cineActiveRef.current) {
            cineAudioRafRef.current = 0;
            return;
          }
          const mm = mapRef.current;
          const wh = cineWhooshRef.current;
          if (mm && wh) {
            const cc = mm.getCenter();
            if (prev) {
              const dt = Math.max(0.016, (now - prevT) / 1000);
              const latR = (cc.lat * Math.PI) / 180;
              const dMeters = Math.hypot((cc.lng - prev.lng) * 111320 * Math.cos(latR), (cc.lat - prev.lat) * 110540);
              const target = cineFlightRef.current ? Math.min(1, dMeters / dt / 900) : 0; // سرعة الانتقال فقط، ومحصورة ببوّابة الطيران
              smooth += (target - smooth) * 0.15; // تنعيم إضافيّ (سلاسة)
              wh.setSpeed(smooth);
            }
            prev = { lng: cc.lng, lat: cc.lat };
            prevT = now;
          }
          cineAudioRafRef.current = requestAnimationFrame(tick);
        };
        cineAudioRafRef.current = requestAnimationFrame(tick);
      }
      requestFlyTo(locs[0]!); // ابدأ السلسلة — الطيران المفرد يتكفّل بالاقتراب/المدار/الاستقرار على المشهد + البطاقات
    });
  }, []);

  // م9.18 · تقدّم الجولة: يُستدعى عند **اكتمال انبثاق كلّ البطاقات وسرد نصوصها** ⇒ مهلة ٣ث ⇒ **مغادرة لطيفة ٧ث** ⇒ **عبور تسارعيّ** للتالي.
  // المغادرة اللطيفة (٧ث، بـjumpTo لكلّ إطار فالبطاقة مرتكزة تنحسر بسلاسة حتّى مع صفّ ثقيل):
  //   • الطور أ (٣ث): **دوران خفيف حول المجسّم** — المركز يدور حول مركز المجسّم مع دوران مُوازٍ للاتّجاه فيبقى المجسّم مؤطَّراً وتُرى جوانبه.
  //   • الطور ب (٤ث): **انجراف لطيف نحو الموقع التالي** + ابتعاد (زوم-أوت) — المجسّم يتراجع مرتكزةً بطاقته.
  // ثمّ تُغلَق البطاقة (بعد انحسارها مرتكزةً) ويبدأ العبور التسارعيّ (ease-in في onFlyTo) بلا بطاقة، وتنبثق بطاقات التالي عند وصوله.
  const handleCardsNarrated = (): void => {
    if (!cineActiveRef.current) return;
    if (cineTimerRef.current) clearTimeout(cineTimerRef.current);
    cineTimerRef.current = window.setTimeout(() => {
      if (!cineActiveRef.current) return;
      const m = mapRef.current;
      if (!m) return;
      let nx = cineIdxRef.current + 1;
      if (nx >= cineLocsRef.current.length) {
        if (cineLoopRef.current) nx = 0;
        else {
          requestStopCinematicTour();
          return;
        }
      }
      const nextId = cineLocsRef.current[nx]!;
      const curId = cineLocsRef.current[cineIdxRef.current]!;
      const cf = fcRef.current.features.find((ft) => ft.properties?.ref_id === curId);
      const M = cf ? (centroid(cf as Feature).geometry.coordinates as [number, number]) : null; // مركز المجسّم الحاليّ (محور الدوران)
      const nf = fcRef.current.features.find((ft) => ft.properties?.ref_id === nextId);
      const tgt = nf ? (centroid(nf as Feature).geometry.coordinates as [number, number]) : null; // مركز التالي — للانجراف نحوه

      // === الطور ب (٤ث): انجراف لطيف نحو التالي + ابتعاد ===
      const startDrift = (): void => {
        const mp = mapRef.current;
        if (!cineActiveRef.current || !mp) {
          cineDepartRafRef.current = 0;
          return;
        }
        cineFlightRef.current = true; // بدء الطيران نحو التالي ⇒ يُسمَع السووش (خفيفاً، بسرعة الانتقال) حتّى الاستقرار
        const c0 = mp.getCenter();
        const z0 = mp.getZoom();
        const b0 = mp.getBearing();
        const cx = tgt ? c0.lng + (tgt[0] - c0.lng) * 0.3 : c0.lng; // انجراف ٣٠٪ نحو التالي
        const cy = tgt ? c0.lat + (tgt[1] - c0.lat) * 0.3 : c0.lat;
        const z1 = Math.max(mp.getMinZoom(), z0 - 1.4); // ابتعاد
        let tB = 0;
        const drift = (now: number): void => {
          const mq = mapRef.current;
          if (!cineActiveRef.current || !mq) {
            cineDepartRafRef.current = 0;
            return;
          }
          if (!tB) tB = now;
          const p = Math.min(1, (now - tB) / 4000);
          const e = p * p * (3 - 2 * p); // smoothstep — ينتهي بسرعة ≈٠ فيلتقيه العبور التسارعيّ بلا نقلة
          mq.jumpTo({ center: [c0.lng + (cx - c0.lng) * e, c0.lat + (cy - c0.lat) * e], zoom: z0 + (z1 - z0) * e, bearing: b0 + 12 * e });
          if (p < 1) {
            cineDepartRafRef.current = requestAnimationFrame(drift);
          } else {
            cineDepartRafRef.current = 0;
            setSettledModelId(null); // أغلِق بطاقة الموقع بعد انحسارها مرتكزةً
            cineIdxRef.current = nx;
            requestFlyTo(nextId); // العبور التسارعيّ (ease-in) للتالي — بلا بطاقة أثناء العبور
          }
        };
        cineDepartRafRef.current = requestAnimationFrame(drift);
      };

      // === الطور أ (٣ث): دوران خفيف حول المجسّم (المركز يدور حول مركز المجسّم + اتّجاه مُوازٍ) ===
      const o0 = m.getCenter();
      const ob0 = m.getBearing();
      const latRad = ((M ? M[1] : o0.lat) * Math.PI) / 180;
      const mPerLat = 110540;
      const mPerLng = 111320 * Math.cos(latRad); // انضغاط الطول بخطّ العرض
      const ox = M ? (o0.lng - M[0]) * mPerLng : 0; // إزاحة الكاميرا عن المجسّم (بالمتر)
      const oy = M ? (o0.lat - M[1]) * mPerLat : 0;
      const ORBIT_DEG = 26; // دوران خفيف
      let tA = 0;
      const orbit = (now: number): void => {
        const mp = mapRef.current;
        if (!cineActiveRef.current || !mp) {
          cineDepartRafRef.current = 0;
          return;
        }
        if (!tA) tA = now;
        const p = Math.min(1, (now - tA) / 3000);
        const e = p * p * (3 - 2 * p); // smoothstep
        const deg = ORBIT_DEG * e;
        if (M) {
          const th = (deg * Math.PI) / 180;
          const rx = ox * Math.cos(th) - oy * Math.sin(th); // دوّر الإزاحة حول المجسّم
          const ry = ox * Math.sin(th) + oy * Math.cos(th);
          mp.jumpTo({ center: [M[0] + rx / mPerLng, M[1] + ry / mPerLat], bearing: ob0 + deg });
        } else {
          mp.jumpTo({ bearing: ob0 + deg });
        }
        if (p < 1) cineDepartRafRef.current = requestAnimationFrame(orbit);
        else startDrift(); // أ ⇒ ب
      };
      cineDepartRafRef.current = requestAnimationFrame(orbit);
    }, 3000); // ٣ ثوانٍ بعد اكتمال السرد
  };

  // م9.18 · إيقاف الجولة السينمائيّة: إلغاء المؤقّتات/الحلقات، إعادة الإيماءات + الواجهة، عودة لكامل نينوى.
  useEffect(() => {
    return onStopCinematicTour(() => {
      const m = mapRef.current;
      cineActiveRef.current = false;
      if (cineTimerRef.current) {
        clearTimeout(cineTimerRef.current);
        cineTimerRef.current = 0;
      }
      if (cineDepartRafRef.current) {
        cancelAnimationFrame(cineDepartRafRef.current);
        cineDepartRafRef.current = 0;
      }
      if (droneRafRef.current) {
        cancelAnimationFrame(droneRafRef.current);
        droneRafRef.current = 0;
      }
      cineFlightRef.current = false;
      if (cineAudioRafRef.current) {
        cancelAnimationFrame(cineAudioRafRef.current);
        cineAudioRafRef.current = 0;
      }
      cineWhooshRef.current?.stop(); // تلاشٍ ناعم للسووش ثمّ إيقاف
      cineWhooshRef.current = null;
      setCinematicTourActive(false);
      setTourActive(false);
      setModelFocusId(null); // يُغلق البطاقات + التركيز
      if (m) {
        m.dragPan.enable();
        m.dragRotate.enable();
        m.scrollZoom.enable();
        m.doubleClickZoom.enable();
        m.touchZoomRotate.enable();
        m.keyboard.enable();
        resetView();
      }
      if (typeof document !== "undefined" && document.fullscreenElement) void document.exitFullscreen?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetView مستقرّ (refs)
  }, []);

  // م9.18 · وصول الجولة (استقرار المجسّم) ⇒ أغلِق بوّابة صوت الطيران فيخفت السووش (لا صوت أثناء العرض/السرد)
  useEffect(() => {
    if (cineActiveRef.current && settledModelId) cineFlightRef.current = false;
  }, [settledModelId]);

  // م9.18 · أمان التفكيك: أوقِف سووش الطيران وحلقته إن فُكِّكت الخريطة أثناء الجولة (لئلّا يستمرّ الصوت)
  useEffect(() => {
    return () => {
      if (cineAudioRafRef.current) cancelAnimationFrame(cineAudioRafRef.current);
      cineWhooshRef.current?.stop();
      cineWhooshRef.current = null;
    };
  }, []);

  // م9.10 · خروج ملء الشاشة (Esc) أثناء الجولة ⇒ إنهاؤها، ومفتاح Esc مباشرةً أيضاً (كلتا الجولتَين).
  useEffect(() => {
    const stopAny = (): void => {
      if (cineActiveRef.current) requestStopCinematicTour();
      else if (tourActiveRef.current) requestStopTour();
    };
    const onFsChange = (): void => {
      if ((tourActiveRef.current || cineActiveRef.current) && typeof document !== "undefined" && !document.fullscreenElement) stopAny();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") stopAny();
    };
    document.addEventListener("fullscreenchange", onFsChange);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // م8.11 · توهّج نابض هادئ لشريط حدود نينوى — يعلو ويخفت بسلاسة (sine) عبر تحريك line-opacity للطبقة المتوهّجة.
  useEffect(() => {
    if (!mapReady) return;
    let raf = 0;
    let last = 0;
    const t0 = performance.now();
    const tick = (): void => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      if (now - last < 40) return; // ~25fps يكفي لنبض بطيء سلس — تقليل إعادة رسم الخريطة (أوفر للبطارية)
      last = now;
      const mm = mapRef.current;
      if (!mm || !mm.getLayer("bnd-governorate-glow")) return;
      if (tourActiveRef.current || cineActiveRef.current) return; // أثناء الجولة (jumpTo لكلّ إطار): لا تُحدّث طلاء الحدود — تجنّب تنازع حلقة الرسم
      if (mm.isMoving()) return; // لا تُحدّث طلاء الحدود أثناء حركة الكاميرا — يمنع إعادة الدخول لحلقة رسم MapLibre أثناء easeTo/flyTo (خطأ "already running"/_onEaseFrame)
      const t = (now - t0) / 1000;
      const op = 0.16 + 0.34 * (0.5 + 0.5 * Math.sin(t * 1.05)); // 0.16..0.5 · نبض ~6ث هادئ
      try {
        mm.setPaintProperty("bnd-governorate-glow", "line-opacity", op);
      } catch {
        /* النمط قيد التبديل */
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mapReady]);

  // بدء رسم وربط هندسة بقطعة موجودة (من بطاقة فرصة/رخصة)
  useEffect(() => {
    return onStartDraw((target) => {
      linkTargetRef.current = target;
      const d = drawRef.current;
      if (d) {
        try {
          if (!d.enabled) d.start(); // شفاء ذاتي بعد تبديل القاعدة
          d.clear();
          d.setMode("polygon");
          setEditing(null);
          setDrawMode("polygon");
        } catch {
          toast.error("تعذّر بدء الرسم — أعد المحاولة");
        }
      }
    });
  }, []);

  async function switchBase(next: BaseStyle, force = false): Promise<void> {
    const map = mapRef.current;
    const data = dataRef.current;
    // force = إعادة بناء على نفس القاعدة (م9.8 · تبديل مزوّد القمر الصناعي محلّياً)
    if (!map || !data || (next === baseRef.current && !force)) return;
    const prev = baseRef.current;
    baseRef.current = next;
    setBase(next);
    setMapBase(next); // م8.10 · أبلغ مؤشّرات KPI بتغيّر القاعدة (قرص كحلي فوق الخريطة الفاتحة)
    let style: StyleSpecification;
    try {
      style = await buildStyle(next, data, satProviderRef.current);
    } catch {
      baseRef.current = prev; // §ز: فشل الجلب لا يُعلّق الزر على قاعدة لم تُحمَّل
      setBase(prev);
      setMapBase(prev);
      toast.error("تعذّر تحميل قاعدة الخريطة — تحقّق من الاتصال وأعد المحاولة");
      return;
    }
    // إيقاف أداة الرسم **قبل** setStyle: مصادرها ما تزال قائمة فيمرّ unregister بنظافة.
    // (كان stop داخل idle يرمي بعد مسح المصادر فلا يصل start أبداً — جذر «لا يمكن الرسم بعد التبديل»)
    const d = drawRef.current;
    if (drawModeRef.current !== "off") toast.info("أُلغي الرسم الجاري بسبب تبديل قاعدة الخريطة");
    try {
      d?.stop();
    } catch {
      // يُعاد تشغيلها بعد idle على كل حال
    }
    linkTargetRef.current = null;
    setDrawMode("off");
    setEditing(null);
    setLiveArea(null);
    setMkSel(null);
    map.setStyle(style); // النمط الجديد يحوي طبقاتنا → فوري
    map.once("idle", () => {
      applyStats(mapRef.current, dataRef.current, oppsRef.current, licsRef.current, assumedRef.current);
      applyVisibility(mapRef.current, showBoundariesRef.current);
      applyAnnotations(mapRef.current, annFcRef.current, showAnnotationsRef.current); // النمط الجديد مسح المصدر
      // إعادة تشغيل أداة الرسم على النمط الجديد — حارس مستقل كي لا يُسقطها أي فشل آخر
      try {
        if (d && !d.enabled) d.start();
        d?.setMode("static");
      } catch {
        // تُشفى ذاتياً عند أول دخول للرسم (enterDrawMode يعيد التشغيل)
      }
    });
  }

  // م9.8 · تبديل مزوّد القمر الصناعي (مقارنة محلّية): يضبط المزوّد ويعيد بناء القاعدة على القمر الصناعي.
  function pickSatProvider(p: SatelliteProvider): void {
    satProviderRef.current = p;
    setSatProvider(p);
    void switchBase("satellite", baseRef.current === "satellite"); // force عند البقاء على القمر
  }

  function resetView(): void {
    const map = mapRef.current;
    const data = dataRef.current;
    if (!map || !data) return;
    sfxFly(); // أثر طيران عند العودة لكامل نينوى (طلب معتمد)
    map.fitBounds(data.bounds, { padding: framePadding(48), duration: 1200 });
  }

  // ===== استوديو الرسم (م7.1) =====

  /** خروج كامل من أي وضعية رسم/تحرير (Esc أو زرّ الإلغاء). */
  function exitDraw(): void {
    try {
      drawRef.current?.setMode("static");
      drawRef.current?.clear();
    } catch {
      // terra-draw قد تفقد طبقاتها بعد إعادة تحميل النمط/HMR — تجاهل بهدوء
    }
    linkTargetRef.current = null;
    annPendingRef.current = null;
    setDrawMode("off");
    setEditing(null);
    setLiveArea(null);
    setDimAnchor(null);
    setAnnAnchor(null);
  }
  useEscClose(drawMode !== "off", exitDraw);

  /** تفعيل وضعية رسم — اختيار الوضعية نفسها يلغيها. */
  function enterDrawMode(m: Exclude<DrawModeId, "off">): void {
    if (drawMode === m) {
      exitDraw();
      return;
    }
    const d = drawRef.current;
    if (!d) return;
    if (!d.enabled) {
      // شفاء ذاتي: إن تعطّلت الأداة بعد تبديل قاعدة سابق تُعاد للعمل هنا فوراً
      try {
        d.start();
      } catch {
        toast.error("تعذّرت تهيئة أداة الرسم — أعد تحميل الصفحة");
        return;
      }
    }
    try {
      d.clear();
      setEditing(null);
      setLiveArea(null);
      setDimAnchor(null);
      setShowLayers(false); // لا تعارض: دخول الرسم يطوي لوحة الطبقات
      setDrawOpen(true);
      linkTargetRef.current = null; // الوضعيات اليدوية ترسم قطعة جديدة (الربط يأتي من بطاقات الأقسام)
      if (m === "dimensions" || m === "edit" || m === "annotate") {
        d.setMode("static"); // النقر التالي على الخريطة هو المدخل
        toast.info(
          m === "dimensions"
            ? "انقر موقع الشكل على الخريطة ثم أدخل الأبعاد"
            : m === "annotate"
              ? "انقر الموقع المراد تسميته على الخريطة"
              : "انقر قطعة مرسومة لتعديل حدودها",
        );
      } else if (m === "square") {
        d.setMode("rectangle"); // يُضبَط مربّعاً عند الإنهاء
      } else {
        d.setMode(m);
      }
      setDrawMode(m);
    } catch {
      exitDraw();
      toast.error("تعذّر تفعيل وضعية الرسم — حاول مجدداً");
    }
  }

  // حفظ شكل منتهٍ (كل وضعيات الإنشاء + «بأبعاد») — يحترم هدف الربط من بطاقات الأقسام.
  const persistRef = useRef<((polygon: Feature<Polygon>) => Promise<void>) | null>(null);
  persistRef.current = async (raw) => {
    // مضلّع تسمية منطقة (م7.3) — يُحفَظ عنصراً محرَّراً لا قطعة
    if (drawModeRef.current === "annotate" && annPendingRef.current) {
      const meta = annPendingRef.current;
      annPendingRef.current = null;
      const res = await createMapElement(meta.name, meta.type, raw.geometry);
      if (!res.ok) {
        annPendingRef.current = meta; // الاسم يبقى — أعد إغلاق المضلّع للمحاولة مجدداً (§ز: لا فقدان مدخلات)
        toast.error("تعذّر حفظ التسمية", { description: res.error });
        return;
      }
      exitDraw();
      toast.success(`سُمِّيت المنطقة «${meta.name}» — تظهر بالخريطة والبحث`);
      void qcRef.current.invalidateQueries({ queryKey: ["map_elements_geo"] });
      return;
    }
    const data = dataRef.current;
    if (!data) return;
    const polygon = drawModeRef.current === "square" ? regularizeSquare(raw) : raw;
    const target = linkTargetRef.current;
    linkTargetRef.current = null;
    const supabase = createClient();
    let createdId: string | null = null;
    let errMsg: string | null = null;
    if (target) {
      // ربط الهندسة بقطعة موجودة (فرصة/رخصة)
      const { error } = await supabase.rpc("create_parcel_geometry", {
        p_geom: polygon.geometry,
        p_parcel_no: target.parcel_no,
        p_muqataa_no: target.muqataa_no,
      });
      errMsg = error?.message ?? null;
    } else {
      // قطعة مفترضة جديدة + استنتاج مكاني
      const district = inferName(polygon, data.districts);
      const subdistrict = inferName(polygon, data.subdistricts);
      const { data: newId, error } = await supabase.rpc("create_assumed_parcel", {
        p_geom: polygon.geometry,
        p_district: district,
        p_subdistrict: subdistrict,
      });
      errMsg = error?.message ?? null;
      if (typeof newId === "string") createdId = newId;
    }
    if (errMsg) {
      linkTargetRef.current = target; // إبقاء هدف الربط والشكل المرسوم — أعد المحاولة أو Esc (§ز: لا فقدان عمل)
      toast.error("تعذّر حفظ الحدود", { description: errMsg });
      return;
    }
    exitDraw();
    toast.success(target ? `رُبطت الحدود بـ${target.label ?? "القطعة"}` : "أُنشئت قطعة مفترضة");
    void qcRef.current.invalidateQueries({ queryKey: ["map_parcels"] });
    void qcRef.current.invalidateQueries({ queryKey: ["table", "assumed_parcels"] });
    void qcRef.current.invalidateQueries({ queryKey: ["table", "parcel_geometry"] });
    void qcRef.current.invalidateQueries({ queryKey: ["counts"] });
    if (createdId) requestOpenParcelForm(createdId);
  };

  /** «بأبعاد»: بناء الشكل المضبوط حول الموقع المنقور ثم الحفظ المعتاد. */
  function onDimensionSubmit(shape: DimShape, a: number, b: number): void {
    const anchor = dimAnchor;
    if (!anchor) return;
    setDimAnchor(null);
    const polygon =
      shape === "circle"
        ? (turfCircle([anchor.lng, anchor.lat], a / 1000, { steps: 64, units: "kilometers" }) as Feature<Polygon>)
        : buildRectPolygon(anchor.lng, anchor.lat, a, shape === "square" ? a : b);
    void persistRef.current?.(polygon);
  }

  // «تحرير»: تحميل هندسة القطعة المنقورة في terra-draw (وضع select: سحب رؤوس/نقاط وسطى/تحريك).
  const editStartRef = useRef<((props: ParcelProps) => void) | null>(null);
  editStartRef.current = (props) => {
    const d = drawRef.current;
    if (!d) return;
    const f = fcRef.current.features.find((ft) => ft.properties?.ref_id === props.ref_id);
    const geom = f?.geometry;
    if (!geom) return;
    const polyGeom: Polygon | null =
      geom.type === "Polygon"
        ? geom
        : geom.type === "MultiPolygon"
          ? { type: "Polygon", coordinates: (geom as MultiPolygon).coordinates[0] ?? [] }
          : null;
    if (!polyGeom || !polyGeom.coordinates.length) {
      toast.error("هندسة غير قابلة للتحرير");
      return;
    }
    try {
      d.clear();
      d.addFeatures([{ type: "Feature", properties: { mode: "polygon" }, geometry: polyGeom } as never]);
      d.setMode("select");
      setSelectedId(null);
      setMkSel(null);
      setEditing({ kind: props.kind, refId: props.ref_id, label: props.label || props.parcel_no || "قطعة" });
      toast.info("اسحب الرؤوس أو النقاط الوسطى لتعديل الحدود، ثم «حفظ الحدود»");
    } catch {
      toast.error("تعذّر فتح التحرير");
    }
  };

  /** حفظ الحدود المعدَّلة في القاعدة (RPC update_parcel_geom) — انعكاس فوري في كل المواضع. */
  async function saveEdit(): Promise<void> {
    const d = drawRef.current;
    const ed = editing;
    if (!d || !ed || savingEdit) return;
    const f = d.getSnapshot().find((sf) => sf.geometry?.type === "Polygon");
    if (!f) {
      toast.error("لا شكل للحفظ");
      return;
    }
    setSavingEdit(true);
    const res = await updateParcelGeometry(ed.kind, ed.refId, f.geometry as Geometry);
    setSavingEdit(false);
    if (!res.ok) {
      toast.error(`تعذّر حفظ الحدود — ${res.error}`);
      return;
    }
    exitDraw();
    toast.success("حُدِّثت حدود القطعة");
    void qcRef.current.invalidateQueries({ queryKey: ["map_parcels"] });
    void qcRef.current.invalidateQueries({ queryKey: ["table", "assumed_parcels"] });
    void qcRef.current.invalidateQueries({ queryKey: ["table", "parcel_geometry"] });
  }

  // ===== التسميات المحرَّرة (م7.3) =====

  async function onAnnotatePoint(name: string, type: string): Promise<void> {
    const anchor = annAnchor;
    if (!anchor || annSaving) return;
    setAnnSaving(true);
    const res = await createMapElement(name, type, { type: "Point", coordinates: [anchor.lng, anchor.lat] });
    setAnnSaving(false);
    if (!res.ok) {
      toast.error("تعذّر حفظ التسمية", { description: res.error }); // الحوار والموقع يبقيان — أعد المحاولة (§ز)
      return;
    }
    exitDraw();
    toast.success(`أُضيفت التسمية «${name}» — تظهر بالخريطة والبحث`);
    void qcRef.current.invalidateQueries({ queryKey: ["map_elements_geo"] });
  }

  function onAnnotateArea(name: string, type: string): void {
    const d = drawRef.current;
    if (!d) return;
    annPendingRef.current = { name: name.trim(), type };
    setAnnAnchor(null);
    try {
      d.setMode("polygon"); // drawMode يبقى "annotate" — الحفظ يفرّق
      toast.info(`ارسم حدود «${name.trim()}» وأغلق المضلّع`);
    } catch {
      exitDraw();
    }
  }

  async function onAnnotateSave(name: string, type: string): Promise<void> {
    const ed = annEdit;
    if (!ed || annSaving) return;
    setAnnSaving(true);
    const res = await renameMapElement(ed.id, name, type);
    setAnnSaving(false);
    if (!res.ok) {
      toast.error(`تعذّر الحفظ — ${res.error}`);
      return;
    }
    setAnnEdit(null);
    toast.success("حُدِّثت التسمية");
    void qcRef.current.invalidateQueries({ queryKey: ["map_elements_geo"] });
  }

  async function onAnnotateDelete(): Promise<void> {
    const ed = annEdit;
    if (!ed || annSaving) return;
    if (!window.confirm(`حذف التسمية «${ed.name}»؟`)) return;
    setAnnSaving(true);
    const res = await deleteMapElement(ed.id);
    setAnnSaving(false);
    if (!res.ok) {
      toast.error("تعذّر الحذف", { description: res.error });
      return;
    }
    setAnnEdit(null);
    toast.success("حُذِفت التسمية");
    void qcRef.current.invalidateQueries({ queryKey: ["map_elements_geo"] });
  }

  // انعكاس التسميات لحظياً (بيانات/إظهار/قاعدة)
  useEffect(() => {
    if (!mapReady) return;
    applyAnnotations(mapRef.current, annFc, showAnnotations);
  }, [annFc, showAnnotations, mapReady, base]);

  // ===== بطاقة القطعة المحدَّدة (م7.4) =====
  const selectedProps = useMemo<ParcelProps | null>(() => {
    if (!selectedId) return null;
    const f = fc.features.find((ft) => ft.properties?.ref_id === selectedId);
    return (f?.properties as ParcelProps | undefined) ?? null;
  }, [fc, selectedId]);

  const selectedInfo = useMemo<SelectedEntityInfo>(() => {
    const p = selectedProps;
    if (!p) return { sector: null, area: null, investor: null };
    if (p.kind === "opportunity") {
      const o = (opps.data ?? []).find((x) => String(x.record_id) === p.entity_id);
      return { sector: o?.sector ?? null, area: o?.area_total_m2 ?? null, investor: null };
    }
    if (p.kind === "license") {
      const l = (lics.data ?? []).find((x) => String(x.record_id) === p.entity_id);
      return { sector: l?.sector ?? null, area: l?.area_total_m2 ?? null, investor: l?.investor_name ?? null };
    }
    const a = (assumed.data ?? []).find((x) => x.id === p.entity_id);
    return { sector: a?.sector ?? null, area: a?.area_m2 ?? null, investor: null };
  }, [selectedProps, opps.data, lics.data, assumed.data]);

  // م9.13/م9.15 · بيانات سلسلة بطاقات المجسّم المستقرّ (قطعة assumed): props + القطاع/المساحة + الضوابط الحتميّة (§ج.9).
  const settledModelData = useMemo<{ props: ParcelProps; info: SelectedEntityInfo; controls: ControlsResult | null } | null>(() => {
    if (!settledModelId) return null;
    const f = fc.features.find((ft) => ft.properties?.ref_id === settledModelId);
    const p = (f?.properties as ParcelProps | undefined) ?? null;
    if (!p) return null;
    const a = (assumed.data ?? []).find((x) => x.id === p.entity_id);
    const info = { sector: a?.sector ?? null, area: a?.area_m2 ?? null, investor: null };
    let controls: ControlsResult | null = null;
    if (a) {
      try {
        controls = evaluateControls(toControlsInput("assumed", a as unknown as Record<string, unknown>));
      } catch {
        controls = null; // أمان: غياب الضوابط لا يكسر العرض
      }
    }
    return { props: p, info, controls };
  }, [settledModelId, fc, assumed.data]);

  // تتبّع مرساة الشارة: مركز القطعة ← إسقاط شاشة يتحدّث مع كل حركة (rAF — سلس بلا إجهاد)
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !selectedProps) {
      setCalloutPx(null);
      calloutAnchorRef.current = null;
      return;
    }
    const f = fcRef.current.features.find((ft) => ft.properties?.ref_id === selectedProps.ref_id);
    if (!f?.geometry) {
      setCalloutPx(null);
      return;
    }
    calloutAnchorRef.current = centroid(f as Feature).geometry.coordinates as [number, number];
    let raf = 0;
    const update = (): void => {
      raf = 0;
      const mm = mapRef.current;
      const a = calloutAnchorRef.current;
      if (!mm || !a) return;
      const p = mm.project(a as [number, number]);
      const el = mm.getContainer();
      setCalloutPx({ x: p.x, y: p.y, w: el.clientWidth, h: el.clientHeight });
    };
    const onMove = (): void => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    m.on("move", onMove);
    m.on("resize", onMove);
    return () => {
      m.off("move", onMove);
      m.off("resize", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [selectedProps]);

  // م9.13 · إرساء بطاقة المجسّم فوق قمّته: إسقاط المركز + رفعه بمقدار يتناسب مع ارتفاع المبنى (متر/بكسل الحيّ) — يتبع التنقّل حيّاً.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !settledModelId) {
      modelCardAnchorRef.current = null;
      return;
    }
    const f = fcRef.current.features.find((ft) => ft.properties?.ref_id === settledModelId);
    if (!f?.geometry) return;
    const center = centroid(f as Feature).geometry.coordinates as [number, number];
    const heightM = modelDimsRef.current.get(settledModelId)?.heightM ?? 40;
    modelCardAnchorRef.current = { center, heightM, refZoom: m.getZoom(), refBearing: m.getBearing() };
    // ضرب مصفوفتَين 4×4 (مخزن عموديّ column-major): out = a · b
    const mul4 = (a: number[] | Float64Array, b: number[]): number[] => {
      const o = new Array<number>(16);
      for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) o[col * 4 + row] = a[row]! * b[col * 4]! + a[row + 4]! * b[col * 4 + 1]! + a[row + 8]! * b[col * 4 + 2]! + a[row + 12]! * b[col * 4 + 3]!;
      return o;
    };
    // م9.16 · matrix3d من مصفوفة إسقاط الخريطة (pixelProjectionMatrix: مشترك→بكسل، قلب Y والمنظور مدمجان) × نموذجٍ يضع البطاقة
    // مستوىً عالميّاً قائماً **يواجه كاميرا الاستقرار** فوق المبنى ⇒ كيان ثابت تدور حوله الكاميرا فترى جوانبه، ويتحجّم مع الزوم.
    const compute = (): string | null => {
      const mm = mapRef.current;
      const an = modelCardAnchorRef.current;
      if (!mm || !an) return null;
      const el = mm.getContainer();
      const w = el.clientWidth || 800;
      const h = el.clientHeight || 600;
      const c = mm.getCenter();
      const vp = new WebMercatorViewport({ width: w, height: h, longitude: c.lng, latitude: c.lat, zoom: mm.getZoom(), pitch: mm.getPitch(), bearing: mm.getBearing() });
      const altM = an.heightM * 1.03 + 1.5; // م9.17 · البطاقات تكاد تلامس سطح المجسّم (فوق قمّته بفارق ضئيل جداً) لا مرتفعة
      const cm = vp.projectPosition([an.center[0], an.center[1], altM]) as [number, number, number];
      const vpm = vp.viewProjectionMatrix as number[]; // مشترك→clip (عموديّ)
      if (vpm[3]! * cm[0] + vpm[7]! * cm[1] + vpm[11]! * cm[2] + vpm[15]! <= 0) return null; // م9.18 · المجسّم خلف الكاميرا ⇒ أخفِ البطاقات (فتنحسر بلا شذوذ إسقاط عند مغادرة الطيران)
      const upm = vp.getDistanceScales().unitsPerMeter[0] ?? 1;
      const s = (Math.max(28, an.heightM * 0.95) / 270) * upm; // وحدات مشتركة لكلّ بكسل (عرض البطاقة المحلّيّ 270px)
      const b = ((an.refBearing + CARD_YAW_DEG) * Math.PI) / 180; // اتّجاه المواجهة + ميل دورانيّ أفقيّ خفيف (٢٠°) حول المحور العموديّ
      const cosb = Math.cos(b);
      const sinb = Math.sin(b);
      // مستوٍ قائم يُرى بزاوية ثلاثيّة خفيفة: X→أفقيّ · Y(أسفل CSS)→أسفل (−Z) · Z→العاديّ
      const model = [s * cosb, -s * sinb, 0, 0, 0, 0, -s, 0, s * sinb, s * cosb, 0, 0, cm[0], cm[1], cm[2], 1];
      const sm = mul4(vp.pixelProjectionMatrix, model);
      return `matrix3d(${sm.map((v) => (Math.abs(v) < 1e-7 ? 0 : v).toFixed(8)).join(",")})`;
    };
    const apply = (): void => {
      const mx = compute();
      const el = holoMatrixRef.current;
      if (!el) return;
      if (mx) {
        el.style.transform = mx;
        el.style.visibility = "visible";
      } else {
        el.style.visibility = "hidden"; // خلف الكاميرا/بلا مرساة ⇒ إخفاء (لا تجميد)
      }
    };
    apply();
    // تحديث متزامن مع كلّ إطار رسمٍ للخريطة عبر ref مباشرةً (لا setState) ⇒ بلا تأخّر/ارتجاف — نمط positionPingEl.
    m.on("render", apply);
    m.on("move", apply);
    m.on("resize", apply);
    return () => {
      m.off("render", apply);
      m.off("move", apply);
      m.off("resize", apply);
    };
  }, [settledModelId]);

  // م9.17 · تعتيم محيطيّ منسّق (vignette): عند تركيز مجسّم والهبوط تحت ٢كم، يتعتّم محيطُه تدريجيّاً (ناعم لا قاتم) فيبرز.
  // المركز يتبع موضع المجسّم المُسقَط، والشدّة تتدرّج مع الارتفاع — يُحدَّث عبر ref كلّ إطار (نمط positionPing، بلا setState).
  useEffect(() => {
    const host = vignetteRef.current;
    if (!modelFocusId) {
      vignKeyRef.current = "off";
      if (host) host.style.opacity = "0";
      return;
    }
    const f = fcRef.current.features.find((ft) => ft.properties?.ref_id === modelFocusId);
    const center = f?.geometry ? (centroid(f as Feature).geometry.coordinates as [number, number]) : null;
    if (!center) {
      if (host) host.style.opacity = "0";
      return;
    }
    // حلقة rAF خاصّة (لا تعتمد على إطلاق MapLibre لـ render عند السكون) ⇒ التعتيم يظهر/يتحدّث دائماً أثناء الطيران والاستقرار.
    let raf = 0;
    const tick = (): void => {
      const mm = mapRef.current;
      const e = vignetteRef.current;
      if (mm && e) {
        const cH = mm.getCanvas().clientHeight || 800;
        const cW = mm.getCanvas().clientWidth || 1200;
        const lat = mm.getCenter().lat;
        const alt = (234814.55088 * cH * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, mm.getZoom());
        const t = Math.min(1, Math.max(0, (2000 - alt) / 1300)); // 0 عند ٢كم ← 1 عند ٧٠٠م
        if (t <= 0.002) {
          if (vignKeyRef.current !== "off") {
            e.style.opacity = "0";
            vignKeyRef.current = "off";
          }
        } else {
          const pt = mm.project(center);
          const key = `${Math.round(pt.x)},${Math.round(pt.y)},${t.toFixed(2)},${cW}x${cH}`;
          if (key !== vignKeyRef.current) {
            vignKeyRef.current = key; // خنق: لا إعادة طلاء ما لم يتغيّر المركز/الشدّة/المقاس
            const R = Math.round(Math.min(cW, cH) * 0.96);
            e.style.background = `radial-gradient(circle ${R}px at ${Math.round(pt.x)}px ${Math.round(pt.y)}px, rgba(2,6,18,0) 0%, rgba(2,6,18,0) 24%, rgba(2,6,18,0.30) 58%, rgba(2,6,18,0.46) 100%)`;
            e.style.opacity = t.toFixed(3); // محيط أكثف عند الحوافّ (≤٠٫٤٦ كحليّ — ناعم لا قاتم) وشفّاف تماماً على المجسّم
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      vignKeyRef.current = "off";
      if (host) host.style.opacity = "0";
    };
  }, [modelFocusId]);

  // م8.3/م8.7 · تسميات الدبابيس فوق الدبابيس المرئية باسم القطعة المختصر — تبدأ بالظهور عند ~5كم (z≈11)
  // على كل الشاشات وتكتمل بالاقتراب، مع فرز بالأقرب لمركز الشاشة (cap). تتبّع حيّ بـrAF كالشارة.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !mapReady) return;
    const SHOW = 12.0; // م8.7 · مستوى ~5كم على شريط المقياس (كان 13.5 ≈ ~1كم)
    const FADE = 1.0; // مدى تلاشٍ أوسع — تبدأ بالظهور عند ~5كم وتكتمل بالاقتراب
    const CAP = 60; // حدّ التسميات المرئية مع فرز بالأقرب لمركز الشاشة (أولوية حتمية لا اقتطاع عشوائي)
    const PING_CAP = 50; // م8.8 · حدّ نبضات الموقع المرئية (الأقرب للمركز)
    const PING_Z_OUT = 8.5; // م8.8.2 · عند هذا الزوم وأدنى (عرض المحافظة) → أصغر حجم (القطع متقاربة)
    const PING_Z_IN = 12.5; // م8.8.2 · عند هذا الزوم وأعلى (~5كم فأقرب) → الحجم الكامل (القطع متباعدة)
    const PING_S_MIN = 0.4; // م8.8.2 · أصغر معامل حجم عند أقصى إبعاد
    // م9.7 · حلقة المفترضة بأزرق غامق من نفس العائلة (تبرز بوضوح على القمر الصناعي)
    const PING_HEX: Record<string, string> = { announced: "#C7A24E", "in-progress": "#5775A8", completed: "#5E977A", withdrawn: "#B5616A", assumed: "#0E5FB0" };
    const PING_S_MAX_EXTRA = 2.0; // م9.7 · أقصى توسيع إضافي للقطر عند التقرّب الشديد من القطعة
    let raf = 0;
    let lastTs = -1e9; // م9.9 (A2) · ختم آخر حسبة عضويّة — لخنق ~30fps أثناء الحركة المستمرّة
    const MOTION_THROTTLE = 32; // ~30fps أثناء الطيران/مدار الدرون؛ المواضع تبقى ملتصقة كلّ إطار عبر positionPingEl (60fps) فلا ارتجاف
    // مرور واحد على القطع: نبضات الموقع (كل مستويات الزوم) + تسميات الدبابيس (عند الاقتراب op>0) — تفادياً لمرورين.
    const compute = (): void => {
      raf = 0; // حارس دفاعيّ: أيّ استدعاء مباشر/مجدوَل يصفّر الجدولة فلا ازدواج حساب (onMove يجدول من جديد عند الحاجة)
      const mm = mapRef.current;
      if (!mm) return;
      if (tourActiveRef.current || cineActiveRef.current) return; // أثناء الجولة: الواجهة مخفيّة — لا حساب نبضات/تسميات لكلّ إطار
      const op = Math.max(0, Math.min(1, (mm.getZoom() - (SHOW - FADE)) / FADE));
      setLabelOpacity(op);
      if (!showParcelsRef.current) {
        setPinLabels((prev) => (prev.length ? [] : prev));
        setPinPings((prev) => (prev.length ? [] : prev));
        return;
      }
      const el = mm.getContainer();
      const W = el.clientWidth;
      const Ht = el.clientHeight;
      const cx = W / 2;
      const cy = Ht / 2;
      // م9.8 · الارتفاع الجوّي (متر، مطابق لمؤشّر الارتفاع): عند ≤2كم تختفي نبضة مركز المجسّم (المفترضة)
      // وتبقى فقط حلقات deck النابضة من حدّ البصمة الخارجيّ؛ فوق 2كم يبقى السلوك كما هو.
      const lat0 = mm.getCenter().lat;
      const mpp0 = (156543.03392 * Math.cos((lat0 * Math.PI) / 180)) / Math.pow(2, mm.getZoom());
      const hideCenterPing = (0.5 / Math.tan(0.6435011087932844 / 2)) * Ht * mpp0 <= 2000;
      const hidden = hiddenStatesRef.current;
      const wantLabels = op > 0.01; // التسميات عند الاقتراب فقط؛ النبضات على كل مستويات الزوم
      const pings: { x: number; y: number; lng: number; lat: number; key: string; color: string; d: number }[] = [];
      const cand: { x: number; y: number; name: string; key: string; d: number }[] = [];
      for (const f of fcRef.current.features) {
        if (!f.geometry) continue;
        const p = f.properties ?? {};
        const st = String(p.state ?? "");
        if (hidden.has(st)) continue;
        if (nbhFilterRef.current && p.neighborhood !== nbhFilterRef.current) continue; // احترم فلتر الحي
        if (editingRef.current && p.ref_id === editingRef.current.refId) continue; // القطعة قيد التحرير لا نبضة/تسمية لها
        // م9.9 (A1) · المركز من التخبئة (نفس قيمة turf — صفر تغيير)؛ احتياطاً يُحسب آنياً للقطعة بلا ref_id
        const rid = p.ref_id;
        const c = (rid != null ? centroidMapRef.current.get(String(rid)) : undefined) ?? (centroid(f as Feature).geometry.coordinates as [number, number]);
        const pt = mm.project(c);
        if (pt.x < -30 || pt.x > W + 30 || pt.y < -30 || pt.y > Ht + 30) continue;
        const d = Math.hypot(pt.x - cx, pt.y - cy);
        // م9.8 · ≤2كم جوّي: تُحجَب نبضة مركز المجسّم (المفترضة)؛ تبقى حلقات deck من حدّ البصمة. (التسمية تبقى.)
        if (!(hideCenterPing && p.kind === "assumed")) pings.push({ x: pt.x, y: pt.y, lng: c[0], lat: c[1], key: String(p.ref_id ?? `${Math.round(pt.x)},${Math.round(pt.y)}`), color: PING_HEX[st] ?? "#9fc0e8", d });
        if (wantLabels) {
          const name = typeof p.label === "string" && p.label ? p.label : typeof p.parcel_no === "string" ? p.parcel_no : "";
          if (name) cand.push({ x: pt.x, y: pt.y, name, key: String(p.ref_id ?? name), d });
        }
      }
      pings.sort((a, b) => a.d - b.d);
      setPinPings(pings.slice(0, PING_CAP).map((r) => ({ x: r.x, y: r.y, lng: r.lng, lat: r.lat, key: r.key, color: r.color })));
      // م8.8.2 · حجم النبضة مرن مع الزوم: الحجم الكامل عند التقريب (تتباعد القطع فلا تتداخل الحلقات)،
      // ويصغر تدريجياً عند الإبعاد (زوم-آوت) حيث تتقارب القطع — لعرض أنيق بلا تداخل. (smoothstep بين عتبتَي الزوم.)
      const z = mm.getZoom();
      const zt = Math.max(0, Math.min(1, (z - PING_Z_OUT) / (PING_Z_IN - PING_Z_OUT)));
      let psv = PING_S_MIN + (1 - PING_S_MIN) * (zt * zt * (3 - 2 * zt)); // 0.4→1 على z8.5→12.5
      // م9.7 · توسيع المدى/القطر عند التقرّب الشديد بآخر درجات الزوم: نموّ مستمرّ فوق z12.5 (حتى ~3×)
      if (z > PING_Z_IN) psv += Math.min(PING_S_MAX_EXTRA, (z - PING_Z_IN) * 0.55);
      const ps = +psv.toFixed(3);
      setPingScale((prev) => (prev === ps ? prev : ps));
      // م8.12.1 · ميل الحلقات لتنبسط على الأرض في 3D: rotateX = ميل الكاميرا الحالي (الحلقات دوائر فالاتجاه/البيرنغ لا يؤثّر)،
      // وperspective ≈ مسافة الكاميرا بالبكسل ((0.5/tan(fov/2))·الارتفاع) فيطابق منظور الخريطة — يتحدّث حيّاً مع easeTo الميل.
      const tiltDeg = Math.round(mm.getPitch() * 10) / 10;
      const persp = Math.max(600, Math.round((0.5 / Math.tan(0.6435011087932844 / 2)) * Ht));
      setPingTilt((prev) => (prev.deg === tiltDeg && prev.persp === persp ? prev : { deg: tiltDeg, persp }));
      cand.sort((a, b) => a.d - b.d); // الأقرب لمركز الشاشة أولاً
      setPinLabels(wantLabels ? cand.slice(0, CAP).map((r) => ({ x: r.x, y: r.y, name: r.name, key: r.key })) : []);
    };
    // م9.9 (A2) · خنق إعادة حساب العضويّة/الحجم إلى ~30fps أثناء الحركة المستمرّة (يخفّف إعادة تصيير React لنبضات/تسميات
    // عددها كبير كلّ إطار)؛ يُعاد الجدولة دون حساب حتى تنقضي العتبة، فتُضمن حسبة نهائيّة دقيقة عند الاستقرار.
    const tick = (ts: number): void => {
      if (ts - lastTs < MOTION_THROTTLE) { raf = requestAnimationFrame(tick); return; } // مبكّر — أعد الجدولة (تضمن حسبة لاحقة)
      lastTs = ts;
      compute(); // compute يصفّر raf في رأسه
    };
    const onMove = (): void => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    // عند استقرار الحركة (نهاية flyTo/fitBounds + نهاية مدار الدرون): حسبة نهائيّة **فوريّة دقيقة** بالحالة النهائيّة —
    // تُلغي أيّ جدولة مخنوقة معلّقة وتصفّر العتبة فلا تبقى العضويّة/الحجم على حالة وسطى من الحركة.
    const onSettle = (): void => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      lastTs = -1e9;
      compute();
    };
    m.on("move", onMove);
    m.on("zoom", onMove);
    m.on("moveend", onSettle);
    m.on("zoomend", onSettle);
    compute();
    return () => {
      m.off("move", onMove);
      m.off("zoom", onMove);
      m.off("moveend", onSettle);
      m.off("zoomend", onSettle);
      if (raf) cancelAnimationFrame(raf);
    };
    // fc ضمن التبعيات: يُعيد الحساب عند تحميل/تغيّر القطع دون انتظار حركة المستخدم (مهمّ للنبضات في العرض الساكن)
  }, [mapReady, fc]);

  // م9.9 · يضع عنصر نبضة واحداً بإسقاط إحداثيّاته العالميّة (data-lng/lat). الموضع يُدار **إمبراطيفياً فقط** (لا في style
  // الخاصّ بـReact) كي لا يُعيد React كتابة transform بقيمة متأخّرة إطاراً فيعود الانزلاق. يُستدعى عند التركيب (ref) وكلّ إطار رسم.
  const positionPingEl = (el: HTMLElement | null): void => {
    if (!el) return;
    const mm = mapRef.current;
    if (!mm) return;
    const lng = Number(el.dataset.lng);
    const lat = Number(el.dataset.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    const pt = mm.project([lng, lat]);
    el.style.transform = `translate(${pt.x}px, ${pt.y}px) rotateX(${pingTiltDegRef.current}deg) scale(${pingScaleRef.current})`;
  };
  // تموضع النبضات فوريّاً بتزامن مع رسم الخريطة (حدث "render" كلّ إطار) — العضويّة تُحدَّث على "move" أعلاه، أمّا الموضع
  // فيُعاد إسقاطه كلّ إطار فيبقى ملتصقاً بالأرض بلا تأخّر إطار. يزيل ارتجاف/انزلاق الحلقات أثناء الطيران والدوران.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !mapReady) return;
    const sync = (): void => {
      const layer = pingLayerRef.current;
      if (!layer) return;
      for (const el of Array.from(layer.children) as HTMLElement[]) positionPingEl(el);
    };
    m.on("render", sync);
    sync();
    return () => {
      m.off("render", sync);
    };
    // positionPingEl يقرأ مراجع ثابتة فقط — لا حاجة لإدراجه في التبعيات
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]);

  // م8.8 · مؤشّر الارتفاع الجوي: ارتفاع الكاميرا فوق المركز محسوباً **حتمياً** من الزوم/خط العرض/مجال الرؤية
  // (هندسة ميركاتور — قيمة فعلية لا مؤلَّفة)، يتحدّث لحظياً مع الزوم.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !mapReady) return;
    let raf = 0;
    const FOV = 0.6435011087932844; // المجال الرأسي الافتراضي لكاميرا MapLibre (rad)
    const upd = (): void => {
      raf = 0;
      const mm = mapRef.current;
      if (!mm) return;
      if (tourActiveRef.current || cineActiveRef.current) return; // أثناء الجولة: مؤشّر الارتفاع مخفيّ — لا تحديث حالة لكلّ إطار
      const lat = mm.getCenter().lat;
      const mpp = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, mm.getZoom()); // متر/بكسل عند المركز
      const h = mm.getCanvas().clientHeight || mm.getContainer().clientHeight || 1;
      const alt = (0.5 / Math.tan(FOV / 2)) * h * mpp; // مسافة الكاميرا للمركز (بكسل) × متر/بكسل = الارتفاع بالمتر
      if (Number.isFinite(alt)) setAltM(alt);
    };
    const onMove = (): void => {
      if (!raf) raf = requestAnimationFrame(upd);
    };
    m.on("move", onMove);
    m.on("zoom", onMove);
    upd();
    return () => {
      m.off("move", onMove);
      m.off("zoom", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mapReady]);

  // تتبّع بطاقة الإشارة (م7.8): إسقاط شاشة حيّ لموقع الإشارة مع كل حركة/تكبير — كالشارة تماماً
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !mkSel) {
      setMkPx(null);
      return;
    }
    let raf = 0;
    const update = (): void => {
      raf = 0;
      const mm = mapRef.current;
      if (!mm) return;
      const p = mm.project(mkSel.lngLat);
      const el = mm.getContainer();
      setMkPx({ x: p.x, y: p.y, w: el.clientWidth, h: el.clientHeight });
    };
    const onMove = (): void => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    m.on("move", onMove);
    m.on("resize", onMove);
    return () => {
      m.off("move", onMove);
      m.off("resize", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mkSel]);

  function onCardEditGeometry(): void {
    const p = selectedProps;
    if (!p) return;
    if (drawModeRef.current !== "edit") enterDrawMode("edit");
    editStartRef.current?.(p);
  }

  // حذف الرسمة من الخريطة (فكّ الارتباط §هـ.4) — بيانات القطعة لا تُمسّ
  async function onCardDeleteGeometry(): Promise<void> {
    const p = selectedProps;
    if (!p) return;
    const msg =
      p.kind === "assumed"
        ? `إزالة حدود «${p.label}» من الخريطة؟ يبقى سجلّها محفوظاً في «الخارطة الاستثمارية».`
        : `إزالة رسمة «${p.label}» من الخريطة؟ بيانات القطعة تبقى محفوظة في قسمها.`;
    if (!window.confirm(msg)) return;
    const res = await deleteParcelGeometry(p.kind, p.ref_id);
    if (!res.ok) {
      toast.error(`تعذّرت إزالة الرسمة: ${res.error}`);
      return;
    }
    setSelectedId(null);
    setMkSel(null);
    void queryClient.invalidateQueries({ queryKey: ["map_parcels"] });
    void queryClient.invalidateQueries({ queryKey: ["table", "assumed_parcels"] });
    void queryClient.invalidateQueries({ queryKey: ["table", "parcel_geometry"] });
    void queryClient.invalidateQueries({ queryKey: ["counts"] });
    toast.success("أُزيلت الرسمة من الخريطة — البيانات محفوظة");
  }

  const { isViewer } = useRole(); // الثاني: لا رسم ولا تعديل/حذف حدود (م8.1)
  // أحياء فلترة الظهور: القطع المرسومة ∪ القاموس الموحّد (م7.7 — نفس القيم في كل منسدلات النظام)
  const { data: fieldOpts } = useFieldOptions();
  const neighborhoodOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...fc.features
            .map((f) => (typeof f.properties?.neighborhood === "string" ? f.properties.neighborhood : null))
            .filter((v): v is string => Boolean(v)),
          ...(fieldOpts?.neighborhood ?? []),
        ]),
      ).sort(),
    [fc, fieldOpts],
  );

  const altText = altM >= 1000 ? `${(altM / 1000).toLocaleString("en-US", { maximumFractionDigits: altM >= 10000 ? 0 : 1 })} كم` : `${Math.round(altM).toLocaleString("en-US")} م`;
  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* م9.17 · تعتيم محيطيّ منسّق حول المجسّم المركَّز (تحت البطاقات z-[15]، فوق الخريطة) — يبرز المجسّم بلا قتامة */}
      <div ref={vignetteRef} aria-hidden className="pointer-events-none absolute inset-0 z-[13]" style={{ opacity: 0 }} />

      {/* م9.11 · تعذّر WebGL — رسالة لطيفة قابلة للتعافي بدل انهيار الواجهة (تسريع العتاد معطّل / GPU reset / سياقات مستنزَفة) */}
      {webglError && (
        <div className="absolute inset-0 z-[120] flex flex-col items-center justify-center gap-4 bg-[hsl(221_44%_7%/0.96)] p-6 text-center backdrop-blur-md">
          <div className="max-w-md space-y-3">
            <h2 className="text-lg font-bold text-foreground">تعذّر تشغيل عرض الخريطة (WebGL)</h2>
            <p className="text-sm leading-relaxed text-foreground/75">
              لم يستطع المتصفّح إنشاء سياق WebGL — غالباً تسريع العتاد معطّل أو حدث تعطّل مؤقّت لكرت الشاشة (GPU).
            </p>
            <ul className="space-y-1.5 text-start text-[13px] text-foreground/70">
              <li>① أغلق البرامج الثقيلة على كرت الشاشة (مثل Blender) ثمّ أعد المحاولة.</li>
              <li>② فعّل «تسريع العتاد / Use hardware acceleration» في إعدادات المتصفّح وأعِد تشغيله.</li>
              <li>③ تحقّق من <span dir="ltr" className="font-mono text-foreground/85">chrome://gpu</span> — يجب أن يكون WebGL «Hardware accelerated».</li>
              <li>④ أعِد تشغيل الجهاز إن استمرّ (تعافي مشغّل الـGPU).</li>
            </ul>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground shadow-[0_0_16px_-4px_rgba(148,175,209,0.9)] transition hover:brightness-110 active:scale-95"
          >
            إعادة التحميل
          </button>
        </div>
      )}

      {/* م9.9 (②) · شاشة تحميل المدينة كاملةً عند بدء الجلسة (بنسبة مئويّة لاتينية) — يُحمَّل مرّة واحدة ثمّ تنقّل بلا تقطّع.
          قابلة للتخطّي والدخول فوراً. تختفي عند الاكتمال. */}
      {prefetchPct !== null && (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-[hsl(221_44%_7%/0.82)] backdrop-blur-md">
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-sm font-bold text-foreground/90">جارٍ تحميل خريطة المدينة كاملةً</span>
            <span className="text-[11px] text-foreground/55">تنقّل وطيران بلا تقطّع — يُحمَّل مرّة واحدة لهذه الجلسة</span>
          </div>
          <div className="h-2.5 w-72 max-w-[78vw] overflow-hidden rounded-full border border-white/10 bg-white/[0.06]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#5775A8] via-[#9fc0e8] to-[#e3edfb] shadow-[0_0_12px_-2px_rgba(159,192,232,0.8)] transition-[width] duration-200 ease-out" style={{ width: `${prefetchPct}%` }} />
          </div>
          <span dir="ltr" className="text-base font-extrabold tabular-nums text-[#cfe0f6]">{prefetchPct}%</span>
          <button
            type="button"
            onClick={() => {
              prefetchRef.current?.cancel();
              setPrefetchPct(null);
            }}
            className="mt-1 rounded-full border border-[rgba(159,192,232,0.4)] bg-white/[0.04] px-4 py-1.5 text-xs font-semibold text-foreground/80 transition hover:bg-white/[0.1]"
          >
            تخطٍّ والدخول الآن
          </button>
        </div>
      )}

      {/* م9.10 · إنهاء الجولة السينمائيّة — يظهر أثناء الجولة فقط (أعلى البداية)، فوق كلّ شيء */}
      {tourActive ? (
        <button
          type="button"
          onClick={() => (cinematicActive ? requestStopCinematicTour() : requestStopTour())}
          title="إنهاء الجولة (Esc)"
          aria-label="إنهاء الجولة"
          className="absolute start-4 top-4 z-[100] inline-flex items-center gap-2 rounded-full border border-[rgba(159,192,232,0.5)] bg-[hsl(221_44%_9%/0.82)] px-4 py-2 text-sm font-bold text-foreground shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8),0_0_22px_-6px_rgba(148,175,209,0.7)] backdrop-blur-md transition hover:bg-[hsl(221_44%_14%/0.92)] active:scale-95"
        >
          <X className="size-4" /> إنهاء الجولة
        </button>
      ) : null}

      {/* م8.8 · مؤشّر «مسافة الارتفاع الجوي عن الخريطة» — رقم ثلاثي الأبعاد عائم أسفل-يمين يتحدّث لحظياً */}
      <div className={cn("pointer-events-none absolute bottom-[calc(var(--sab)+5.5rem)] left-3 z-[13] flex flex-col items-start gap-0.5 rounded-2xl border border-[rgba(159,192,232,0.45)] bg-[linear-gradient(160deg,hsl(221_40%_17%/0.95),hsl(221_44%_9%/0.95))] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_14px_34px_-12px_rgba(0,0,0,0.9),0_0_24px_-8px_rgba(148,175,209,0.6)] backdrop-blur-md md:bottom-[8.75rem] md:left-auto md:right-3 md:items-end lg:right-[6.5rem]", tourActive && "hidden")}>
        <span className="text-[9px] font-semibold leading-none text-foreground/70">الارتفاع الجوي</span>
        <span dir="ltr" className="bg-gradient-to-b from-white via-[#e3edfb] to-[#9fc0e8] bg-clip-text text-lg font-extrabold tabular-nums leading-none tracking-tight text-transparent drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
          {altText}
        </span>
      </div>

      {/* عمود الأدوات العائمة: القاعدة · العودة · الطبقات ← ثم استوديو الرسم — فوق الجارت دائماً (z-20).
          م8.7: على lg تُزاح يسار الدوك العائم (end-[6.5rem]) كي لا تتداخل معه على الخريطة الكاملة. */}
      <div className={cn("absolute end-3 top-16 z-20 flex flex-col items-end gap-2 lg:end-[6.5rem]", tourActive && "hidden")}>
        <div className={cn("flex gap-0.5 rounded-2xl p-1", GLASS)}>
          {BASES.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => void switchBase(b.id)}
              className={cn(
                "rounded-xl px-2.5 py-2 text-[11px] font-semibold transition active:scale-95",
                base === b.id
                  ? "bg-primary text-primary-foreground shadow-[0_0_14px_-4px_rgba(148,175,209,0.9)]"
                  : "text-foreground/75 hover:bg-white/8 hover:text-foreground",
              )}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* م9.8 · مقارنة مزوّد القمر الصناعي — محلّي فقط (يُخفى في الإنتاج)، يظهر حين القمر فعّال */}
        {process.env.NODE_ENV !== "production" && base === "satellite" && (
          <div className={cn("flex gap-0.5 rounded-2xl p-1", GLASS)}>
            {([
              { id: "maptiler", label: "MapTiler" },
              { id: "google", label: "Google" },
            ] as const).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pickSatProvider(p.id)}
                className={cn(
                  "rounded-xl px-2 py-1.5 text-[10px] font-semibold transition active:scale-95",
                  satProvider === p.id
                    ? "bg-primary text-primary-foreground shadow-[0_0_14px_-4px_rgba(148,175,209,0.9)]"
                    : "text-foreground/75 hover:bg-white/8 hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        <div className={cn("flex gap-0.5 rounded-2xl p-1", GLASS)}>
          <button
            type="button"
            data-sfx="off"
            onClick={resetView}
            title="إعادة العرض إلى كامل نينوى"
            aria-label="كامل نينوى"
            className="grid size-10 place-items-center rounded-xl text-foreground/80 transition hover:bg-white/8 hover:text-foreground active:scale-95 max-md:hidden lg:hidden"
          >
            <Maximize2 className="size-4 text-primary/80" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() =>
              setShowLayers((v) => {
                const next = !v;
                if (next) {
                  setDrawOpen(false); // فتح الطبقات يطوي استوديو الرسم (لا تعارض)
                  setShowNbh(false); // ويطوي منسدلة فلتر الحي
                }
                return next;
              })
            }
            title="الطبقات وتحديد الظهور"
            aria-label="الطبقات"
            aria-expanded={showLayers}
            className={cn(
              "flex size-10 flex-col items-center justify-center gap-0.5 rounded-xl transition active:scale-95",
              showLayers
                ? "bg-primary/20 text-primary shadow-[0_0_14px_-4px_rgba(148,175,209,0.9)] ring-1 ring-inset ring-primary/40"
                : "text-foreground/80 hover:bg-white/8 hover:text-foreground",
            )}
          >
            <Layers style={{ width: 15, height: 15 }} aria-hidden />
            <ChevronDown style={{ width: 10, height: 10 }} className={cn("transition-transform", showLayers && "rotate-180")} aria-hidden />
          </button>
        </div>

        {/* كتم/تشغيل صوت النظام (طلب معتمد) — تحت زر تحديد الظهور */}
        <div className={cn("flex rounded-2xl p-1", GLASS)}>
          <button
            type="button"
            onClick={() => {
              const next = !sfxMuted;
              setSfxMuted(next);
              setSfxMutedState(next);
            }}
            title={sfxMuted ? "تشغيل الصوت" : "كتم الصوت"}
            aria-label={sfxMuted ? "تشغيل الصوت" : "كتم الصوت"}
            aria-pressed={sfxMuted}
            className={cn(
              "grid size-10 place-items-center rounded-xl transition active:scale-95",
              sfxMuted ? "bg-state-withdrawn/15 text-state-withdrawn ring-1 ring-inset ring-state-withdrawn/40" : "text-foreground/80 hover:bg-white/8 hover:text-foreground",
            )}
          >
            {sfxMuted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4 text-primary/80" aria-hidden />}
          </button>
        </div>

        {/* م8.9 · فلتر الحي — زر عائم مستقل تحت زر الصوت يفتح منسدلة قابلة للتمرير (نُقل من لوحة الطبقات) */}
        <div className={cn("flex rounded-2xl p-1", GLASS)}>
          <button
            type="button"
            onClick={() =>
              setShowNbh((v) => {
                const next = !v;
                if (next) {
                  setShowLayers(false);
                  setDrawOpen(false);
                }
                return next;
              })
            }
            title="فلترة حسب الحي"
            aria-label="فلترة حسب الحي"
            aria-expanded={showNbh}
            className={cn(
              "grid size-10 place-items-center rounded-xl transition active:scale-95",
              nbhFilter || showNbh
                ? "bg-primary/20 text-primary shadow-[0_0_14px_-4px_rgba(148,175,209,0.9)] ring-1 ring-inset ring-primary/40"
                : "text-foreground/80 hover:bg-white/8 hover:text-foreground",
            )}
          >
            <MapPinned className="size-4" aria-hidden />
          </button>
        </div>

        {/* م8.12 · تبديل عرض الخريطة 3D/2D — تحت زر فلتر الحي (الافتراضي 3D) */}
        <div className={cn("flex rounded-2xl p-1", GLASS)}>
          <button
            type="button"
            onClick={() => {
              const m = mapRef.current;
              if (!m) return;
              const next = !map3D;
              setMap3D(next);
              m.easeTo({ pitch: next ? 48 : 0, duration: 600 });
            }}
            title={map3D ? "تبديل إلى عرض ثنائي الأبعاد 2D" : "تبديل إلى عرض ثلاثي الأبعاد 3D"}
            aria-label="تبديل عرض الخريطة 3D/2D"
            aria-pressed={map3D}
            className={cn(
              "grid size-10 place-items-center rounded-xl text-[11px] font-extrabold tracking-tight transition active:scale-95",
              map3D
                ? "bg-primary/20 text-primary shadow-[0_0_14px_-4px_rgba(148,175,209,0.9)] ring-1 ring-inset ring-primary/40"
                : "text-foreground/80 hover:bg-white/8 hover:text-foreground",
            )}
          >
            {map3D ? "3D" : "2D"}
          </button>
        </div>

        {/* م9.7.4 · استعراض حرّ للمجسّم (تدوير بكل الاتجاهات + زوم) — يظهر عند تركيز قطعة مفترضة */}
        {modelFocusId ? (
          <div className={cn("flex rounded-2xl p-1", GLASS)}>
            <button
              type="button"
              onClick={() => {
                const m = mapRef.current;
                if (!m) return;
                const next = !orbitOn;
                setOrbitOn(next);
                if (next) {
                  const f = fcRef.current.features.find((ft) => ft.properties?.ref_id === modelFocusId);
                  if (f?.geometry) {
                    const c = centroid(f as Feature<Polygon | MultiPolygon>).geometry.coordinates as [number, number];
                    m.easeTo({ center: c, pitch: Math.max(m.getPitch(), 55), duration: 500, essential: true });
                  }
                }
              }}
              title={orbitOn ? "إنهاء الاستعراض الحرّ" : "استعراض حرّ: تدوير المجسّم بكل الاتجاهات + زوم"}
              aria-label="استعراض حرّ للمجسّم"
              aria-pressed={orbitOn}
              className={cn(
                "grid size-10 place-items-center rounded-xl transition active:scale-95",
                orbitOn
                  ? "bg-primary/20 text-primary shadow-[0_0_14px_-4px_rgba(148,175,209,0.9)] ring-1 ring-inset ring-primary/40"
                  : "text-foreground/80 hover:bg-white/8 hover:text-foreground",
              )}
            >
              <Rotate3d className="size-5" />
            </button>
            {/* م9.17 · اعتماد المشهد الحاليّ لاستقرار الدرون **لهذا الموقع وحده** (ركّب المشهد بحرّية ثم اضغط) — يُحفَظ لكلّ موقع مستقلّاً */}
            <button
              type="button"
              onClick={captureSettleView}
              title="اعتمِد مشهد هذا الموقع لاستقرار الدرون (ارتفاع + ميل + اتّجاه + موضع المجسّم) — مستقلّ لكلّ موقع"
              aria-label="اعتماد مشهد استقرار الموقع"
              aria-pressed={savedViewIds.includes(modelFocusId)}
              className={cn(
                "grid size-10 place-items-center rounded-xl transition active:scale-95",
                savedViewIds.includes(modelFocusId)
                  ? "bg-emerald-500/20 text-emerald-300 shadow-[0_0_14px_-4px_rgba(16,185,129,0.9)] ring-1 ring-inset ring-emerald-400/40"
                  : "text-foreground/80 hover:bg-white/8 hover:text-foreground",
              )}
            >
              <Crosshair className="size-5" />
            </button>
          </div>
        ) : null}

        {/* لوحة تحديد الظهور: حدود · قطع · الحالات الخمس — انسدال بسلاسة استوديو الرسم (م7.6) */}
        <AnimatePresence initial={false}>
          {showLayers ? (
            <motion.div
              key="layers-panel"
              initial={{ height: 0, opacity: 0, overflow: "hidden" }}
              animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
              exit={{ height: 0, opacity: 0, overflow: "hidden" }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className={cn("flex w-48 flex-col gap-1.5 rounded-2xl p-3 text-xs text-foreground/90", GLASS)}
            >
              <label className="inline-flex cursor-pointer items-center gap-2 py-0.5">
                <input type="checkbox" checked={showBoundaries} onChange={(e) => setShowBoundaries(e.target.checked)} className="size-4 accent-primary" />
                الحدود الإدارية
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 py-0.5">
                <input type="checkbox" checked={showAnnotations} onChange={(e) => setShowAnnotations(e.target.checked)} className="size-4 accent-primary" />
                التسميات المحرَّرة
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 py-0.5">
                <input type="checkbox" checked={showParcels} onChange={(e) => setShowParcels(e.target.checked)} className="size-4 accent-primary" />
                القطع
              </label>
              {showParcels ? (
                <>
                  <div className="flex flex-col gap-1 border-t border-border/50 pt-1.5">
                    {STATE_TOGGLES.map((st) => (
                      <label key={st.value} className="inline-flex cursor-pointer items-center gap-2 py-0.5">
                        <input
                          type="checkbox"
                          checked={!hiddenStates.has(st.value)}
                          onChange={() =>
                            setHiddenStates((prev) => {
                              const next = new Set(prev);
                              if (next.has(st.value)) next.delete(st.value);
                              else next.add(st.value);
                              return next;
                            })
                          }
                          className={`size-4 ${st.accent}`}
                        />
                        {st.label}
                      </label>
                    ))}
                  </div>
                </>
              ) : null}
              {hiddenStates.size > 0 || nbhFilter || !showBoundaries || !showParcels || !showAnnotations ? (
                <button
                  type="button"
                  onClick={() => {
                    setHiddenStates(new Set());
                    setNbhFilter("");
                    setShowBoundaries(true);
                    setShowParcels(true);
                    setShowAnnotations(true);
                  }}
                  className="mt-0.5 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/50 py-1.5 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  <FilterX className="size-3.5" /> إظهار الكل
                </button>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* م8.9 · منسدلة فلتر الحي — حقل بحث + قائمة طولية قابلة للتمرير (تظهر تحت زر الحي) */}
        <AnimatePresence initial={false}>
          {showNbh ? (
            <motion.div
              key="nbh-panel"
              initial={{ height: 0, opacity: 0, overflow: "hidden" }}
              animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
              exit={{ height: 0, opacity: 0, overflow: "hidden" }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className={cn("flex w-48 flex-col rounded-2xl p-3 text-xs text-foreground/90", GLASS)}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-foreground/85">فلترة حسب الحي</span>
                {nbhFilter ? (
                  <span className="max-w-24 truncate rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary ring-1 ring-inset ring-primary/40" title={nbhFilter}>
                    {nbhFilter}
                  </span>
                ) : null}
              </div>
              <input
                value={nbhQuery}
                onChange={(e) => setNbhQuery(e.target.value)}
                placeholder="ابحث عن حي…"
                className="mb-1.5 w-full rounded-lg border border-input bg-background/60 px-2 py-1.5 text-[11px] outline-none transition focus:ring-2 focus:ring-ring"
              />
              <div className="scroll-slim max-h-60 space-y-0.5 overflow-y-auto pe-0.5">
                <button
                  type="button"
                  onClick={() => setNbhFilter("")}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-right text-[11px] transition",
                    !nbhFilter ? "bg-primary/15 font-bold text-primary ring-1 ring-inset ring-primary/35" : "text-foreground/85 hover:bg-white/8",
                  )}
                >
                  كل الأحياء
                </button>
                {neighborhoodOptions
                  .filter((n) => !nbhQuery.trim() || n.includes(nbhQuery.trim()))
                  .map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNbhFilter(nbhFilter === n ? "" : n)}
                      className={cn(
                        "flex w-full items-center justify-between gap-1 rounded-lg px-2 py-1.5 text-right text-[11px] transition",
                        nbhFilter === n ? "bg-primary/15 font-bold text-primary ring-1 ring-inset ring-primary/35" : "text-foreground/85 hover:bg-white/8",
                      )}
                    >
                      <span className="truncate" title={n}>{n}</span>
                      {nbhFilter === n ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_6px_1px_rgba(148,175,209,0.9)]" /> : null}
                    </button>
                  ))}
                {neighborhoodOptions.length === 0 ? (
                  <p className="px-2 py-2 text-[10px] text-muted-foreground">لا أحياء معرّفة بعد — تُضاف من نوافذ القطع</p>
                ) : neighborhoodOptions.filter((n) => !nbhQuery.trim() || n.includes(nbhQuery.trim())).length === 0 ? (
                  <p className="px-2 py-2 text-[10px] text-muted-foreground">لا تطابق</p>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* استوديو الرسم (م7.1/7.6) — للمدير فقط (الرسم محظور على المستخدم الثاني · م8.1) */}
        {!isViewer ? (
          <DrawDock
            open={drawOpen}
            onToggle={() =>
              setDrawOpen((v) => {
                const next = !v;
                if (next) setShowLayers(false); // فتح الاستوديو يطوي لوحة الطبقات
                return next;
              })
            }
            mode={drawMode}
            onMode={enterDrawMode}
            liveAreaM2={drawMode !== "off" ? liveArea : null}
            onCancel={exitDraw}
          />
        ) : null}
      </div>

      {/* م8.8.2/م8.12.1 · نبضة الموقع — جبهة موجية سونار تحت الدبابيس (z-9 < deck): الحجم مرن مع الزوم.
          في 3D تنبسط الحلقات على الأرض (rotateX = ميل الكاميرا · perspective بمركز الشاشة = نقطة الكاميرا الرئيسة)
          فتبدو كأنها جزء من الرسمة لا حلقات عمودية عائمة؛ في 2D (ميل 0) = دوائر كما هي (rotateX(0) محايد). */}
      {!tourActive && pinPings.length ? (
        <div ref={pingLayerRef} className="pointer-events-none absolute inset-0 z-[9] overflow-hidden" style={{ perspective: `${pingTilt.persp}px` }}>
          {pinPings.map((p) => (
            <span key={p.key} ref={positionPingEl} data-lng={p.lng} data-lat={p.lat} className="absolute left-0 top-0" style={{ color: p.color, transformOrigin: "0 0", willChange: "transform" }}>
              <span className="pin-ping pin-ping--l1" />
              <span className="pin-ping pin-ping--l2" />
              <span className="pin-ping pin-ping--l3" />
              <span className="pin-ping pin-ping--l4" />
              <span className="pin-ping pin-ping--l5" />
            </span>
          ))}
        </div>
      ) : null}

      {/* م8.10 (مُحدَّث) · تسميات الدبابيس (§هـ.4) — تبدأ عند ~5كم: بطاقة **شفافة صغيرة فوق رأس الدبوس**،
          تظهر بحركة سلسة (CSS) وتتبع الدبوس حيّاً، وتتلاشى عند الإبعاد عبر labelOpacity. */}
      {!tourActive && pinLabels.length ? (
        <div className="pointer-events-none absolute inset-0 z-[12] overflow-hidden" style={{ opacity: labelOpacity }}>
          {pinLabels.map((l) => (
            <span key={l.key} className="absolute" style={{ left: l.x, top: l.y - 54, transform: "translate(-50%, -100%)" }}>
              <span
                className="pin-label-in block max-w-[110px] truncate rounded-full border border-[rgba(159,192,232,0.3)] bg-[hsl(221_42%_11%/0.42)] px-1.5 py-0.5 text-center text-[8.5px] font-semibold leading-tight text-[#e6eefb] shadow-[0_3px_10px_-4px_rgba(0,0,0,0.6)] backdrop-blur-md"
                title={l.name}
              >
                {l.name}
              </span>
            </span>
          ))}
        </div>
      ) : null}

      {/* الجارت الهولوكرامي (م7.6) — ينزاح بأناقة عند انشغال الأدوات العائمة (طبقات/رسم) فلا تداخل */}
      <HoloStatsChart hidden={showLayers || drawOpen || drawMode !== "off" || tourActive} />

      {/* حوار «رسم بأبعاد» — بعد نقر الموقع */}
      {dimAnchor ? <DimensionDialog onSubmit={onDimensionSubmit} onClose={() => setDimAnchor(null)} /> : null}

      {/* شارة القطعة (م7.6) — تنبثق بجانب القطعة المنقورة بخط رشيق يتبعها مع الزوم/التنقّل */}
      <AnimatePresence>
        {selectedProps && calloutPx && drawMode === "off" && !tourActive ? (
          <SelectedParcelCard
            key={selectedProps.ref_id}
            props={selectedProps}
            info={selectedInfo}
            anchor={{ x: calloutPx.x, y: calloutPx.y }}
            container={{ w: calloutPx.w, h: calloutPx.h }}
            onView={() => {
              // مطابق حرفياً لزرّ «عرض» في بطاقة إشارة الخريطة (نافذة القطعة الموحَّدة الكاملة)
              if (!selectedProps.entity_id) {
                toast.error("لا كيان بياني مرتبط بهذه الرسمة بعد", { description: "اربطها من بطاقة قسمها أو احذف الرسمة" });
                return;
              }
              requestOpenParcelDetail({ kind: (selectedProps.kind as ParcelKind) || "assumed", id: selectedProps.entity_id });
              setSelectedId(null);
            }}
            onEditGeometry={onCardEditGeometry}
            onDeleteGeometry={() => void onCardDeleteGeometry()}
            onClose={() => setSelectedId(null)}
          />
        ) : null}
      </AnimatePresence>

      {/* م9.13 · بطاقة المجسّم الهولوغراميّة — تنبثق فوق المجسّم بعد استقرار الكاميرا (نهاية مدار الدرون)، وتتبعه حيّاً */}
      <AnimatePresence>
        {settledModelData && drawMode === "off" && (!tourActive || cinematicActive) ? (
          <HoloModelCards
            key={settledModelData.props.ref_id}
            props={settledModelData.props}
            info={settledModelData.info}
            controls={settledModelData.controls}
            matrixRef={holoMatrixRef}
            onDismiss={() => setSettledModelId(null)}
            onNarrationComplete={handleCardsNarrated}
          />
        ) : null}
      </AnimatePresence>

      {/* بطاقة إشارة القطعة (م7.8) — هولوكرامية بخط ربط، فوق كل الإشارات، تتبع الإشارة حيّاً */}
      <AnimatePresence>
        {mkSel && mkPx && drawMode === "off" && !tourActive ? (
          <MarkerCallout
            key={mkSel.refId}
            label={mkSel.label}
            anchor={{ x: mkPx.x, y: mkPx.y }}
            container={{ w: mkPx.w, h: mkPx.h }}
            onView={() => {
              if (!mkSel.entityId) {
                toast.error("لا كيان بياني مرتبط بهذه الرسمة بعد", { description: "اربطها من بطاقة قسمها أو احذف الرسمة من شارة القطعة" });
                return;
              }
              requestOpenParcelDetail({ kind: mkSel.kind, id: mkSel.entityId });
              setMkSel(null);
            }}
            onLocate={() => {
              requestFlyTo(mkSel.refId);
              setMkSel(null);
            }}
            onClose={() => setMkSel(null)}
          />
        ) : null}
      </AnimatePresence>

      {/* شريط حفظ تحرير الحدود (م7.6) — وسط أسفل الخريطة، بمتناول المستخدم */}
      <AnimatePresence>
        {editing ? (
          <motion.div
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 28, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="pointer-events-none absolute inset-x-0 bottom-7 z-20 flex justify-center max-md:bottom-[calc(var(--sab)+5rem)]"
          >
            <div className={cn("pointer-events-auto flex items-center gap-2 rounded-2xl px-3 py-2", GLASS)}>
              <span className="max-w-44 truncate text-[11px] text-muted-foreground" title={editing.label}>
                تحرير حدود: <b className="text-foreground/90">{editing.label}</b>
              </span>
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => void saveEdit()}
                className="flex h-10 items-center gap-1.5 rounded-xl bg-state-completed/20 px-4 text-xs font-bold text-state-completed ring-1 ring-inset ring-state-completed/50 transition hover:bg-state-completed/30 hover:shadow-[0_0_18px_-6px_rgba(94,151,122,0.9)] active:scale-95 disabled:opacity-50"
              >
                {savingEdit ? "يحفظ…" : "حفظ الحدود"}
              </button>
              <button
                type="button"
                onClick={exitDraw}
                className="flex h-10 items-center rounded-xl bg-secondary/50 px-3 text-xs font-semibold ring-1 ring-inset ring-border/50 transition hover:bg-accent active:scale-95"
              >
                إلغاء
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* حوارا التسميات المحرَّرة (م7.3) */}
      {annAnchor ? (
        <AnnotateCreateDialog
          saving={annSaving}
          onPoint={(n, t) => void onAnnotatePoint(n, t)}
          onArea={onAnnotateArea}
          onClose={() => setAnnAnchor(null)}
        />
      ) : null}
      {annEdit ? (
        <AnnotateEditDialog
          initialName={annEdit.name}
          initialType={annEdit.type}
          saving={annSaving}
          onSave={(n, t) => void onAnnotateSave(n, t)}
          onDelete={() => void onAnnotateDelete()}
          onClose={() => setAnnEdit(null)}
        />
      ) : null}
    </div>
  );
}
