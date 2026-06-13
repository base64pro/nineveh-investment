"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { createClient } from "@/lib/supabase/client";

export interface AnnotationRow {
  id: string;
  element_type: string | null;
  name: string;
  geometry: Geometry | null;
  lng: number | null;
  lat: number | null;
}

/** عناصر الخريطة المحرَّرة المسمّاة (view map_elements_geo) كـFeatureCollection — م7.3. */
export function useMapAnnotations() {
  const query = useQuery({
    queryKey: ["map_elements_geo"],
    queryFn: async (): Promise<AnnotationRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.from("map_elements_geo").select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as AnnotationRow[];
    },
  });

  const fc = useMemo<FeatureCollection>(() => {
    const features: Feature[] = (query.data ?? [])
      .filter((r): r is AnnotationRow & { geometry: Geometry } => Boolean(r.geometry))
      .map((r) => ({
        type: "Feature",
        geometry: r.geometry,
        properties: { id: r.id, name: r.name, element_type: r.element_type ?? "point" },
      }));
    return { type: "FeatureCollection", features };
  }, [query.data]);

  return { fc, rows: query.data ?? [] };
}
