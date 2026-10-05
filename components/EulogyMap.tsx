"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { CircleMarker, Map as LeafletMap, MarkerClusterGroup } from "leaflet";
import { dayPath } from "@/lib/calendar";
import { typologyLabel, type MapEntry } from "@/lib/map-data";

interface Props {
  entries: MapEntry[];
  edition: string;
  selected: string | null;
  onSelect: (id: string) => void;
  /** A cluster whose eulogies all share one place was clicked: list that place's eulogies. */
  onPlace: (qid: string) => void;
}

type Leaflet = typeof import("leaflet");
type PlacedMarker = CircleMarker & { qid?: string };

const MARKER = { color: "#7f1d1d", fillColor: "#b91c1c", radius: 6, weight: 2, fillOpacity: 0.85 };

/**
 * The popup: subject, ID, typology, place as printed and on Wikidata, and a link into the reader.
 * Built as DOM, not HTML, so no text is parsed as markup.
 */
function popupFor(e: MapEntry, edition: string): HTMLElement {
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string) => {
    const n = document.createElement(tag);
    if (text) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const root = el("div", undefined, "text-sm");
  root.append(el("p", e.subject, "font-semibold"));
  root.append(el("p", e.id, "font-mono text-xs"));
  root.append(el("p", typologyLabel(e.typology)));
  const place = el("p", `${e.la} · `);
  const wd = el("a", e.label);
  wd.href = `https://www.wikidata.org/wiki/${e.qid}`;
  wd.target = "_blank";
  wd.rel = "noreferrer";
  place.append(wd);
  root.append(place);
  const read = el("a", "Read");
  read.href = `${dayPath(edition, e.day)}#${e.id}`;
  read.dataset.read = "";
  root.append(read);
  return root;
}

/**
 * An edition's eulogies on an OpenStreetMap base map, one circle marker each, clustered. A
 * cluster splits as one zooms; one whose eulogies all share a place (Rome holds hundreds) would
 * never split, so clicking it hands the place to the sidebar instead. Leaflet needs `window`,
 * so it loads in the browser; markercluster extends the global `L`, so that is set first.
 */
export default function EulogyMap({ entries, edition, selected, onSelect, onPlace }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState<{ L: Leaflet; map: LeafletMap; group: MarkerClusterGroup } | null>(null);
  const markers = useRef(new Map<string, PlacedMarker>());
  const onSelectRef = useRef(onSelect);
  const onPlaceRef = useRef(onPlace);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onPlaceRef.current = onPlace;
  }, [onSelect, onPlace]);

  // The map and its cluster group, once.
  useEffect(() => {
    let map: LeafletMap | null = null;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      (window as unknown as { L: Leaflet }).L = L;
      await import("leaflet.markercluster");
      if (cancelled || !el.current) return;
      map = L.map(el.current, { worldCopyJump: true });
      map.setView([30, 10], 2);
      // Esri World Street Map, as PlaceMap: English labels, keyless.
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 18,
        attribution:
          "Tiles &copy; Esri &mdash; Sources: Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, " +
          "METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), NGCC, " +
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
          "and the GIS User Community",
      }).addTo(map);
      const group = L.markerClusterGroup({ zoomToBoundsOnClick: false, spiderfyOnMaxZoom: false, chunkedLoading: true });
      group.on("clusterclick", (ev) => {
        const cluster = (ev as unknown as { layer: { getAllChildMarkers(): PlacedMarker[]; zoomToBounds(): void } }).layer;
        const children = cluster.getAllChildMarkers();
        const first = children[0].getLatLng();
        if (children.every((m) => m.getLatLng().equals(first))) {
          if (children[0].qid) onPlaceRef.current(children[0].qid);
        } else {
          cluster.zoomToBounds();
        }
      });
      group.addTo(map);
      setReady({ L, map, group });
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, []);

  // The markers, whenever the eulogies shown change.
  useEffect(() => {
    if (!ready) return;
    const { L, map, group } = ready;
    group.clearLayers();
    markers.current.clear();
    const layers = entries.map((e) => {
      const m: PlacedMarker = L.circleMarker(e.coords, MARKER)
        .bindPopup(popupFor(e, edition))
        .on("click", () => onSelectRef.current(e.id));
      m.qid = e.qid;
      markers.current.set(e.id, m);
      return m;
    });
    group.addLayers(layers);
    if (entries.length > 0) map.fitBounds(entries.map((e) => e.coords), { padding: [24, 24], maxZoom: 9 });
  }, [ready, entries, edition]);

  // Reveal the selected eulogy: zoom until its marker leaves its cluster, then open it.
  useEffect(() => {
    if (!ready || !selected) return;
    const m = markers.current.get(selected);
    if (m) ready.group.zoomToShowLayer(m, () => m.openPopup());
  }, [ready, selected]);

  return <div ref={el} className="h-full min-h-[24rem] w-full" data-testid="eulogy-map" />;
}
