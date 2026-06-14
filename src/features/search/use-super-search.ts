"use client";

// م8.3 · منطق البحث الفائق المشترك (§هـ.2.ج) — يُستهلَك في لوحة الديسكتوب (SearchOverlay) والبحث المضمَّن
// على الجوال (MobileSearch). بياناتنا أولاً (قطع مرسومة فورية من الذاكرة) ثم نتائج الخادم — لا تأليف.

import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { superSearch } from "./actions";
import type { SearchKind, SearchResult } from "./types";
import { requestFlyTo, requestFlyToCoords, requestOpenParcelDetail, type ParcelKind } from "@/features/map/lib/map-nav-store";
import { requestOpenCompany, requestOpenSection } from "@/features/shell/shell-store";

const SECTION_OF: Record<SearchKind, string | undefined> = {
  opportunity: "opportunities",
  license: "licenses",
  company: "companies",
  assumed: "opportunity-design",
  annotation: undefined,
  place: undefined,
};

// تطبيع عربي محلي (مرآة ar_normalize في القاعدة)
function normAr(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي");
}

interface ParcelFeatureProps {
  ref_id?: string;
  entity_id?: string | null;
  kind?: string;
  label?: string | null;
  parcel_no?: string | null;
  neighborhood?: string | null;
  district?: string | null;
}

export function navHint(r: SearchResult): string {
  return r.kind === "place" || r.kind === "annotation"
    ? "↵ الموقع على الخريطة"
    : r.hasGeom
      ? "↵ القطعة على الخريطة"
      : r.entityId
        ? "↵ فتح السجلّ"
        : "↵ فتح القسم";
}

export function useSuperSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(0);
  const reqId = useRef(0);
  const queryClient = useQueryClient();

  // الطبقة الفورية: القطع المرسومة من ذاكرة الخريطة — أولوية مطلقة بلا انتظار خادم
  const localMatches = useCallback(
    (qq: string): SearchResult[] => {
      const fc = queryClient.getQueryData<{ features?: { properties?: ParcelFeatureProps }[] }>(["map_parcels"]);
      const needle = normAr(qq.trim());
      if (!needle || !fc?.features?.length) return [];
      const out: SearchResult[] = [];
      for (const f of fc.features) {
        const p = f.properties ?? {};
        const hay = normAr([p.label, p.parcel_no, p.neighborhood, p.district].filter(Boolean).join(" "));
        if (!hay.includes(needle)) continue;
        out.push({
          kind: (p.kind as SearchKind) ?? "assumed",
          label: p.label ?? p.parcel_no ?? "قطعة",
          sublabel: "قطعة مرسومة — انتقال فوري للخريطة",
          parcel_no: p.parcel_no ?? null,
          mapRef: p.ref_id ?? null,
          entityId: p.entity_id ?? null,
          hasGeom: true,
          lng: null,
          lat: null,
        });
        if (out.length >= 8) break;
      }
      return out;
    },
    [queryClient],
  );

  // بحث مُمَهَّل (debounce) — حارس reqId يمنع نتائج قديمة
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setWarning(null);
      setLoading(false);
      return undefined;
    }
    const local = localMatches(q);
    if (local.length) {
      setResults(local);
      setSel(0);
    }
    setLoading(true);
    const id = ++reqId.current;
    const t = setTimeout(() => {
      void superSearch(q)
        .then((r) => {
          if (id === reqId.current) {
            const seen = new Set(local.map((x) => x.mapRef ?? `e:${x.entityId ?? ""}`));
            const merged = [...local, ...r.results.filter((x) => !seen.has(x.mapRef ?? `e:${x.entityId ?? ""}`))].slice(0, 18);
            setResults(merged);
            setWarning(r.warning ?? null);
            setSel(0);
          }
        })
        .catch(() => {
          if (id === reqId.current) setResults(local);
        })
        .finally(() => {
          if (id === reqId.current) setLoading(false);
        });
    }, 200);
    return () => clearTimeout(t);
  }, [query, localMatches]);

  const go = useCallback((r: SearchResult): void => {
    if ((r.kind === "place" || r.kind === "annotation") && r.lng !== null && r.lat !== null) {
      requestFlyToCoords({ lng: r.lng, lat: r.lat, label: r.label });
    } else if (r.hasGeom && r.mapRef) {
      requestFlyTo(r.mapRef);
    } else if (r.kind === "company" && r.entityId) {
      requestOpenSection("companies");
      requestOpenCompany(r.entityId);
    } else if (r.entityId && (r.kind === "opportunity" || r.kind === "license" || r.kind === "assumed")) {
      requestOpenParcelDetail({ kind: r.kind as ParcelKind, id: r.entityId, readOnly: true });
    } else {
      const section = SECTION_OF[r.kind];
      if (section) requestOpenSection(section);
    }
  }, []);

  const reset = useCallback((): void => {
    setQuery("");
    setResults([]);
    setSel(0);
    setLoading(false);
    setWarning(null);
  }, []);

  // أسهم التنقّل + Enter (الإجراء يُمرَّر من المكوّن ليتحكّم بالإغلاق/التركيز)
  const handleKey = useCallback(
    (e: KeyboardEvent<HTMLInputElement>, onEnter: () => void): void => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSel((s) => Math.min(s + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSel((s) => Math.max(s - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        onEnter();
      }
    },
    [results.length],
  );

  return { query, setQuery, results, warning, loading, sel, setSel, go, reset, handleKey };
}
