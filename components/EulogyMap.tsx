"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { useLocale, useTranslations } from "next-intl";
import type { CircleMarker, Map as LeafletMap, Marker, MarkerClusterGroup } from "leaflet";
import { dayPath } from "@/lib/calendar";
import { describeError } from "@/lib/describe-error";
import { getPathname } from "@/i18n/navigation";
import { langOn, type Locale } from "@/i18n/routing";
import { roleText, type RolesT } from "@/lib/body-places";
import { typologyLabel, type MapEntry } from "@/lib/map-data";
import { ESRI_ATTRIBUTION, ESRI_STREET_TILES } from "@/lib/esri-tiles";

interface Props {
  entries: MapEntry[];
  edition: string;
  /** The entry to reveal, by key; `n` changes with every pick, so picking it again reveals it again. */
  selected: { key: string; n: number } | null;
  /** A marker was clicked: its entry's key (a eulogy at several places has a marker at each). */
  onSelect: (key: string) => void;
  /** A cluster that zooming cannot split was clicked: list its entries (by key). */
  onPlace: (keys: string[]) => void;
}

type MapT = ReturnType<typeof useTranslations<"Map">>;
type Leaflet = typeof import("leaflet");
type PlacedMarker = CircleMarker & { entryKey?: string };

const MARKER = { color: "#7f1d1d", fillColor: "#b91c1c", radius: 6, weight: 2, fillOpacity: 0.85 };
// A possible site of a place whose site is disputed (Emmaus): hollow and dashed, the same red.
const SITE = { ...MARKER, fillOpacity: 0.2, dashArray: "3 3" };
// How close a pick from the list brings the map when its marker is folded into a cluster.
const REVEAL_ZOOM = 10;
// A cluster zooming cannot split fans its markers out up to this many; a larger one (Rome holds
// hundreds) lists its eulogies in a popup instead.
const SPIDERFY_MAX = 15;

type Site = NonNullable<MapEntry["sites"]>[number];

/**
 * The popup: subject, ID, typology, the place's roles unless it is only the place of death, place as
 * printed and on Wikidata, the possible site the marker stands at (a disputed place), and a link into the reader.
 * Built as DOM, not HTML, so no text is parsed as markup.
 */
function popupFor(e: MapEntry, edition: string, t: MapT, tRoles: RolesT, locale: Locale, site?: Site): HTMLElement {
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string) => {
    const n = document.createElement(tag);
    if (text) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const root = el("div", undefined, "text-sm");
  root.append(el("p", e.subject, "font-semibold"));
  root.append(el("p", e.id, "font-mono text-xs"));
  root.append(el("p", typologyLabel(t, e.typology)));
  if (e.roles.length > 0 && !(e.roles.length === 1 && e.roles[0].role === "death")) {
    root.append(el("p", e.roles.map((r) => roleText(tRoles, r)).join(" · ")));
  }
  const place = el("p");
  const printed = el("span", e.la);
  printed.lang = "la";
  place.append(printed, " · ");
  const wd = el("a", e.label);
  const wdLang = langOn(e.labelLang, locale);
  if (wdLang) wd.lang = wdLang;
  wd.href = `https://www.wikidata.org/wiki/${e.qid}`;
  wd.target = "_blank";
  wd.rel = "noreferrer";
  place.append(wd);
  root.append(place);
  if (site) {
    const at = el("p", `${t("possibleSite")}: `);
    const link = el("a", site.label);
    const siteLang = langOn(site.labelLang, locale);
    if (siteLang) link.lang = siteLang;
    link.href = `https://www.wikidata.org/wiki/${site.qid}`;
    link.target = "_blank";
    link.rel = "noreferrer";
    at.append(link);
    root.append(at);
  }
  const read = el("a", t("read"));
  read.href = `${getPathname({ href: dayPath(edition, e.day), locale })}#${e.id}`;
  read.dataset.read = "";
  root.append(read);
  return root;
}

/** The popup of a cluster too large to fan out: a heading and one button per eulogy. */
function clusterPopup(entries: MapEntry[], t: MapT, onPick: (key: string) => void): HTMLElement {
  const root = document.createElement("div");
  root.className = "text-sm";
  const head = document.createElement("p");
  head.className = "font-semibold";
  head.textContent = t("clusterList", { count: entries.length });
  const list = document.createElement("ul");
  list.className = "mt-1 max-h-64 overflow-y-auto";
  for (const e of entries) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "text-left text-blue-700 underline dark:text-blue-400";
    // The ID after the subject: two eulogies at one place can share a subject.
    const id = document.createElement("span");
    id.className = "font-mono text-xs";
    id.textContent = e.id;
    b.append(`${e.subject} · `, id);
    b.addEventListener("click", () => onPick(e.key));
    li.append(b);
    list.append(li);
  }
  root.append(head, list);
  return root;
}

/**
 * An edition's eulogies on an OpenStreetMap base map, one circle marker each, clustered. A
 * cluster splits as one zooms; one that cannot — its eulogies share one point (Rome holds
 * hundreds; Kayseri and Caesarea of Cappadocia are two items at one point), or the map is at
 * its deepest zoom (Rieti and Sabina, 29 m apart) — hands its eulogies to the sidebar instead. Leaflet needs `window`,
 * so it loads in the browser; markercluster extends the global `L`, so that is set first.
 */
