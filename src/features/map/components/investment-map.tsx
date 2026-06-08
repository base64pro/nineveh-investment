"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import bbox from "@turf/bbox";
import mask from "@turf/mask";
import type { Map as GLMap, StyleSpecification } from "maplibre-gl";
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
import { GeoJsonLayer } from "@deck.gl/layers";
import { useMapParcels } from "../lib/use-map-parcels";
import { fillRgba, glowRgba, lineRgba } from "../lib/parcel-colors";
import { TerraDraw, TerraDrawPolygonMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { inferName } from "../lib/spatial-inference";
import { onFlyTo } from "../lib/map-nav-store";

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
  const label = (id: string, minzoom: number, size: number, opacity: unknown): StyleLayer => ({
    id: `bnd-${id}-label`,
    type: "symbol",
    source: `bnd-${id}`,
    minzoom,
    layout: {
      "text-field": ["coalesce", ["get", "name_ar"], ["get", "name_en"]],
      "text-font": ["Noto Sans Regular"],
      "text-size": size,
      "text-max-width": 8,
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
    label("districts", 6, 15, districtLabelFade),
    line("subdistricts", C.subdistricts.line, C.subdistricts.width, 8, subdFade),
    label("subdistricts", 9, 12, subdLabelFade),
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
  return [
    new GeoJsonLayer({
      id: "parcels-glow",
      data: fc,
      filled: false,
      stroked: true,
      getLineColor: (f: Feature) => {
        const [r, g, b] = glowRgba(stateOf(f));
        return [r, g, b, alpha(80, 170, f)];
      },
      getLineWidth: (f: Feature) => (sel(f) ? 10 : 6),
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
        const [r, g, b] = fillRgba(stateOf(f));
        return [r, g, b, alpha(64, 120, f)];
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

export default function InvestmentMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GLMap | null>(null);
  const dataRef = useRef<MapData | null>(null);
  const baseRef = useRef<BaseStyle>(DEFAULT_BASE);
  const [base, setBase] = useState<BaseStyle>(DEFAULT_BASE);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const { fc } = useMapParcels();
  const fcRef = useRef<FeatureCollection>(fc);
  fcRef.current = fc;
  const drawRef = useRef<TerraDraw | null>(null);
  const [drawing, setDrawing] = useState(false);
  const queryClient = useQueryClient();
  const qcRef = useRef(queryClient);
  qcRef.current = queryClient;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(selectedId);
  selectedIdRef.current = selectedId;

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
        // نقر قطعة ← تحديدها (توهّج + خفوت ما حولها §هـ.4)؛ نقر فراغ ← إلغاء التحديد
        m.on("click", (e) => {
          const ov = overlayRef.current;
          if (!ov) return;
          const info = ov.pickObject({ x: e.point.x, y: e.point.y, radius: 5, layerIds: ["parcels"] });
          const ref = info?.object?.properties?.ref_id;
          setSelectedId(typeof ref === "string" ? ref : null);
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
          const district = inferName(polygon, data.districts);
          const subdistrict = inferName(polygon, data.subdistricts);
          void (async () => {
            const supabase = createClient();
            const { error } = await supabase.rpc("create_assumed_parcel", {
              p_geom: polygon.geometry,
              p_district: district,
              p_subdistrict: subdistrict,
            });
            d.clear();
            d.setMode("static");
            setDrawing(false);
            if (error) {
              toast.error("تعذّر إنشاء القطعة");
              return;
            }
            toast.success(district ? `أُنشئت قطعة مفترضة — ${district}` : "أُنشئت قطعة مفترضة");
            void qcRef.current.invalidateQueries({ queryKey: ["map_parcels"] });
            void qcRef.current.invalidateQueries({ queryKey: ["table", "assumed_parcels"] });
            void qcRef.current.invalidateQueries({ queryKey: ["counts"] });
          })();
        });
        drawRef.current = draw;

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
      map?.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  // تحديث طبقات القطع عند تغيّر البيانات أو التحديد (انعكاس لحظي)
  useEffect(() => {
    overlayRef.current?.setProps({ layers: parcelLayers(fc, selectedId) });
  }, [fc, selectedId]);

  // الانتقال لقطعة من السايدبار (§هـ.2 مبدأ التنقّل): flyTo + تحديد
  useEffect(() => {
    return onFlyTo((refId) => {
      const m = mapRef.current;
      const f = fcRef.current.features.find((ft) => ft.properties?.ref_id === refId);
      setSelectedId(refId);
      if (m && f?.geometry) {
        const b = bbox(f) as [number, number, number, number];
        m.fitBounds(b, { padding: 80, maxZoom: 16, duration: 1000 });
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
    if (drawing) {
      draw.setMode("static");
      draw.clear();
      setDrawing(false);
    } else {
      draw.setMode("polygon");
      setDrawing(true);
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
    </div>
  );
}
