"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import bbox from "@turf/bbox";
import mask from "@turf/mask";
import centroid from "@turf/centroid";
import type { GeoJSONSource, Map as GLMap, Popup, StyleSpecification } from "maplibre-gl";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { Maximize2, PenTool } from "lucide-react";
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
import { useMapParcels } from "../lib/use-map-parcels";
import { fillRgba, glowRgba, lineRgba } from "../lib/parcel-colors";
import { getPinIcons } from "../lib/parcel-markers";
import { TerraDraw, TerraDrawPolygonMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { inferName } from "../lib/spatial-inference";
import { onFlyTo, onFlyToCoords, onStartDraw, type ParcelKind, requestFlyTo, requestOpenParcelDetail, requestOpenParcelForm } from "../lib/map-nav-store";
import type { DrawTarget } from "../lib/map-nav-store";
import { useTable } from "@/lib/data/use-table";
import type { AssumedParcel, License, Opportunity } from "@/types/entities";

type MapData = {
  gov: FeatureCollection;
  districts: FeatureCollection;
  subdistricts: FeatureCollection;
  maskFC: Feature<Polygon | MultiPolygon>;
  bounds: [number, number, number, number];
};

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
  for (const layer of style.layers ?? []) {
    if (layer.type === "symbol" && layer.layout && "text-field" in layer.layout) {
      layer.layout["text-field"] = ARABIC_LABEL;
    }
    if (base === "dark") {
      if (layer.id === "background") layer.paint = { ...layer.paint, "background-color": NAVY.background };
      if (layer.id === "water") layer.paint = { ...layer.paint, "fill-color": NAVY.water };
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

// مربّعات إظهار القطع حسب الحالة (§هـ.4): قيمة الحالة ← {تسمية · لون accent}.
const STATE_TOGGLES = [
  { value: "announced", label: "معلَنة", accent: "accent-state-announced" },
  { value: "in-progress", label: "قيد الإنجاز", accent: "accent-state-inprogress" },
  { value: "completed", label: "منجزة", accent: "accent-state-completed" },
  { value: "withdrawn", label: "مسحوبة", accent: "accent-state-withdrawn" },
  { value: "assumed", label: "مفترضة", accent: "accent-state-assumed" },
] as const;

export default function InvestmentMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GLMap | null>(null);
  const dataRef = useRef<MapData | null>(null);
  const baseRef = useRef<BaseStyle>(DEFAULT_BASE);
  const [base, setBase] = useState<BaseStyle>(DEFAULT_BASE);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const { fc } = useMapParcels();
  const fcRef = useRef<FeatureCollection>(fc);
  fcRef.current = fc;
  const drawRef = useRef<TerraDraw | null>(null);
  const linkTargetRef = useRef<DrawTarget | null>(null);
  const [drawing, setDrawing] = useState(false);
  const queryClient = useQueryClient();
  const qcRef = useRef(queryClient);
  qcRef.current = queryClient;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(selectedId);
  selectedIdRef.current = selectedId;
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [showParcels, setShowParcels] = useState(true);
  const [hiddenStates, setHiddenStates] = useState<Set<string>>(() => new Set());
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
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

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
        // نقر إشارة القطعة ← نافذة منبثقة (موقع/عرض)؛ نقر قطعة ← تحديدها؛ نقر فراغ ← إلغاء
        m.on("click", (e) => {
          const ov = overlayRef.current;
          if (!ov) return;
          const mk = ov.pickObject({ x: e.point.x, y: e.point.y, radius: 10, layerIds: ["parcel-markers"] });
          const mkObj = mk?.object as
            | { ref_id?: string; position?: [number, number]; label?: string; kind?: string; entity_id?: string }
            | undefined;
          if (mkObj?.ref_id) {
            const refId = mkObj.ref_id;
            popupRef.current?.remove();
            // بطاقة عمودية أنيقة بهوية النظام: العنوان أعلى، ثم «عرض» ثم «الموقع»
            const el = document.createElement("div");
            el.style.fontFamily = "var(--font-readex), system-ui, sans-serif";
            el.className =
              "flex w-48 flex-col gap-2 rounded-2xl border border-border/70 bg-gradient-to-b from-card to-card/90 p-2.5 text-foreground shadow-2xl shadow-primary/25 ring-1 ring-inset ring-foreground/10 backdrop-blur-md";
            const titleEl = document.createElement("div");
            titleEl.className = "truncate border-b border-border/60 px-1 pb-2 text-center text-[13px] font-bold tracking-tight text-foreground";
            titleEl.textContent = mkObj.label || "قطعة";
            titleEl.title = mkObj.label ?? "";
            el.appendChild(titleEl);
            const EYE =
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/></svg>';
            const NAV =
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>';
            const mkBtn = (text: string, icon: string, cls: string, fn: () => void): HTMLButtonElement => {
              const b = document.createElement("button");
              b.type = "button";
              b.className =
                "flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition active:scale-95 " + cls;
              b.innerHTML = icon + "<span>" + text + "</span>";
              b.addEventListener("click", () => {
                fn();
                popupRef.current?.remove();
              });
              return b;
            };
            el.appendChild(
              mkBtn("عرض", EYE, "bg-primary/15 text-primary ring-1 ring-inset ring-primary/30 hover:bg-primary/25", () =>
                requestOpenParcelDetail({ kind: (mkObj.kind as ParcelKind) || "assumed", id: mkObj.entity_id || "" }),
              ),
            );
            el.appendChild(
              mkBtn("الموقع", NAV, "bg-secondary/60 text-foreground ring-1 ring-inset ring-border/50 hover:bg-accent", () => requestFlyTo(refId)),
            );
            // تنبثق بجانب القرص (يمين/يسار حسب الموضع) فلا تتداخل
            const onRight = e.point.x > m.getContainer().clientWidth / 2;
            popupRef.current = new maplibregl.Popup({
              className: "parcel-popup",
              closeButton: false,
              anchor: onRight ? "right" : "left",
              offset: onRight ? [-18, -42] : [18, -42],
              maxWidth: "none",
            })
              .setLngLat(mkObj.position ?? e.lngLat)
              .setDOMContent(el)
              .addTo(m);
            return;
          }
          const info = ov.pickObject({ x: e.point.x, y: e.point.y, radius: 5, layerIds: ["parcels"] });
          const ref = info?.object?.properties?.ref_id;
          setSelectedId(typeof ref === "string" ? ref : null);
          popupRef.current?.remove();
        });

        // أداة الرسم (terra-draw) — قطعة مفترضة + استنتاج مكاني
        const draw = new TerraDraw({
          adapter: new TerraDrawMapLibreGLAdapter({ map: m }),
          modes: [
            new TerraDrawPolygonMode({
              styles: {
                fillColor: "#8B6FB0",
                fillOpacity: 0.25,
                outlineColor: "#8B6FB0",
                outlineWidth: 2,
                closingPointColor: "#C7A24E",
                closingPointWidth: 5,
              },
            }),
          ],
        });
        draw.start();
        draw.on("finish", (id) => {
          const d = drawRef.current;
          const data = dataRef.current;
          if (!d || !data) return;
          const feat = d.getSnapshot().find((f) => f.id === id);
          if (!feat || feat.geometry?.type !== "Polygon") return;
          const polygon = feat as unknown as Feature<Polygon>;
          const target = linkTargetRef.current;
          linkTargetRef.current = null;
          void (async () => {
            const supabase = createClient();
            let createdId: string | null = null;
            let failed = false;
            if (target) {
              // ربط الهندسة بقطعة موجودة (فرصة/رخصة)
              const { error } = await supabase.rpc("create_parcel_geometry", {
                p_geom: polygon.geometry,
                p_parcel_no: target.parcel_no,
                p_muqataa_no: target.muqataa_no,
              });
              failed = Boolean(error);
            } else {
              // قطعة مفترضة جديدة + استنتاج مكاني
              const district = inferName(polygon, data.districts);
              const subdistrict = inferName(polygon, data.subdistricts);
              const { data: newId, error } = await supabase.rpc("create_assumed_parcel", {
                p_geom: polygon.geometry,
                p_district: district,
                p_subdistrict: subdistrict,
              });
              failed = Boolean(error);
              if (typeof newId === "string") createdId = newId;
            }
            d.clear();
            d.setMode("static");
            setDrawing(false);
            if (failed) {
              toast.error("تعذّر حفظ الحدود");
              return;
            }
            toast.success(target ? `رُبطت الحدود بـ${target.label ?? "القطعة"}` : "أُنشئت قطعة مفترضة");
            void qcRef.current.invalidateQueries({ queryKey: ["map_parcels"] });
            void qcRef.current.invalidateQueries({ queryKey: ["table", "assumed_parcels"] });
            void qcRef.current.invalidateQueries({ queryKey: ["table", "parcel_geometry"] });
            void qcRef.current.invalidateQueries({ queryKey: ["counts"] });
            // قطعة مفترضة جديدة ← انبثاق نموذج بياناتها (اسم + باقي الحقول)
            if (createdId) requestOpenParcelForm(createdId);
          })();
        });
        drawRef.current = draw;

        // مقاييس م2.3 + إظهار الحدود (بعد جهوز المصادر)
        applyStats(m, dataRef.current, oppsRef.current, licsRef.current, assumedRef.current);
        applyVisibility(m, showBoundariesRef.current);

        m.fitBounds(bounds, { padding: 48, duration: 2200 }); // دخول متسارع
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
      popupRef.current?.remove();
      popupRef.current = null;
      map?.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  // تحديث طبقات القطع عند تغيّر البيانات/التحديد/الإظهار/الحالات (انعكاس لحظي)
  useEffect(() => {
    const vis = showParcels
      ? { ...fc, features: fc.features.filter((f) => !hiddenStates.has(String(f.properties?.state ?? ""))) }
      : null;
    overlayRef.current?.setProps({ layers: vis ? parcelLayers(vis, selectedId) : [] });
  }, [fc, selectedId, showParcels, hiddenStates]);

  // مقاييس م2.3: إعادة العدّ والحقن عند تغيّر القطع
  useEffect(() => {
    applyStats(mapRef.current, dataRef.current, opps.data ?? [], lics.data ?? [], assumed.data ?? []);
  }, [opps.data, lics.data, assumed.data]);

  // إظهار/إخفاء طبقة الحدود
  useEffect(() => {
    applyVisibility(mapRef.current, showBoundaries);
  }, [showBoundaries]);

  // الانتقال لقطعة من السايدبار (§هـ.2): flyTo + تحديد — بالمعرّف أو رقم القطعة
  useEffect(() => {
    return onFlyTo((refId) => {
      const m = mapRef.current;
      const f = fcRef.current.features.find(
        (ft) => ft.properties?.ref_id === refId || (refId !== "" && ft.properties?.parcel_no === refId),
      );
      if (m && f?.geometry) {
        const ref = f.properties?.ref_id;
        setSelectedId(typeof ref === "string" ? ref : null);
        const b = bbox(f) as [number, number, number, number];
        m.fitBounds(b, { padding: 80, maxZoom: 16, duration: 1000 });
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
      m.flyTo({ center: [lng, lat], zoom: 14, duration: 1400 });
      if (label) toast.info(label);
    });
  }, []);

  // بدء رسم وربط هندسة بقطعة موجودة (من بطاقة فرصة/رخصة)
  useEffect(() => {
    return onStartDraw((target) => {
      linkTargetRef.current = target;
      const d = drawRef.current;
      if (d) {
        d.setMode("polygon");
        setDrawing(true);
      }
    });
  }, []);

  async function switchBase(next: BaseStyle): Promise<void> {
    const map = mapRef.current;
    const data = dataRef.current;
    if (!map || !data || next === baseRef.current) return;
    baseRef.current = next;
    setBase(next);
    map.setStyle(await buildStyle(next, data)); // النمط الجديد يحوي طبقاتنا → فوري
    map.once("idle", () => {
      applyStats(mapRef.current, dataRef.current, oppsRef.current, licsRef.current, assumedRef.current);
      applyVisibility(mapRef.current, showBoundariesRef.current);
    });
  }

  function resetView(): void {
    const map = mapRef.current;
    const data = dataRef.current;
    if (!map || !data) return;
    map.fitBounds(data.bounds, { padding: 48, duration: 1200 });
  }

  function toggleDraw(): void {
    const draw = drawRef.current;
    if (!draw) return;
    try {
      if (drawing) {
        draw.setMode("static");
        draw.clear();
        linkTargetRef.current = null;
        setDrawing(false);
      } else {
        linkTargetRef.current = null; // رسم قطعة مفترضة جديدة (بلا ربط)
        draw.setMode("polygon");
        setDrawing(true);
      }
    } catch {
      // terra-draw قد تفقد طبقاتها بعد إعادة تحميل النمط/HMR — تجاهل بهدوء وأعد الضبط
      linkTargetRef.current = null;
      setDrawing(false);
    }
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* مبدّل القاعدة (§هـ.4) */}
      <div className="absolute end-3 top-16 z-10 flex gap-1 rounded-md border border-border bg-card/85 p-1 backdrop-blur">
        {BASES.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => void switchBase(b.id)}
            className={cn(
              "rounded px-2 py-1 text-xs transition",
              base === b.id ? "bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* العودة لكامل نينوى (§هـ.4) — يسار الخريطة، تحت مبدّل القاعدة */}
      <button
        type="button"
        onClick={resetView}
        title="إعادة العرض إلى كامل نينوى"
        className="absolute end-3 top-28 z-10 inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/85 px-2.5 py-1.5 text-xs font-medium text-foreground/90 shadow-[0_0_18px_-6px_rgba(148,175,209,0.55)] ring-1 ring-inset ring-foreground/5 backdrop-blur transition hover:bg-accent hover:text-foreground"
      >
        <Maximize2 className="size-3.5 text-primary/70" aria-hidden />
        كامل نينوى
      </button>

      {/* أداة الرسم (م2.4) — قطعة مفترضة، خريطة فقط (استثناء الوصول المزدوج §هـ.4) */}
      <button
        type="button"
        onClick={toggleDraw}
        title={drawing ? "إلغاء الرسم" : "رسم قطعة مفترضة"}
        className={cn(
          "absolute end-3 top-40 z-10 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium backdrop-blur transition",
          drawing
            ? "border-state-assumed/60 bg-state-assumed/20 text-state-assumed shadow-[0_0_18px_-6px_rgba(139,111,176,0.8)]"
            : "border-border/70 bg-card/85 text-foreground/90 ring-1 ring-inset ring-foreground/5 hover:bg-accent hover:text-foreground",
        )}
      >
        <PenTool className="size-3.5" aria-hidden /> {drawing ? "إلغاء الرسم" : "رسم قطعة"}
      </button>

      {/* تبديل الطبقات (م2.4) */}
      <div className="absolute end-3 top-52 z-10 flex flex-col gap-1 rounded-lg border border-border/70 bg-card/85 p-2 text-xs text-foreground/90 backdrop-blur">
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={showBoundaries} onChange={(e) => setShowBoundaries(e.target.checked)} className="size-3.5 accent-primary" />
          الحدود
        </label>
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={showParcels} onChange={(e) => setShowParcels(e.target.checked)} className="size-3.5 accent-primary" />
          القطع
        </label>
        {showParcels ? (
          <div className="mt-0.5 flex flex-col gap-1 border-t border-border/50 ps-1 pt-1.5">
            {STATE_TOGGLES.map((st) => (
              <label key={st.value} className="inline-flex cursor-pointer items-center gap-1.5">
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
                  className={`size-3.5 ${st.accent}`}
                />
                {st.label}
              </label>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
