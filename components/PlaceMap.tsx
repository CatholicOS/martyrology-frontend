"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { CircleMarker, Map as LeafletMap } from "leaflet";

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
      // Esri World Street Map rather than the standard OSM tiles: OSM labels each
      // place in its local script (kanji, Arabic, Hangul…), which a curator matching
      // Latin and Italian place names cannot read. Esri labels in English, keyless.
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 18,
        attribution:
          "Tiles &copy; Esri &mdash; Sources: Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, " +
          "METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), NGCC, &copy; OpenStreetMap contributors, " +
          "and the GIS User Community",
      }).addTo(map);
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
    return <p className="text-xs italic text-slate-500 dark:text-slate-400">No candidate has coordinates.</p>;
  }
  return <div ref={el} className="h-64 w-full rounded border border-slate-300 dark:border-slate-700" />;
}
