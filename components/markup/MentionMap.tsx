"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import { ESRI_ATTRIBUTION, ESRI_STREET_TILES } from "@/lib/esri-tiles";

/**
 * One place on a small map in its popup. Only the zoom buttons work, so scrolling or dragging over it moves the
 * page. Loaded with the first place popup (React.lazy), so Leaflet never weighs on the reader otherwise.
 * Leaflet's own attribution control is off: the full Esri credit would cover most of a map this small, so a short
 * "© Esri" and a toggle stand in for it, and the toggle opens the full credit (scrolling within the map).
 */
// The credit's links open in a new tab, like the cards' other external links.
const CREDIT_HTML = ESRI_ATTRIBUTION.replaceAll("<a ", '<a target="_blank" rel="noopener noreferrer" ');

export default function MentionMap({ coords, label }: { coords: [number, number]; label: string }) {
  const t = useTranslations("Markup");
  const el = useRef<HTMLDivElement>(null);
  const [credits, setCredits] = useState(false);
  const [lat, lon] = coords;
  useEffect(() => {
    let map: LeafletMap | null = null;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      map = L.map(el.current, {
        dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false,
        attributionControl: false,
      });
      L.tileLayer(ESRI_STREET_TILES, { maxZoom: 18, attribution: ESRI_ATTRIBUTION }).addTo(map);
      L.circleMarker([lat, lon], { color: "#0b6e7f", fillColor: "#22a5b8", radius: 7, weight: 2, fillOpacity: 0.8 }).addTo(map);
      map.setView([lat, lon], 8);
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lon]);
  return (
    <div className="relative mt-2 h-40 w-full">
      <div ref={el} role="group" aria-label={label} className="h-full w-full rounded border border-slate-300 dark:border-slate-700" />
      {/* Above Leaflet's panes (z-index up to 1000), and outside the labelled map box so the button stays reachable. */}
      <div className="absolute bottom-px right-px z-[1000] flex max-h-[calc(100%-2px)] max-w-full items-end rounded-tl bg-white/90 text-[0.6rem] leading-tight text-slate-700 dark:bg-slate-900/90 dark:text-slate-300">
        {credits ? (
          <div className="max-h-full overflow-y-auto px-1 py-0.5 [&_a]:underline" dangerouslySetInnerHTML={{ __html: CREDIT_HTML }} />
        ) : (
          <span className="px-1">© Esri</span>
        )}
        <button
          type="button"
          onClick={() => setCredits((c) => !c)}
          aria-expanded={credits}
          aria-label={t("mapCredits")}
          title={t("mapCredits")}
          className="shrink-0 px-1 font-bold underline focus-visible:outline focus-visible:outline-2"
        >
          {credits ? "×" : "i"}
        </button>
      </div>
    </div>
  );
}
