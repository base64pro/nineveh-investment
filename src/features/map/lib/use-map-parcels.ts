"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { createClient } from "@/lib/supabase/client";

interface MapParcelRow {
  kind: string;
  ref_id: string;
  entity_id: string | null;
  parcel_no: string | null;
  state: string | null;
  geometry: Geometry | null;
  label: string | null;
}

export interface ParcelProps {
  kind: string;
  ref_id: string;
  entity_id: string;
  parcel_no: string | null;
  state: string;
  label: string;
}

/** قطع الخريطة الموحّدة (view map_parcels) كـFeatureCollection للعرض الملوّن — م2.4. */
export function useMapParcels() {
  const query = useQuery({
    queryKey: ["map_parcels"],
    queryFn: async (): Promise<MapParcelRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.from("map_parcels").select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as MapParcelRow[];
    },
  });

  const fc = useMemo<FeatureCollection>(() => {
    const features: Feature[] = (query.data ?? [])
      .filter((r): r is MapParcelRow & { geometry: Geometry; state: string } => Boolean(r.geometry) && Boolean(r.state))
      .map((r) => ({
        type: "Feature",
        geometry: r.geometry,
        properties: {
          kind: r.kind,
          ref_id: r.ref_id,
          entity_id: r.entity_id ?? "",
          parcel_no: r.parcel_no,
          state: r.state,
          label: r.label ?? "",
        } satisfies ParcelProps,
      }));
    return { type: "FeatureCollection", features };
  }, [query.data]);

  return { fc, isLoading: query.isLoading, isError: query.isError };
}
