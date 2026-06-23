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
import { ChevronDown, FilterX, Layers, MapPinned, Maximize2, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BASES,
  BOUNDARY_COLORS,
  DEFAULT_BASE,
  DIM_COLOR,
  INITIAL_ZOOM,
  MAP_CENTER,
  MAX_BOUNDS_PADDING_DEG,
  MAX_ZOOM,
  NAVY,
  styleUrl,
  type BaseStyle,
} from "../lib/map-config";
import { MapboxOverlay } from "@deck.gl/mapbox";
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
import { isSfxMuted, setSfxMuted, sfxFly } from "@/lib/sfx";
import { createMapElement, deleteMapElement, renameMapElement } from "../lib/annotation-actions";
import { DrawDock, type DrawModeId } from "./draw-dock";
import { DimensionDialog, type DimShape } from "./dimension-dialog";
import { AnnotateCreateDialog, AnnotateEditDialog } from "./annotate-dialogs";
import { SelectedParcelCard, type SelectedEntityInfo } from "./selected-parcel-card";
import { MarkerCallout } from "./marker-callout";
import { HoloStatsChart } from "./holo-stats-chart";
import { useEscClose } from "@/components/ui/use-esc-close";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { inferName } from "../lib/spatial-inference";
import { onFlyTo, onFlyToCoords, onResetView, onStartDraw, onZoom, type ParcelKind, requestFlyTo, requestOpenParcelDetail, requestOpenParcelForm } from "../lib/map-nav-store";
import type { DrawTarget } from "../lib/map-nav-store";
import { setMapBase } from "../lib/map-base-store";
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
function parcelLayers(fc: FeatureCollection, selectedId: string | null) {
  const stateOf = (f: Feature): string | undefined => (typeof f.properties?.state === "string" ? f.properties.state : undefined);
  const refOf = (f: Feature): string | undefined => (typeof f.properties?.ref_id === "string" ? f.properties.ref_id : undefined);
  const sel = (f: Feature): boolean => selectedId !== null && refOf(f) === selectedId;
  const dim = (f: Feature): boolean => selectedId !== null && refOf(f) !== selectedId;
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
        // المحدّد يمتلئ بلون/شدّة الحدّ (≈235) — مع توهّج هولوكرامي من طبقة الهالة.
        const [r, g, b] = fillRgba(stateOf(f));
        return [r, g, b, alpha(64, 232, f)];
      },
      getLineColor: (f: Feature) => {
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
  // م9.3 · مجسّم تصوّري هولوكرامي (كتلة مستخرَجة من حدود القطعة) للقطعة المفترضة المحدّدة —
  // بديل بلا قاعدة، يُستبدَل بنموذج glb المرفوع لاحقاً (م9.3ب). إصدار/تعبئة منبعثة + إطار سلكي = هولوكرام.
  const selFeat = selectedId !== null ? fc.features.find((f) => refOf(f) === selectedId) : undefined;
  if (selFeat?.geometry && selFeat.properties?.kind === "assumed") {
    const [r, g, b] = lineRgba("assumed");
    layers.push(
      new GeoJsonLayer({
        id: "parcel-massing",
        data: { type: "FeatureCollection", features: [selFeat] } as FeatureCollection,
        extruded: true,
        filled: true,
        stroked: false,
        wireframe: true,
        material: false, // مسطّح منبعث (بلا تظليل) → توهّج هولوكرامي موحّد
        getElevation: 60, // متر — ارتفاع تصوّري مبدئي (مؤشَّر «تصوّر تصميمي»)
        getFillColor: [r, g, b, 70],
        getLineColor: [r, g, b, 230],
        getLineWidth: 1.5,
        lineWidthUnits: "pixels",
        updateTriggers: { getFillColor: selectedId, getLineColor: selectedId },
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

/**
 * يبني كائن النمط كاملاً: قاعدة MapTiler (عبر الوسيط، بلا تخزين، عناوين مطلقة)
 * + تعريب + ضبط كحلي + طبقاتنا (الحدود والقناع) — فتظهر من أوّل إطار وعند كل تبديل.
 */
async function buildStyle(base: BaseStyle, data: MapData): Promise<StyleSpecification> {
  const res = await fetch(styleUrl(base), { cache: "no-store" });
  if (!res.ok) throw new Error(`تعذّر جلب نمط القاعدة (${res.status})`); // switchBase يلتقطه ويعرض تنبيهاً (§ز)
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
  const [map3D, setMap3D] = useState(true); // م8.12 · عرض الخريطة 3D/2D (الافتراضي 3D)
  const overlayRef = useRef<MapboxOverlay | null>(null);
  // نافذة إشارة القطعة (م7.8): بطاقة هولوكرامية بخط ربط تتبع الإشارة حيّاً — بدل Popup (كانت تختفي خلف طبقة الإشارات)
  const [mkSel, setMkSel] = useState<{ refId: string; label: string | null; kind: ParcelKind; entityId: string; lngLat: [number, number] } | null>(null);
  const [mkPx, setMkPx] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const { fc } = useMapParcels();
  const fcRef = useRef<FeatureCollection>(fc);
  fcRef.current = fc;
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
  const [pinPings, setPinPings] = useState<{ x: number; y: number; key: string; color: string }[]>([]); // م8.8 · نبضات الموقع
  const [pingScale, setPingScale] = useState(1); // م8.8.2 · حجم النبضة المرن مع الزوم (يصغر عند الإبعاد لتفادي التداخل)
  const [pingTilt, setPingTilt] = useState({ deg: 48, persp: 1200 }); // م8.12.1 · ميل حلقات النبضة لتنبسط على الأرض في 3D (rotateX = ميل الكاميرا · perspective ≈ مسافة الكاميرا)
  const [altM, setAltM] = useState(0); // م8.8 · ارتفاع الكاميرا الفعلي (متر) من MapLibre — مؤشّر الارتفاع الجوي
  const [mapReady, setMapReady] = useState(false);
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
        maplibregl.setRTLTextPlugin("/vendor/mapbox-gl-rtl-text.js", true);
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

      const style = await buildStyle(DEFAULT_BASE, data);
      if (cancelled || !containerRef.current) return;

      map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: MAP_CENTER,
        zoom: INITIAL_ZOOM,
        maxZoom: MAX_ZOOM,
        pitch: 48, // م8.12 · العرض الافتراضي ثلاثي الأبعاد (3D) — قابل للتبديل لـ2D (fitBounds/flyTo تحفظ الميل)
        attributionControl: false, // م8.8: لا زرّ «!» منبثق
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      // م8.8: النسب القانوني مفتوحاً دائماً بلا زرّ تبديل «!» (صون ترخيص MapTiler/OSM)
      map.addControl(new maplibregl.AttributionControl({ compact: false }), "bottom-left");

      // §ز.5 · فشل الخريطة (الشبكة): تنبيه مخفَّف (مرّة/60 ثانية) — البيانات والأقسام تبقى متاحة من السايدبار
      let lastMapErrorAt = 0;
      map.on("error", (e) => {
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
        const overlay = new MapboxOverlay({ interleaved: false, layers: parcelLayers(fcRef.current, selectedIdRef.current) });
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
          setSelectedId(typeof ref === "string" ? ref : null);
          setMkSel(null);
        });

        // استوديو الرسم (terra-draw · م7.1): مضلّع · مستطيل · دائرة · تحرير (select) — بنمط بنفسجي موحّد
        const SHAPE_STYLE = {
          fillColor: "#8B6FB0",
          fillOpacity: 0.25,
          outlineColor: "#8B6FB0",
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
    overlayRef.current?.setProps({ layers: vis ? parcelLayers(vis, selectedId) : [] });
  }, [fc, selectedId, showParcels, hiddenStates, nbhFilter, editing]);

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
      const m = mapRef.current;
      const f = fcRef.current.features.find(
        (ft) =>
          ft.properties?.ref_id === refId ||
          (refId !== "" && (ft.properties?.entity_id === refId || ft.properties?.parcel_no === refId)),
      );
      if (m && f?.geometry) {
        sfxFly(); // أثر طيران تقني ناعم (م7.9)
        const b = bbox(f) as [number, number, number, number];
        m.fitBounds(b, { padding: framePadding(80, true), maxZoom: 16, duration: 1000 }); // م8.10: تجاهل ارتفاع الورقة (تُغلق مع الطيران) فلا يفشل التأطير
        // ملاحظة: لا تنبثق بطاقة الصور تلقائياً عند الطيران — انبثاقها حصراً عند النقر على رسمة القطعة (طلب معتمد).
        // م9.3 · الطيران لقطعة مفترضة (نطاق «الخارطة الاستثمارية») يحدّدها فيُظهر مجسّمها التصوّري — بدائية تركيز يحتاجها التجوّل التلقائي (م9.5).
        if (f.properties?.kind === "assumed") {
          const r = f.properties?.ref_id;
          setSelectedId(typeof r === "string" ? r : null);
          setMkSel(null);
        }
      } else {
        toast.info("لا حدود مرسومة لهذه القطعة بعد — ارسمها واربطها");
      }
    });
  }, []);

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
    return onResetView(() => resetView());
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

  async function switchBase(next: BaseStyle): Promise<void> {
    const map = mapRef.current;
    const data = dataRef.current;
    if (!map || !data || next === baseRef.current) return;
    const prev = baseRef.current;
    baseRef.current = next;
    setBase(next);
    setMapBase(next); // م8.10 · أبلغ مؤشّرات KPI بتغيّر القاعدة (قرص كحلي فوق الخريطة الفاتحة)
    let style: StyleSpecification;
    try {
      style = await buildStyle(next, data);
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
    const PING_HEX: Record<string, string> = { announced: "#C7A24E", "in-progress": "#5775A8", completed: "#5E977A", withdrawn: "#B5616A", assumed: "#8B6FB0" };
    let raf = 0;
    // مرور واحد على القطع: نبضات الموقع (كل مستويات الزوم) + تسميات الدبابيس (عند الاقتراب op>0) — تفادياً لمرورين.
    const compute = (): void => {
      raf = 0;
      const mm = mapRef.current;
      if (!mm) return;
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
      const hidden = hiddenStatesRef.current;
      const wantLabels = op > 0.01; // التسميات عند الاقتراب فقط؛ النبضات على كل مستويات الزوم
      const pings: { x: number; y: number; key: string; color: string; d: number }[] = [];
      const cand: { x: number; y: number; name: string; key: string; d: number }[] = [];
      for (const f of fcRef.current.features) {
        if (!f.geometry) continue;
        const p = f.properties ?? {};
        const st = String(p.state ?? "");
        if (hidden.has(st)) continue;
        if (nbhFilterRef.current && p.neighborhood !== nbhFilterRef.current) continue; // احترم فلتر الحي
        if (editingRef.current && p.ref_id === editingRef.current.refId) continue; // القطعة قيد التحرير لا نبضة/تسمية لها
        const c = centroid(f as Feature).geometry.coordinates as [number, number];
        const pt = mm.project(c);
        if (pt.x < -30 || pt.x > W + 30 || pt.y < -30 || pt.y > Ht + 30) continue;
        const d = Math.hypot(pt.x - cx, pt.y - cy);
        pings.push({ x: pt.x, y: pt.y, key: String(p.ref_id ?? `${Math.round(pt.x)},${Math.round(pt.y)}`), color: PING_HEX[st] ?? "#9fc0e8", d });
        if (wantLabels) {
          const name = typeof p.label === "string" && p.label ? p.label : typeof p.parcel_no === "string" ? p.parcel_no : "";
          if (name) cand.push({ x: pt.x, y: pt.y, name, key: String(p.ref_id ?? name), d });
        }
      }
      pings.sort((a, b) => a.d - b.d);
      setPinPings(pings.slice(0, PING_CAP).map((r) => ({ x: r.x, y: r.y, key: r.key, color: r.color })));
      // م8.8.2 · حجم النبضة مرن مع الزوم: الحجم الكامل عند التقريب (تتباعد القطع فلا تتداخل الحلقات)،
      // ويصغر تدريجياً عند الإبعاد (زوم-آوت) حيث تتقارب القطع — لعرض أنيق بلا تداخل. (smoothstep بين عتبتَي الزوم.)
      const zt = Math.max(0, Math.min(1, (mm.getZoom() - PING_Z_OUT) / (PING_Z_IN - PING_Z_OUT)));
      const ps = +(PING_S_MIN + (1 - PING_S_MIN) * (zt * zt * (3 - 2 * zt))).toFixed(3);
      setPingScale((prev) => (prev === ps ? prev : ps));
      // م8.12.1 · ميل الحلقات لتنبسط على الأرض في 3D: rotateX = ميل الكاميرا الحالي (الحلقات دوائر فالاتجاه/البيرنغ لا يؤثّر)،
      // وperspective ≈ مسافة الكاميرا بالبكسل ((0.5/tan(fov/2))·الارتفاع) فيطابق منظور الخريطة — يتحدّث حيّاً مع easeTo الميل.
      const tiltDeg = Math.round(mm.getPitch() * 10) / 10;
      const persp = Math.max(600, Math.round((0.5 / Math.tan(0.6435011087932844 / 2)) * Ht));
      setPingTilt((prev) => (prev.deg === tiltDeg && prev.persp === persp ? prev : { deg: tiltDeg, persp }));
      cand.sort((a, b) => a.d - b.d); // الأقرب لمركز الشاشة أولاً
      setPinLabels(wantLabels ? cand.slice(0, CAP).map((r) => ({ x: r.x, y: r.y, name: r.name, key: r.key })) : []);
    };
    const onMove = (): void => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    m.on("move", onMove);
    m.on("zoom", onMove);
    compute();
    return () => {
      m.off("move", onMove);
      m.off("zoom", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
    // fc ضمن التبعيات: يُعيد الحساب عند تحميل/تغيّر القطع دون انتظار حركة المستخدم (مهمّ للنبضات في العرض الساكن)
  }, [mapReady, fc]);

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

      {/* م8.8 · مؤشّر «مسافة الارتفاع الجوي عن الخريطة» — رقم ثلاثي الأبعاد عائم أسفل-يمين يتحدّث لحظياً */}
      <div className="pointer-events-none absolute bottom-[calc(var(--sab)+5.5rem)] left-3 z-[13] flex flex-col items-start gap-0.5 rounded-2xl border border-[rgba(159,192,232,0.45)] bg-[linear-gradient(160deg,hsl(221_40%_17%/0.95),hsl(221_44%_9%/0.95))] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_14px_34px_-12px_rgba(0,0,0,0.9),0_0_24px_-8px_rgba(148,175,209,0.6)] backdrop-blur-md md:bottom-[8.75rem] md:left-auto md:right-3 md:items-end lg:right-[6.5rem]">
        <span className="text-[9px] font-semibold leading-none text-foreground/70">الارتفاع الجوي</span>
        <span dir="ltr" className="bg-gradient-to-b from-white via-[#e3edfb] to-[#9fc0e8] bg-clip-text text-lg font-extrabold tabular-nums leading-none tracking-tight text-transparent drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
          {altText}
        </span>
      </div>

      {/* عمود الأدوات العائمة: القاعدة · العودة · الطبقات ← ثم استوديو الرسم — فوق الجارت دائماً (z-20).
          م8.7: على lg تُزاح يسار الدوك العائم (end-[6.5rem]) كي لا تتداخل معه على الخريطة الكاملة. */}
      <div className="absolute end-3 top-16 z-20 flex flex-col items-end gap-2 lg:end-[6.5rem]">
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
      {pinPings.length ? (
        <div className="pointer-events-none absolute inset-0 z-[9] overflow-hidden" style={{ perspective: `${pingTilt.persp}px` }}>
          {pinPings.map((p) => (
            <span key={p.key} className="absolute" style={{ left: p.x, top: p.y, color: p.color, transform: `rotateX(${pingTilt.deg}deg) scale(${pingScale})`, transformOrigin: "0 0" }}>
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
      {pinLabels.length ? (
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
      <HoloStatsChart hidden={showLayers || drawOpen || drawMode !== "off"} />

      {/* حوار «رسم بأبعاد» — بعد نقر الموقع */}
      {dimAnchor ? <DimensionDialog onSubmit={onDimensionSubmit} onClose={() => setDimAnchor(null)} /> : null}

      {/* شارة القطعة (م7.6) — تنبثق بجانب القطعة المنقورة بخط رشيق يتبعها مع الزوم/التنقّل */}
      <AnimatePresence>
        {selectedProps && calloutPx && drawMode === "off" ? (
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

      {/* بطاقة إشارة القطعة (م7.8) — هولوكرامية بخط ربط، فوق كل الإشارات، تتبع الإشارة حيّاً */}
      <AnimatePresence>
        {mkSel && mkPx && drawMode === "off" ? (
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
