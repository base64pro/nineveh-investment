"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import bbox from "@turf/bbox";
import mask from "@turf/mask";
import type { Map as GLMap, StyleSpecification } from "maplibre-gl";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
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

type MapData = {
  gov: FeatureCollection;
  districts: FeatureCollection;
  subdistricts: FeatureCollection;
  maskFC: Feature<Polygon | MultiPolygon>;
  bounds: [number, number, number, number];
};

type StyleSource = { url?: string; tiles?: string[]; [k: string]: unknown };
type StyleJson = {
  sprite?: string;
  glyphs?: string;
  sources?: Record<string, StyleSource>;
  [k: string]: unknown;
};

const ARABIC_LABEL = ["coalesce", ["get", "name:ar"], ["get", "name:latin"], ["get", "name"]];

/**
 * يجلب نمط MapTiler عبر الوسيط بلا تخزين، ويحوّل عناوينه النسبية (/api/maptiler)
 * إلى مطلقة، ثم يعيده ككائن — يضمن صحّة sprite/glyphs/tiles بمعزل عن الكاش.
 */
async function loadStyle(base: BaseStyle): Promise<StyleSpecification> {
  const res = await fetch(styleUrl(base), { cache: "no-store" });
  const style = (await res.json()) as StyleJson;
  const origin = window.location.origin;
  const abs = (u: string | undefined): string | undefined =>
    typeof u === "string" && u.startsWith("/api/maptiler") ? origin + u : u;

  style.sprite = abs(style.sprite);
  style.glyphs = abs(style.glyphs);
  for (const src of Object.values(style.sources ?? {})) {
    // تضمين TileJSON ببلاطات مطلقة (إزالة الاعتماد على حلّ العناوين النسبية)
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
  return style as unknown as StyleSpecification;
}

function trySetPaint(map: GLMap, layerId: string, prop: string, value: string): void {
  if (!map.getLayer(layerId)) return;
  try {
    map.setPaintProperty(layerId, prop, value);
  } catch {
    // طبقة غير متوافقة — تجاهل
  }
}

/** ضبط القاعدة الداكنة نحو الكحلي المات. */
function tuneNavy(map: GLMap): void {
  trySetPaint(map, "background", "background-color", NAVY.background);
  trySetPaint(map, "water", "fill-color", NAVY.water);
}

/** تسميات القاعدة بالعربية (name:ar) — §هـ.4. */
function localizeArabic(map: GLMap): void {
  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    if (layer.type !== "symbol") continue;
    const layout = layer.layout as Record<string, unknown> | undefined;
    if (!layout || !("text-field" in layout)) continue;
    try {
      map.setLayoutProperty(layer.id, "text-field", ARABIC_LABEL);
    } catch {
      // تجاهل الطبقات غير القابلة للتعريب
    }
  }
}

function addDimMask(map: GLMap, maskFC: MapData["maskFC"]): void {
  if (map.getSource("dim-mask")) return;
  map.addSource("dim-mask", { type: "geojson", data: maskFC });
  map.addLayer({ id: "dim-mask", type: "fill", source: "dim-mask", paint: { "fill-color": DIM_COLOR } });
}

