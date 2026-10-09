"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import "leaflet/dist/leaflet.css";
import type { CircleMarker, Map as LeafletMap } from "leaflet";
import { ESRI_ATTRIBUTION, ESRI_STREET_TILES } from "@/lib/esri-tiles";

export interface MapPoint {
  wikidata: string;
  label: string;
  coords: [number, number] | null;
}

interface Props {
  points: MapPoint[];
  selected: string;
  onSelect: (qid: string) => void;
}

const SELECTED = { color: "#15803d", fillColor: "#22c55e", radius: 9 };
const OTHER = { color: "#475569", fillColor: "#94a3b8", radius: 6 };

/**
 * The candidates of a place on an OpenStreetMap base map. Circle markers (no icon
 * images, which bundlers break); the selected candidate is green, and clicking a
 * marker selects its candidate. Leaflet needs `window`, so it loads in the browser.
 */
export default function PlaceMap({ points, selected, onSelect }: Props) {
  const t = useTranslations("Map");
  const el = useRef<HTMLDivElement>(null);
  const markers = useRef(new Map<string, CircleMarker>());
  const onSelectRef = useRef(onSelect);
  const selectedRef = useRef(selected);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const located = points.filter((p): p is MapPoint & { coords: [number, number] } => p.coords !== null);
  const key = located.map((p) => `${p.wikidata}@${p.coords.join(",")}`).join("|");

  useEffect(() => {
    let map: LeafletMap | null = null;
    let cancelled = false;
    const byQid = markers.current;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: false });
      // Esri World Street Map: English labels, keyless (lib/esri-tiles.ts).
      L.tileLayer(ESRI_STREET_TILES, { maxZoom: 18, attribution: ESRI_ATTRIBUTION }).addTo(map);
      for (const p of located) {
        const style = p.wikidata === selectedRef.current ? SELECTED : OTHER;
        const m = L.circleMarker(p.coords, { ...style, weight: 2, fillOpacity: 0.8 })
          .addTo(map)
          .bindTooltip(`${p.label} (${p.wikidata})`)
          .on("click", () => onSelectRef.current(p.wikidata));
        byQid.set(p.wikidata, m);
      }
      if (located.length === 1) map.setView(located[0].coords, 9);
      else if (located.length > 1) map.fitBounds(located.map((p) => p.coords), { padding: [24, 24], maxZoom: 9 });
    })();
    return () => {
      cancelled = true;
      byQid.clear();
      map?.remove();
    };
    // The map is rebuilt only when the set of points changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    selectedRef.current = selected;
    for (const [qid, m] of markers.current) m.setStyle(qid === selected ? SELECTED : OTHER);
  }, [selected]);

  if (located.length === 0) {
    return <p className="text-xs italic text-slate-500 dark:text-slate-400">{t("noCoordinates")}</p>;
  }
  return <div ref={el} className="h-64 w-full rounded border border-slate-300 dark:border-slate-700" />;
}