export default function EulogyMap({ entries, edition, selected, onSelect, onPlace }: Props) {
  const t = useTranslations("Map");
  const tRoles = useTranslations("PlaceRoles");
  const locale = useLocale() as Locale;
  const tRef = useRef(t);
  const tRolesRef = useRef(tRoles);
  const localeRef = useRef(locale);
  const el = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState<{ L: Leaflet; map: LeafletMap; group: MarkerClusterGroup } | null>(null);
  const [failed, setFailed] = useState(false);
  const markers = useRef(new Map<string, { marker: PlacedMarker; entry: MapEntry }>());
  const editionRef = useRef(edition);
  const onSelectRef = useRef(onSelect);
  const onPlaceRef = useRef(onPlace);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onPlaceRef.current = onPlace;
    tRef.current = t;
    tRolesRef.current = tRoles;
    localeRef.current = locale;
  }, [onSelect, onPlace, t, tRoles, locale]);

  // The map and its cluster group, once.
  useEffect(() => {
    let map: LeafletMap | null = null;
    let cancelled = false;
    (async () => {
      let L: Leaflet;
      try {
        L = (await import("leaflet")).default;
        (window as unknown as { L: Leaflet }).L = L;
        await import("leaflet.markercluster");
      } catch (err) {
        console.error(`map: Leaflet: ${describeError(err)}`);
        if (!cancelled) setFailed(true);
        return;
      }
      if (cancelled || !el.current) return;
      map = L.map(el.current, { worldCopyJump: true });
      map.setView([30, 10], 2);
      // Esri World Street Map, as PlaceMap: English labels, keyless.
      L.tileLayer(ESRI_STREET_TILES, { maxZoom: 18, attribution: ESRI_ATTRIBUTION }).addTo(map);
      // No chunkedLoading: markercluster 1.5.3's chunked addLayers keeps adding a superseded set
      // of markers after clearLayers.
      const group = L.markerClusterGroup({ zoomToBoundsOnClick: false, spiderfyOnMaxZoom: false });
      const mapRef = map;
      group.on("clusterclick", (ev) => {
        const cluster = (ev as unknown as {
          layer: { getAllChildMarkers(): PlacedMarker[]; zoomToBounds(): void; spiderfy(): void };
        }).layer;
        const children = cluster.getAllChildMarkers();
        const first = children[0].getLatLng();
        const onePoint = children.every((m) => m.getLatLng().equals(first));
        if (onePoint || mapRef.getZoom() >= mapRef.getMaxZoom()) {
          // A disputed place's sites are several markers of one entry: it is listed once.
          const keys = [...new Set(children.flatMap((m) => (m.entryKey ? [m.entryKey] : [])))];
          onPlaceRef.current(keys);
          if (children.length <= SPIDERFY_MAX) {
            cluster.spiderfy();
          } else {
            const shown = keys.flatMap((k) => markers.current.get(k)?.entry ?? []);
            L.popup().setLatLng(first).setContent(clusterPopup(shown, tRef.current, (k) => onSelectRef.current(k))).openOn(mapRef);
          }
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
    editionRef.current = edition;
    group.clearLayers();
    markers.current.clear();
    const layers = entries.flatMap((e) => {
      // The popup is built when opened: thousands of markers are rebuilt as the filters change.
      const at = (coords: [number, number], style: typeof MARKER, site?: Site) => {
        const m: PlacedMarker = L.circleMarker(coords, style)
          .bindPopup(() => popupFor(e, edition, tRef.current, tRolesRef.current, localeRef.current, site))
          .on("click", () => onSelectRef.current(e.key));
        m.entryKey = e.key;
        return m;
      };
      // A disputed place (Emmaus) has a marker at each possible site; a pick reveals the first.
      const ms = e.sites ? e.sites.map((s) => at(s.coords, SITE, s)) : [at(e.coords, MARKER)];
      markers.current.set(e.key, { marker: ms[0], entry: e });
      return ms;
    });
    group.addLayers(layers);
    const points = entries.flatMap((e) => (e.sites ? e.sites.map((s) => s.coords) : [e.coords]));
    if (points.length > 0) map.fitBounds(points, { padding: [24, 24], maxZoom: 9 });
  }, [ready, entries, edition]);

  // Reveal the picked eulogy. A marker on show opens its own popup; one folded into a cluster
  // gets a popup at its place, since splitting the cluster could mean fanning out Rome's 205.
  useEffect(() => {
    if (!ready || !selected) return;
    const hit = markers.current.get(selected.key);
    if (!hit) return;
    const { L, map, group } = ready;
    // Typed for Marker only; markercluster walks any layer's __parent the same way.
    const shown: unknown = group.getVisibleParent(hit.marker as unknown as Marker);
    if (shown === hit.marker) {
      hit.marker.openPopup();
      return;
    }
    map.setView(hit.entry.coords, Math.max(map.getZoom(), REVEAL_ZOOM));
    L.popup().setLatLng(hit.entry.coords).setContent(popupFor(hit.entry, editionRef.current, tRef.current, tRolesRef.current, localeRef.current)).openOn(map);
  }, [ready, selected]);

  if (failed) {
    return (
      <div className="flex h-full min-h-[24rem] flex-col items-center justify-center gap-2 text-sm">
        <p>{t("mapLoadFailed")}</p>
        <button
          type="button"
          className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700"
          onClick={() => window.location.reload()}
        >
          {t("reload")}
        </button>
      </div>
    );
  }
  return <div ref={el} className="h-full min-h-[24rem] w-full" data-testid="eulogy-map" />;
}