function addBoundary(
  map: GLMap,
  id: string,
  data: FeatureCollection,
  opts: { line: string; width: number },
  lineMinZoom: number,
  labelMinZoom: number,
  labelSize: number,
): void {
  const source = `bnd-${id}`;
  if (!map.getSource(source)) map.addSource(source, { type: "geojson", data });

  const lineId = `${source}-line`;
  if (!map.getLayer(lineId)) {
    map.addLayer({
      id: lineId,
      type: "line",
      source,
      minzoom: lineMinZoom,
      paint: {
        "line-color": opts.line,
        "line-width": opts.width,
        "line-opacity": 0.9,
        "line-blur": 0.4,
      },
    });
  }

  const labelId = `${source}-label`;
  if (!map.getLayer(labelId)) {
    map.addLayer({
      id: labelId,
      type: "symbol",
      source,
      minzoom: labelMinZoom,
      layout: {
        "text-field": ["coalesce", ["get", "name_ar"], ["get", "name_en"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": labelSize,
      },
      paint: {
        "text-color": BOUNDARY_COLORS.label,
        "text-halo-color": BOUNDARY_COLORS.labelHalo,
        "text-halo-width": 1.4,
      },
    });
  }
}

/** يضيف كل طبقاتنا فوق القاعدة (يُعاد عند كل تغيير نمط). */
function applyCustomLayers(map: GLMap, data: MapData, base: BaseStyle): void {
  addDimMask(map, data.maskFC);
  addBoundary(map, "governorate", data.gov, BOUNDARY_COLORS.governorate, 0, 0, 18);
  addBoundary(map, "districts", data.districts, BOUNDARY_COLORS.districts, 0, 7, 14);
  addBoundary(map, "subdistricts", data.subdistricts, BOUNDARY_COLORS.subdistricts, 8, 9.5, 12);
  if (base === "dark") tuneNavy(map);
  localizeArabic(map);
}

export default function InvestmentMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GLMap | null>(null);
  const dataRef = useRef<MapData | null>(null);
  const baseRef = useRef<BaseStyle>(DEFAULT_BASE);
  const [base, setBase] = useState<BaseStyle>(DEFAULT_BASE);

  useEffect(() => {
    let cancelled = false;
    let map: GLMap | null = null;

    void (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !containerRef.current) return;

      if (maplibregl.getRTLTextPluginStatus() === "unavailable") {
        maplibregl.setRTLTextPlugin("/vendor/mapbox-gl-rtl-text.js", true);
      }

      const [gov, districts, subdistricts, style] = (await Promise.all([
        fetch("/api/boundaries/governorate").then((r) => r.json()),
        fetch("/api/boundaries/districts").then((r) => r.json()),
        fetch("/api/boundaries/subdistricts").then((r) => r.json()),
        loadStyle(DEFAULT_BASE),
      ])) as [FeatureCollection, FeatureCollection, FeatureCollection, StyleSpecification];
      if (cancelled || !containerRef.current) return;

      const bounds = bbox(gov) as [number, number, number, number];
      const maskFC = mask(gov as FeatureCollection<Polygon | MultiPolygon>) as Feature<
        Polygon | MultiPolygon
      >;
      dataRef.current = { gov, districts, subdistricts, maskFC, bounds };

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

      // إعادة طبقاتنا بثبات عند كل تحميل نمط (الأوّل + بعد كل setStyle)
      const ensureLayers = () => {
        const m = mapRef.current;
        const d = dataRef.current;
        if (!m || !d || !m.isStyleLoaded()) return;
        if (m.getLayer("bnd-governorate-line")) return; // مُطبَّقة بالفعل
        applyCustomLayers(m, d, baseRef.current);
      };
      map.on("styledata", ensureLayers);

      // قفل الحدود على المنظر المستقرّ (يمنع قفزة بعد الدخول)
      const lockView = () => {
        const m = mapRef.current;
        if (!m) return;
        const [w, s, e, n] = bounds; // صندوق المحافظة + هامش واسع (تنقّل سلس)
        const p = MAX_BOUNDS_PADDING_DEG;
        m.setMaxBounds([
          [w - p, s - p],
          [e + p, n + p],
        ]);
        m.setMinZoom(m.getZoom()); // الأدنى = المحافظة كاملة
      };

      map.on("load", () => {
        const m = mapRef.current;
        if (cancelled || !m) return;
        ensureLayers();
        m.fitBounds(bounds, { padding: 48, duration: 2200 }); // دخول متسارع
        m.once("moveend", lockView);
      });
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  async function switchBase(next: BaseStyle): Promise<void> {
    const map = mapRef.current;
    if (!map || next === baseRef.current) return;
    baseRef.current = next;
    setBase(next);
    map.setStyle(await loadStyle(next)); // معالج styledata يعيد طبقاتنا
  }

  function resetView(): void {
    const map = mapRef.current;
    const data = dataRef.current;
    if (!map || !data) return;
    map.fitBounds(data.bounds, { padding: 48, duration: 1200 });
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

      {/* العودة لكامل نينوى (§هـ.4) */}
      <button
        type="button"
        onClick={resetView}
        className="absolute start-3 top-16 z-10 rounded-md border border-border bg-card/85 px-2 py-1 text-xs backdrop-blur transition hover:bg-accent"
      >
        كامل نينوى
      </button>
    </div>
  );
}
