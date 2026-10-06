# Eulogy Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public `/map` page plotting, for one chosen edition, a clustered marker per eulogy at its Wikidata place, with a sidebar to search by subject/ID and filter by typology and country.

**Architecture:** The snapshot script joins crmedr's `places.json`, `gazetteer.json` and `typology.json` with Wikidata coordinates (P625, fetched once per snapshot run) into `data/places-snapshot.json`. In the browser, `MapPage` fetches the edition's catalog, `lib/map-data.ts` joins it with the snapshot and filters it (pure functions), `MapSidebar` renders the controls and results, and `EulogyMap` draws Leaflet circle markers in a `leaflet.markercluster` group.

**Tech Stack:** Next.js 16 (app router), React 19, TypeScript, Tailwind 4, Leaflet 1.9 + leaflet.markercluster 1.5.3, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-06-eulogy-map-design.md`

## Global Constraints

- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code (AGENTS.md). Page `searchParams` is a `Promise` (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`).
- Tiles: Esri World Street Map with the exact attribution string `PlaceMap.tsx` uses.
- Leaflet loads only in the browser via dynamic `import()`; `leaflet.markercluster` reads the global `L`, so set `window.L` before importing it.
- `country` comes from the gazetteer (place's modern country), not the registry.
- The route is public: no curator gate.
- `?edition=<id>` selects the edition; missing/unknown → first `isOriginal` edition of `sortForShelf`.
- Snapshot keeps working offline: on Wikidata failure, reuse coordinates from the existing `data/places-snapshot.json`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Spec deviation: crmedr's `places.json` already contains the curated places (`"source": "curated"`), so `places_curated.json` is not read.

## Review Focus

- A search with Latin ligatures/accents ("caecilia" must find "Sancta Cæcilia", "caesarea" must find "Cæsaréæ in Cappadócia") — pinned in Task 2 (`matchesQuery`).
- Switching edition while filters are set: a country/typology no longer present must not leave the map empty with no visible checked box — Task 5 resets filters on edition change and tests it.
- Edition prints a eulogy only under a deprecated ID (1749/1914): counted as "not mapped", never crashes — Task 2.
- A single-place cluster (Rome, 205) must list its eulogies, not spiderfy or zoom forever — Task 4 (`clusterclick` with identical coordinates).
- Catalog fetch fails (API down) → retry message, retry refetches — Task 5.

---

## File Structure

- Modify `scripts/snapshot-registry.mjs` — add `buildPlaces`, `parseWktPoint`, `fetchCoords`; `main` becomes async and writes `data/places-snapshot.json`.
- Create `data/places-snapshot.json` — generated.
- Create `lib/places.ts` — snapshot types + `getPlaces()`.
- Create `lib/map-data.ts` — pure join/filter/facet/search functions.
- Create `components/EulogyMap.tsx` — Leaflet + clusters.
- Create `components/MapSidebar.tsx` — presentational sidebar.
- Create `components/MapPage.tsx` — data loading + state.
- Create `app/map/page.tsx` — route.
- Modify `components/SiteHeader.tsx` — "Map" link.
- Tests: `lib/__tests__/snapshot.test.ts` (extend), `lib/__tests__/map-data.test.ts`, `components/__tests__/EulogyMap.test.tsx`, `components/__tests__/MapSidebar.test.tsx`, `components/__tests__/MapPage.test.tsx`, `components/__tests__/SiteHeader.test.tsx` (extend).

---

### Task 1: Places snapshot

**Files:**
- Modify: `scripts/snapshot-registry.mjs`
- Create: `data/places-snapshot.json` (generated)
- Test: `lib/__tests__/snapshot.test.ts`

**Interfaces:**
- Produces: `buildPlaces(placesDoc, gazetteerDoc, typologyDoc, coords) → {places: Record<qid, {label, country, coords:[lat,lon]}>, eulogies: Record<id, {place, la, typology}>}`; `resolvedQids(placesDoc, gazetteerDoc) → string[]`; `parseWktPoint("Point(lon lat)") → [lat, lon] | null`; file `data/places-snapshot.json` of that shape.

- [ ] **Step 1: Write the failing tests** — append to `lib/__tests__/snapshot.test.ts` (and add `buildPlaces, parseWktPoint, resolvedQids` to its import):

```ts
describe("buildPlaces", () => {
  const placesDoc = { places: {
    "mr:0101-almachius": [{ role: "death", la: "Romæ", it: "A Roma", source: "lead" }],
    "mr:0102-x": [
      { role: "death", la: "Nusquam", source: "lead" },
      { role: "burial", la: "Mediolani", source: "lead" },
    ],
    "mr:0103-y": [{ role: "death", la: "Nusquam", source: "lead" }],
    "mr:0104-z": [{ role: "death", la: "Insula", source: "lead" }],
  } };
  const gazetteerDoc = { places: {
    "Romæ": { wikidata: "Q220", label: "Rome", country: "IT", status: "auto" },
    "Mediolani": { wikidata: "Q490", label: "Milan", country: "IT", status: "reviewed" },
    "Insula": { wikidata: "Q999", label: "Island", country: "GR", status: "reviewed" },
  } };
  const typologyDoc = { typology: { "mr:0101-almachius": "dies_natalis", "mr:0102-x": "depositio", "mr:0104-z": "dies_natalis" } };
  const coords = { Q220: [41.893, 12.483] as [number, number], Q490: [45.464, 9.19] as [number, number] };

  it("gives each eulogy its first resolved place, with typology and the place's coordinates", () => {
    expect(buildPlaces(placesDoc, gazetteerDoc, typologyDoc, coords)).toEqual({
      places: {
        Q220: { label: "Rome", country: "IT", coords: [41.893, 12.483] },
        Q490: { label: "Milan", country: "IT", coords: [45.464, 9.19] },
      },
      eulogies: {
        "mr:0101-almachius": { place: "Q220", la: "Romæ", typology: "dies_natalis" },
        "mr:0102-x": { place: "Q490", la: "Mediolani", typology: "depositio" },
      },
    });
  });

  it("lists the resolved QIDs once each, sorted", () => {
    expect(resolvedQids(placesDoc, gazetteerDoc)).toEqual(["Q220", "Q490", "Q999"]);
  });

  it("a eulogy without typology gets null", () => {
    const snap = buildPlaces(placesDoc, gazetteerDoc, { typology: {} }, coords);
    expect(snap.eulogies["mr:0101-almachius"].typology).toBeNull();
  });
});

describe("parseWktPoint", () => {
  it("reads Wikidata's Point(lon lat) as [lat, lon]", () => {
    expect(parseWktPoint("Point(12.4825 41.8931)")).toEqual([41.8931, 12.4825]);
    expect(parseWktPoint("Point(-0.1275 51.507222222)")).toEqual([51.507222222, -0.1275]);
  });
  it("rejects anything else", () => {
    expect(parseWktPoint("<http://www.wikidata.org/entity/Q405> Point(1 2)")).toBeNull();
    expect(parseWktPoint("garbage")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run lib/__tests__/snapshot.test.ts`
Expected: FAIL — `buildPlaces is not a function` (not exported).

- [ ] **Step 3: Implement** — add to `scripts/snapshot-registry.mjs` above `function main()`:

```js
/**
 * @typedef {{role: string, la: string, it?: string, source?: string}} StatedPlace
 * @typedef {{wikidata?: string|null, label?: string, country?: string, status: string}} GazetteerPlace
 */

/**
 * A eulogy's first stated place that the gazetteer resolves to a Wikidata item, if any.
 * @param {StatedPlace[]} stated
 * @param {Record<string, GazetteerPlace>} gazetteer
 */
function firstResolved(stated, gazetteer) {
  for (const s of stated) {
    const g = gazetteer[s.la];
    if (g?.wikidata) return { la: s.la, g };
  }
  return null;
}

/**
 * The Wikidata items the eulogies' places resolve to, for the coordinates query.
 * @param {{places: Record<string, StatedPlace[]>}} placesDoc
 * @param {{places: Record<string, GazetteerPlace>}} gazetteerDoc
 * @returns {string[]}
 */
export function resolvedQids(placesDoc, gazetteerDoc) {
  const qids = new Set();
  for (const stated of Object.values(placesDoc.places)) {
    const hit = firstResolved(stated, gazetteerDoc.places);
    if (hit) qids.add(hit.g.wikidata);
  }
  return [...qids].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}

/**
 * The map's data: each current eulogy's place (the first it states that the gazetteer resolves),
 * its typology, and each place's label, modern country and coordinates. A eulogy whose place has
 * no coordinates is left out: the map cannot show it.
 * @param {{places: Record<string, StatedPlace[]>}} placesDoc crmedr data/places.json (curated places included)
 * @param {{places: Record<string, GazetteerPlace>}} gazetteerDoc crmedr data/gazetteer.json
 * @param {{typology: Record<string, string>}} typologyDoc crmedr data/typology.json
 * @param {Record<string, [number, number]>} coords [lat, lon] by QID
 */
export function buildPlaces(placesDoc, gazetteerDoc, typologyDoc, coords) {
  /** @type {Record<string, {label: string, country: string, coords: [number, number]}>} */
  const places = {};
  /** @type {Record<string, {place: string, la: string, typology: string|null}>} */
  const eulogies = {};
  for (const [id, stated] of Object.entries(placesDoc.places)) {
    const hit = firstResolved(stated, gazetteerDoc.places);
    const qid = hit?.g.wikidata;
    if (!hit || !qid || !coords[qid]) continue;
    places[qid] ??= { label: hit.g.label ?? qid, country: hit.g.country ?? "", coords: coords[qid] };
    eulogies[id] = { place: qid, la: hit.la, typology: typologyDoc.typology[id] ?? null };
  }
  return { places, eulogies };
}

/**
 * Wikidata's WKT literal "Point(lon lat)" as Leaflet's [lat, lon]; null for anything else
 * (a coordinate on another globe carries an IRI prefix).
 * @param {string} wkt
 * @returns {[number, number] | null}
 */
export function parseWktPoint(wkt) {
  const m = /^Point\((-?[\d.]+) (-?[\d.]+)\)$/.exec(wkt);
  return m ? [Number(m[2]), Number(m[1])] : null;
}

const SPARQL = "https://query.wikidata.org/sparql";
const USER_AGENT = "martyrology-frontend snapshot (https://github.com/CatholicOS/martyrology-frontend)";

/**
 * [lat, lon] by QID from Wikidata's coordinate location (P625), a few hundred items per query.
 * @param {string[]} qids
 * @returns {Promise<Record<string, [number, number]>>}
 */
export async function fetchCoords(qids) {
  /** @type {Record<string, [number, number]>} */
  const out = {};
  for (let i = 0; i < qids.length; i += 300) {
    const values = qids.slice(i, i + 300).map((q) => `wd:${q}`).join(" ");
    const query = `SELECT ?item (SAMPLE(?c) AS ?coord) WHERE { VALUES ?item { ${values} } ?item wdt:P625 ?c } GROUP BY ?item`;
    const res = await fetch(SPARQL, {
      method: "POST",
      headers: {
        accept: "application/sparql-results+json",
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": USER_AGENT,
      },
      body: new URLSearchParams({ query }),
    });
    if (!res.ok) throw new Error(`Wikidata SPARQL ${res.status}`);
    const body = await res.json();
    for (const b of body.results.bindings) {
      const qid = b.item.value.split("/").pop();
      const point = parseWktPoint(b.coord.value);
      if (point) out[qid] = point;
    }
  }
  return out;
}
```

Then make `main` async and append the places step. Replace `function main() {` with `async function main() {` and, before its closing `}`, add:

```js
  const placesDoc = JSON.parse(readFileSync(join(crmedr, "data", "places.json"), "utf8"));
  const gazetteerDoc = JSON.parse(readFileSync(join(crmedr, "data", "gazetteer.json"), "utf8"));
  const typologyDoc = JSON.parse(readFileSync(join(crmedr, "data", "typology.json"), "utf8"));
  const qids = resolvedQids(placesDoc, gazetteerDoc);
  const placesDest = join(here, "..", "data", "places-snapshot.json");
  /** @type {Record<string, [number, number]>} */
  let coords;
  try {
    coords = await fetchCoords(qids);
  } catch (err) {
    // Offline: the previous snapshot's coordinates, so the rest of the snapshot still updates.
    console.warn(`Wikidata unreachable (${err instanceof Error ? err.message : err}); reusing ${placesDest}`);
    const prev = JSON.parse(readFileSync(placesDest, "utf8"));
    coords = Object.fromEntries(Object.entries(prev.places).map(([q, p]) => [q, p.coords]));
  }
  const missing = qids.filter((q) => !coords[q]);
  if (missing.length) console.log(`no coordinates on Wikidata for ${missing.length} places: ${missing.join(" ")}`);
  const places = buildPlaces(placesDoc, gazetteerDoc, typologyDoc, coords);
  writeFileSync(placesDest, JSON.stringify(places) + "\n");
  console.log(`wrote ${placesDest}: ${Object.keys(places.eulogies).length} eulogies at ${Object.keys(places.places).length} places`);
```

and change the last line to `if (import.meta.url === \`file://${process.argv[1]}\`) await main();`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/snapshot.test.ts`
Expected: PASS (all, including the existing `buildSnapshot`/`buildMisprints`/`buildNotes`).

- [ ] **Step 5: Generate the snapshot**

Run: `npm run snapshot-registry`
Expected: `wrote …/places-snapshot.json: ~4200 eulogies at ~1800 places`, a short "no coordinates" list (if any), and `git diff --stat data/` showing only `places-snapshot.json` new (the other snapshots unchanged unless crmedr moved on — if they changed, leave them out of this commit with `git checkout data/registry-snapshot.json data/misprints-snapshot.json data/notes-snapshot.json`).
Sanity check: `node -e 'const s=require("./data/places-snapshot.json");console.log(s.places.Q220, s.eulogies["mr:0101-almachius"])'` → Rome near `[41.89, 12.48]`.

- [ ] **Step 6: Commit**

```bash
git add scripts/snapshot-registry.mjs lib/__tests__/snapshot.test.ts data/places-snapshot.json
git commit -m "feat: places snapshot — each eulogy's Wikidata place, typology and coordinates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Map data (join, search, filters, facets)

**Files:**
- Create: `lib/places.ts`, `lib/map-data.ts`
- Test: `lib/__tests__/map-data.test.ts`

**Interfaces:**
- Consumes: `data/places-snapshot.json` (Task 1); `CatalogEntryOut` from `lib/types.ts` (`id`, `subject`, `present?`, `day_printed?: "MM-DD"`, `entry?`); `Day` from `lib/calendar.ts`.
- Produces:
  - `lib/places.ts`: `interface PlaceInfo {label: string; country: string; coords: [number, number]}`, `interface EulogyPlace {place: string; la: string; typology: string | null}`, `interface PlacesSnapshot {places: Record<string, PlaceInfo>; eulogies: Record<string, EulogyPlace>}`, `getPlaces(): PlacesSnapshot`.
  - `lib/map-data.ts`: `interface MapEntry {id: string; subject: string; day: Day; entry: number | null; qid: string; la: string; label: string; country: string; coords: [number, number]; typology: string | null}`; `mapEntries(catalog: CatalogEntryOut[], snap: PlacesSnapshot): {entries: MapEntry[]; unmapped: number}`; `interface MapFilters {query: string; hiddenTypologies: Set<string>; countries: Set<string>}`; `matchesQuery(e: MapEntry, query: string): boolean`; `filterEntries(entries, f: MapFilters): MapEntry[]`; `facetCounts(entries, f: MapFilters): {typologies: [string, number][]; countries: [string, number][]}`; `typologyLabel(t: string | null): string`; `NO_TYPOLOGY = "none"`.

- [ ] **Step 1: Write the failing tests** — `lib/__tests__/map-data.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { facetCounts, filterEntries, mapEntries, matchesQuery, typologyLabel, type MapFilters } from "@/lib/map-data";
import type { PlacesSnapshot } from "@/lib/places";
import type { CatalogEntryOut } from "@/lib/types";

const snap: PlacesSnapshot = {
  places: {
    Q220: { label: "Rome", country: "IT", coords: [41.9, 12.5] },
    Q84: { label: "London", country: "GB", coords: [51.5, -0.1] },
    Q1: { label: "Caesarea", country: "TR", coords: [38.7, 35.5] },
  },
  eulogies: {
    "mr:0101-almachius": { place: "Q220", la: "Romæ", typology: "dies_natalis" },
    "mr:0102-caecilia": { place: "Q220", la: "Romæ", typology: "depositio" },
    "mr:0103-thomas": { place: "Q84", la: "Londínii", typology: "dies_natalis" },
    "mr:0104-basilius": { place: "Q1", la: "Cæsaréæ in Cappadócia", typology: null },
  },
};

const cat = (id: string, subject: string, day: string, entry: number | null = 1, present = true): CatalogEntryOut => ({
  id, subject, anchor_day: day, deprecated: false, present, day_printed: day, entry,
});

const catalog: CatalogEntryOut[] = [
  cat("mr:0103-thomas", "Sanctus Thomas", "01-03"),
  cat("mr:0101-almachius", "Sanctus Almachius", "01-01", 4),
  cat("mr:0102-caecilia", "Sancta Cæcilia", "01-02"),
  cat("mr:0104-basilius", "Sanctus Basilius", "01-04"),
  cat("mr:0105-absent", "Sanctus Absens", "01-05", 1, false),
  cat("mr:0106-martina", "Sancta Martina", "01-06"), // printed, but no place (deprecated ID)
];

const all: MapFilters = { query: "", hiddenTypologies: new Set(), countries: new Set() };

describe("mapEntries", () => {
  it("keeps the eulogies the edition prints that have a place, in printed order, and counts the rest", () => {
    const { entries, unmapped } = mapEntries(catalog, snap);
    expect(entries.map((e) => e.id)).toEqual(["mr:0101-almachius", "mr:0102-caecilia", "mr:0103-thomas", "mr:0104-basilius"]);
    expect(unmapped).toBe(1); // mr:0106-martina; mr:0105-absent is not printed at all
    expect(entries[0]).toEqual({
      id: "mr:0101-almachius", subject: "Sanctus Almachius", day: { mm: 1, dd: 1 }, entry: 4,
      qid: "Q220", la: "Romæ", label: "Rome", country: "IT", coords: [41.9, 12.5], typology: "dies_natalis",
    });
  });

  it("a catalog entry without subject falls back to its ID", () => {
    const { entries } = mapEntries([{ ...catalog[0], subject: null }], snap);
    expect(entries[0].subject).toBe("mr:0103-thomas");
  });
});

describe("matchesQuery", () => {
  const { entries } = mapEntries(catalog, snap);
  const byId = (id: string) => entries.find((e) => e.id === id)!;

  it("matches subject and ID, ignoring case, accents and the æ/œ ligatures", () => {
    expect(matchesQuery(byId("mr:0102-caecilia"), "caecilia")).toBe(true);
    expect(matchesQuery(byId("mr:0102-caecilia"), "CÆCILIA")).toBe(true);
    expect(matchesQuery(byId("mr:0103-thomas"), "0103-tho")).toBe(true);
    expect(matchesQuery(byId("mr:0103-thomas"), "caecilia")).toBe(false);
  });

  it("matches the place as printed and its Wikidata label", () => {
    expect(matchesQuery(byId("mr:0104-basilius"), "cesarea")).toBe(false); // e ≠ ae
    expect(matchesQuery(byId("mr:0104-basilius"), "caesarea")).toBe(true);
    expect(matchesQuery(byId("mr:0103-thomas"), "london")).toBe(true);
  });

  it("an empty or blank query matches everything", () => {
    expect(matchesQuery(byId("mr:0103-thomas"), "  ")).toBe(true);
  });
});

describe("filterEntries and facetCounts", () => {
  const { entries } = mapEntries(catalog, snap);

  it("hides unchecked typologies (null typology is 'none') and keeps only the chosen countries", () => {
    expect(filterEntries(entries, { ...all, hiddenTypologies: new Set(["dies_natalis"]) }).map((e) => e.id))
      .toEqual(["mr:0102-caecilia", "mr:0104-basilius"]);
    expect(filterEntries(entries, { ...all, hiddenTypologies: new Set(["none"]) }).map((e) => e.id))
      .not.toContain("mr:0104-basilius");
    expect(filterEntries(entries, { ...all, countries: new Set(["IT", "GB"]) }).map((e) => e.id))
      .toEqual(["mr:0101-almachius", "mr:0102-caecilia", "mr:0103-thomas"]);
  });

  it("counts each facet under the other filters, not its own", () => {
    const f: MapFilters = { query: "", hiddenTypologies: new Set(["depositio"]), countries: new Set(["IT"]) };
    const { typologies, countries } = facetCounts(entries, f);
    // typologies: filtered by country IT only → almachius (dies_natalis), caecilia (depositio)
    expect(typologies).toEqual([["dies_natalis", 1], ["depositio", 1]]);
    // countries: filtered by typology (depositio hidden) only → almachius IT, thomas GB, basilius TR
    expect(countries).toEqual([["GB", 1], ["IT", 1], ["TR", 1]]);
  });

  it("typologies are listed in the crmedr order, with 'none' last", () => {
    const { typologies } = facetCounts(entries, all);
    expect(typologies.map(([t]) => t)).toEqual(["dies_natalis", "depositio", "none"]);
  });
});

describe("typologyLabel", () => {
  it("reads the value as words", () => {
    expect(typologyLabel("dies_natalis")).toBe("Dies natalis");
    expect(typologyLabel(null)).toBe("Not classified");
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run lib/__tests__/map-data.test.ts`
Expected: FAIL — cannot resolve `@/lib/map-data`.

- [ ] **Step 3: Implement** — `lib/places.ts`:

```ts
import snapshot from "@/data/places-snapshot.json";

/** A Wikidata place: its English label, its modern country (ISO 3166-1 alpha-2) and [lat, lon]. */
export interface PlaceInfo {
  label: string;
  country: string;
  coords: [number, number];
}

/** A current eulogy's place (QID), the place as the Latin 2004 prints it, and its typology. */
export interface EulogyPlace {
  place: string;
  la: string;
  typology: string | null;
}

export interface PlacesSnapshot {
  places: Record<string, PlaceInfo>;
  eulogies: Record<string, EulogyPlace>;
}

export function getPlaces(): PlacesSnapshot {
  return snapshot as PlacesSnapshot;
}
```

`lib/map-data.ts`:

```ts
import type { Day } from "@/lib/calendar";
import type { PlacesSnapshot } from "@/lib/places";
import type { CatalogEntryOut } from "@/lib/types";

/** One eulogy an edition prints, at its place. */
export interface MapEntry {
  id: string;
  subject: string;
  day: Day;
  entry: number | null;
  qid: string;
  la: string;
  label: string;
  country: string;
  coords: [number, number];
  typology: string | null;
}

export interface MapFilters {
  query: string;
  /** Typologies unchecked in the sidebar (all checked by default); NO_TYPOLOGY for none. */
  hiddenTypologies: Set<string>;
  /** Countries checked in the sidebar; empty means every country. */
  countries: Set<string>;
}

export const NO_TYPOLOGY = "none";

// crmedr's typology.json `values`, in its order.
const TYPOLOGY_ORDER = [
  "dies_natalis", "depositio", "translatio", "inventio", "dedicatio", "ordinatio", "celebratio", "commemoratio",
];

/**
 * The eulogies an edition prints (its catalog's `present` entries with a printed day) that have a
 * place on the map, in printed order; `unmapped` counts the printed ones that have none (no
 * resolved place, or a deprecated ID, which the gazetteer does not cover).
 */
export function mapEntries(catalog: CatalogEntryOut[], snap: PlacesSnapshot): { entries: MapEntry[]; unmapped: number } {
  const entries: MapEntry[] = [];
  let unmapped = 0;
  for (const c of catalog) {
    const m = c.present !== false ? /^(\d{2})-(\d{2})$/.exec(c.day_printed ?? "") : null;
    if (!m) continue;
    const ep = snap.eulogies[c.id];
    const place = ep ? snap.places[ep.place] : undefined;
    if (!ep || !place) {
      unmapped++;
      continue;
    }
    entries.push({
      id: c.id,
      subject: c.subject ?? c.id,
      day: { mm: Number(m[1]), dd: Number(m[2]) },
      entry: c.entry ?? null,
      qid: ep.place,
      la: ep.la,
      label: place.label,
      country: place.country,
      coords: place.coords,
      typology: ep.typology,
    });
  }
  entries.sort(
    (a, b) => a.day.mm - b.day.mm || a.day.dd - b.day.dd || (a.entry ?? Infinity) - (b.entry ?? Infinity),
  );
  return { entries, unmapped };
}

/** Lower case, without accents, with æ/œ spelled out, so "caecilia" finds "Cæcilia". */
function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Whether the search text is in the eulogy's subject, ID, printed place or the place's label. */
export function matchesQuery(e: MapEntry, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  return [e.subject, e.id, e.la, e.label].some((s) => fold(s).includes(q));
}

const typologyKey = (e: MapEntry) => e.typology ?? NO_TYPOLOGY;
const typologyOk = (e: MapEntry, f: MapFilters) => !f.hiddenTypologies.has(typologyKey(e));
const countryOk = (e: MapEntry, f: MapFilters) => f.countries.size === 0 || f.countries.has(e.country);

export function filterEntries(entries: MapEntry[], f: MapFilters): MapEntry[] {
  return entries.filter((e) => matchesQuery(e, f.query) && typologyOk(e, f) && countryOk(e, f));
}

function tally(entries: MapEntry[], key: (e: MapEntry) => string): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of entries) out.set(key(e), (out.get(key(e)) ?? 0) + 1);
  return out;
}

const typologyRank = (t: string) => (t === NO_TYPOLOGY ? Infinity : TYPOLOGY_ORDER.indexOf(t) + 1 || TYPOLOGY_ORDER.length + 1);

/**
 * How many eulogies each typology and each country would show: each facet is counted under the
 * search and the other facet, not its own, so every choice says what it would yield.
 * Typologies in crmedr's order ("none" last); countries by code.
 */
export function facetCounts(entries: MapEntry[], f: MapFilters): { typologies: [string, number][]; countries: [string, number][] } {
  const searched = entries.filter((e) => matchesQuery(e, f.query));
  const typologies = [...tally(searched.filter((e) => countryOk(e, f)), typologyKey)].sort(
    ([a], [b]) => typologyRank(a) - typologyRank(b),
  );
  const countries = [...tally(searched.filter((e) => typologyOk(e, f)), (e) => e.country)].sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return { typologies, countries };
}

/** "dies_natalis" → "Dies natalis". */
export function typologyLabel(t: string | null): string {
  if (t === null || t === NO_TYPOLOGY) return "Not classified";
  const s = t.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
```

Note: `facetCounts` sorts countries by code; the sidebar re-sorts them by display name (Task 3). The test's `["GB","IT","TR"]` expectation is by code.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/map-data.test.ts`
Expected: PASS. Also `npx tsc --noEmit` — no errors (`resolveJsonModule` is already used by `lib/snapshot.ts`).

- [ ] **Step 5: Commit**

```bash
git add lib/places.ts lib/map-data.ts lib/__tests__/map-data.test.ts
git commit -m "feat: map data — an edition's eulogies at their places, searched and filtered

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: MapSidebar

**Files:**
- Create: `components/MapSidebar.tsx`
- Test: `components/__tests__/MapSidebar.test.tsx`

**Interfaces:**
- Consumes: `MapEntry`, `MapFilters`, `facetCounts` return shape, `typologyLabel`, `NO_TYPOLOGY` (Task 2); `EditionOut` (`lib/types`); `yearAndLanguage`, `natureLabel` (`lib/editions`).
- Produces: default export `MapSidebar` with props:

```ts
interface Props {
  editions: EditionOut[];
  edition: string;
  onEdition: (id: string) => void;
  filters: MapFilters;
  onFilters: (f: MapFilters) => void;
  facets: { typologies: [string, number][]; countries: [string, number][] };
  /** The filtered eulogies, or those at the clicked place when `place` is set. */
  results: MapEntry[];
  mapped: number;
  unmapped: number;
  /** The place whose eulogies the list shows (a single-place cluster was clicked), or null. */
  place: { label: string; count: number } | null;
  onShowAll: () => void;
  selected: string | null;
  onSelect: (id: string) => void;
  /** Null while loading; a message when the catalog failed. */
  status: { loading: boolean; error: string | null };
  onRetry: () => void;
}
```

- [ ] **Step 1: Write the failing tests** — `components/__tests__/MapSidebar.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import MapSidebar from "@/components/MapSidebar";
import type { MapEntry, MapFilters } from "@/lib/map-data";
import type { EditionOut } from "@/lib/types";

const edition = (id: string, year: number, locale: string, nature = "editio_typica"): EditionOut => ({
  edition_id: id, book: "mr", year, nature, scope: {}, locale, promulgation: {},
  governance: { governing_body: "x", type: "x" }, availability: { status: "public" },
});
const editions = [edition("mr_2004", 2004, "la"), edition("mr_1914_en", 1914, "en", "translation")];

const entry = (id: string, subject: string, label: string): MapEntry => ({
  id, subject, day: { mm: 1, dd: 1 }, entry: 1, qid: "Q1", la: "Romæ", label, country: "IT", coords: [0, 0], typology: "dies_natalis",
});
const results = [entry("mr:0101-almachius", "Sanctus Almachius", "Rome"), entry("mr:0102-x", "Sanctus X", "Rome")];
const filters: MapFilters = { query: "", hiddenTypologies: new Set(), countries: new Set() };

function setup(over: Partial<React.ComponentProps<typeof MapSidebar>> = {}) {
  const props: React.ComponentProps<typeof MapSidebar> = {
    editions, edition: "mr_2004", onEdition: vi.fn(), filters, onFilters: vi.fn(),
    facets: { typologies: [["dies_natalis", 2], ["none", 1]], countries: [["IT", 2], ["DE", 1]] },
    results, mapped: 3, unmapped: 5, place: null, onShowAll: vi.fn(), selected: null, onSelect: vi.fn(),
    status: { loading: false, error: null }, onRetry: vi.fn(), ...over,
  };
  render(<MapSidebar {...props} />);
  return props;
}

describe("MapSidebar", () => {
  it("chooses the edition", () => {
    const p = setup();
    fireEvent.change(screen.getByLabelText("Edition"), { target: { value: "mr_1914_en" } });
    expect(p.onEdition).toHaveBeenCalledWith("mr_1914_en");
  });

  it("searches", () => {
    const p = setup();
    fireEvent.change(screen.getByLabelText("Search subject or ID"), { target: { value: "alm" } });
    expect(p.onFilters).toHaveBeenCalledWith({ ...filters, query: "alm" });
  });

  it("unchecking a typology hides it", () => {
    const p = setup();
    const box = screen.getByRole("checkbox", { name: /Dies natalis/ });
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(p.onFilters).toHaveBeenCalledWith({ ...filters, hiddenTypologies: new Set(["dies_natalis"]) });
    expect(screen.getByRole("checkbox", { name: /Not classified/ })).toBeInTheDocument();
  });

  it("lists countries by name with counts, and checking one selects it", () => {
    const p = setup();
    const group = screen.getByRole("group", { name: "Country" });
    const labels = within(group).getAllByRole("checkbox").map((b) => b.closest("label")!.textContent);
    expect(labels).toEqual(["Germany (1)", "Italy (2)"]);
    fireEvent.click(within(group).getByRole("checkbox", { name: /Italy/ }));
    expect(p.onFilters).toHaveBeenCalledWith({ ...filters, countries: new Set(["IT"]) });
  });

  it("narrows the country list by name", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Filter countries"), { target: { value: "ger" } });
    const group = screen.getByRole("group", { name: "Country" });
    expect(within(group).getAllByRole("checkbox")).toHaveLength(1);
  });

  it("summarises and lists the results; a click selects", () => {
    const p = setup();
    expect(screen.getByText("2 shown · 3 mapped · 5 not mapped in this edition")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Sanctus Almachius/ }));
    expect(p.onSelect).toHaveBeenCalledWith("mr:0101-almachius");
  });

  it("lists a place's eulogies with a way back", () => {
    const p = setup({ place: { label: "Rome", count: 2 } });
    expect(screen.getByRole("heading", { name: "Rome — 2 eulogies" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(p.onShowAll).toHaveBeenCalled();
  });

  it("says when nothing matches", () => {
    setup({ results: [] });
    expect(screen.getByText("No eulogy matches these filters.")).toBeInTheDocument();
  });

  it("offers a retry when the catalog failed", () => {
    const p = setup({ status: { loading: false, error: "Could not load this edition's eulogies." } });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(p.onRetry).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run components/__tests__/MapSidebar.test.tsx`
Expected: FAIL — cannot resolve `@/components/MapSidebar`.

- [ ] **Step 3: Implement** — `components/MapSidebar.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { natureLabel, sortForShelf, yearAndLanguage } from "@/lib/editions";
import { typologyLabel, type MapEntry, type MapFilters } from "@/lib/map-data";
import type { EditionOut } from "@/lib/types";

interface Props {
  editions: EditionOut[];
  edition: string;
  onEdition: (id: string) => void;
  filters: MapFilters;
  onFilters: (f: MapFilters) => void;
  facets: { typologies: [string, number][]; countries: [string, number][] };
  /** The filtered eulogies, or those at the clicked place when `place` is set. */
  results: MapEntry[];
  mapped: number;
  unmapped: number;
  /** The place whose eulogies the list shows (a single-place cluster was clicked), or null. */
  place: { label: string; count: number } | null;
  onShowAll: () => void;
  selected: string | null;
  onSelect: (id: string) => void;
  status: { loading: boolean; error: string | null };
  onRetry: () => void;
}

// The results list is a way into the map, not the whole catalog: past this, narrow the search.
const MAX_ROWS = 300;

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code || "Unknown";
  }
}

const INPUT = "w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900";

function toggle(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** The map's controls and results: edition, search, typology and country filters, and the eulogies shown. */
export default function MapSidebar(p: Props) {
  const [countryQuery, setCountryQuery] = useState("");
  const countries = useMemo(
    () =>
      p.facets.countries
        .map(([code, n]) => ({ code, n, name: countryName(code) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [p.facets.countries],
  );
  const cq = countryQuery.trim().toLowerCase();
  const shownCountries = countries.filter((c) => !cq || c.name.toLowerCase().includes(cq) || p.filters.countries.has(c.code));

  return (
    <aside className="flex flex-col gap-4 overflow-y-auto p-4 text-sm">
      <label className="flex flex-col gap-1">
        <span className="font-medium">Edition</span>
        <select className={INPUT} value={p.edition} onChange={(e) => p.onEdition(e.target.value)}>
          {sortForShelf(p.editions).map((e) => (
            <option key={e.edition_id} value={e.edition_id}>
              {yearAndLanguage(e)} — {natureLabel(e.nature)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-medium">Search subject or ID</span>
        <input
          type="search"
          className={INPUT}
          value={p.filters.query}
          placeholder="Sanctus…, mr:0101-…, Rome"
          onChange={(e) => p.onFilters({ ...p.filters, query: e.target.value })}
        />
      </label>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-medium">Typology</legend>
        {p.facets.typologies.map(([t, n]) => (
          <label key={t} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!p.filters.hiddenTypologies.has(t)}
              onChange={() => p.onFilters({ ...p.filters, hiddenTypologies: toggle(p.filters.hiddenTypologies, t) })}
            />
            {typologyLabel(t)} ({n})
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-medium">Country</legend>
        <input
          type="search"
          aria-label="Filter countries"
          className={INPUT}
          value={countryQuery}
          placeholder="Filter countries"
          onChange={(e) => setCountryQuery(e.target.value)}
        />
        <div className="max-h-48 overflow-y-auto">
          {shownCountries.map((c) => (
            <label key={c.code} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={p.filters.countries.has(c.code)}
                onChange={() => p.onFilters({ ...p.filters, countries: toggle(p.filters.countries, c.code) })}
              />
              {c.name} ({c.n})
            </label>
          ))}
        </div>
        {p.filters.countries.size > 0 && (
          <button
            type="button"
            className="self-start text-xs text-blue-700 underline dark:text-blue-400"
            onClick={() => p.onFilters({ ...p.filters, countries: new Set() })}
          >
            All countries
          </button>
        )}
      </fieldset>

      {p.status.error ? (
        <p className="text-red-700 dark:text-red-400">
          {p.status.error}{" "}
          <button type="button" className="underline" onClick={p.onRetry}>
            Retry
          </button>
        </p>
      ) : p.status.loading ? (
        <p className="italic text-slate-500 dark:text-slate-400">Loading…</p>
      ) : (
        <>
          <p className="text-slate-600 dark:text-slate-400">
            {p.results.length} shown · {p.mapped} mapped · {p.unmapped} not mapped in this edition
          </p>
          {p.place && (
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-semibold">
                {p.place.label} — {p.place.count} eulogies
              </h2>
              <button type="button" className="text-xs text-blue-700 underline dark:text-blue-400" onClick={p.onShowAll}>
                Show all
              </button>
            </div>
          )}
          {p.results.length === 0 ? (
            <p className="italic text-slate-500 dark:text-slate-400">No eulogy matches these filters.</p>
          ) : (
            <ul className="flex flex-col">
              {p.results.slice(0, MAX_ROWS).map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    aria-current={p.selected === e.id ? "true" : undefined}
                    className={`w-full rounded px-2 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${
                      p.selected === e.id ? "bg-slate-200 dark:bg-slate-700" : ""
                    }`}
                    onClick={() => p.onSelect(e.id)}
                  >
                    <span className="block">{e.subject}</span>
                    <span className="block font-mono text-xs text-slate-500 dark:text-slate-400">
                      {e.id} · {e.label}
                    </span>
                  </button>
                </li>
              ))}
              {p.results.length > MAX_ROWS && (
                <li className="px-2 py-1 italic text-slate-500 dark:text-slate-400">
                  and {p.results.length - MAX_ROWS} more — narrow the search to list them.
                </li>
              )}
            </ul>
          )}
        </>
      )}
    </aside>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/__tests__/MapSidebar.test.tsx`
Expected: PASS. If the `"Germany (1)"` assertion fails on whitespace from JSX, keep the JSX as `{c.name} ({c.n})` on one line (it renders `Germany (1)`).

- [ ] **Step 5: Commit**

```bash
git add components/MapSidebar.tsx components/__tests__/MapSidebar.test.tsx
git commit -m "feat: map sidebar — edition, search, typology and country filters, results

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: EulogyMap (Leaflet + clusters)

**Files:**
- Modify: `package.json`, `package-lock.json` (dependencies)
- Create: `components/EulogyMap.tsx`
- Test: `components/__tests__/EulogyMap.test.tsx`

**Interfaces:**
- Consumes: `MapEntry` (Task 2); `dayPath` (`lib/calendar`); `typologyLabel` (Task 2).
- Produces: default export `EulogyMap` with props `{ entries: MapEntry[]; edition: string; selected: string | null; onSelect: (id: string) => void; onPlace: (qid: string) => void }`.

- [ ] **Step 1: Add the dependencies**

Run: `npm install leaflet.markercluster@^1.5.3 && npm install -D @types/leaflet.markercluster`
Expected: both in `package.json`; `npm ls leaflet.markercluster` shows 1.5.3.

- [ ] **Step 2: Write the failing test** — `components/__tests__/EulogyMap.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import EulogyMap from "@/components/EulogyMap";
import type { MapEntry } from "@/lib/map-data";

type Fn = (...a: unknown[]) => void;
interface FakeMarker { latlng: [number, number]; popup?: HTMLElement; handlers: Record<string, Fn>; opened: number }
const groups: { layers: FakeMarker[]; handlers: Record<string, Fn>; opts: Record<string, unknown> }[] = [];
const fitBounds = vi.fn();
const remove = vi.fn();
const zoomToShowLayer = vi.fn((m: FakeMarker, cb: () => void) => cb());

vi.mock("leaflet", () => {
  const map = () => ({ fitBounds, setView: vi.fn(), remove });
  const tileLayer = () => ({ addTo: () => undefined });
  const circleMarker = (latlng: [number, number]) => {
    const m: FakeMarker & Record<string, unknown> = {
      latlng, handlers: {}, opened: 0,
      bindPopup(el: HTMLElement) { m.popup = el; return m; },
      on(ev: string, fn: Fn) { m.handlers[ev] = fn; return m; },
      openPopup() { m.opened++; return m; },
      getLatLng() { return { lat: latlng[0], lng: latlng[1], equals: (o: { lat: number; lng: number }) => o.lat === latlng[0] && o.lng === latlng[1] }; },
      setStyle() { return m; },
    };
    return m;
  };
  const markerClusterGroup = (opts: Record<string, unknown>) => {
    const g = {
      layers: [] as FakeMarker[], handlers: {} as Record<string, Fn>, opts,
      addTo() { groups.push(g); return g; },
      addLayers(ls: FakeMarker[]) { g.layers.push(...ls); return g; },
      clearLayers() { g.layers.length = 0; return g; },
      on(ev: string, fn: Fn) { g.handlers[ev] = fn; return g; },
      zoomToShowLayer,
    };
    return g;
  };
  const L = { map, tileLayer, circleMarker, markerClusterGroup };
  return { default: L, ...L };
});
vi.mock("leaflet.markercluster", () => ({}));

const e = (id: string, qid: string, coords: [number, number]): MapEntry => ({
  id, subject: `Subject ${id}`, day: { mm: 1, dd: 2 }, entry: 1, qid, la: "Romæ", label: "Rome", country: "IT", coords, typology: "dies_natalis",
});
const entries = [e("mr:0102-a", "Q220", [41.9, 12.5]), e("mr:0102-b", "Q220", [41.9, 12.5]), e("mr:0102-c", "Q84", [51.5, -0.1])];

describe("EulogyMap", () => {
  beforeEach(() => {
    groups.length = 0;
    fitBounds.mockClear();
    remove.mockClear();
    zoomToShowLayer.mockClear();
  });

  it("puts one marker per eulogy in a cluster group and fits them", async () => {
    const { unmount } = render(<EulogyMap entries={entries} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={vi.fn()} />);
    await waitFor(() => expect(groups[0]?.layers).toHaveLength(3));
    expect(groups[0].opts).toMatchObject({ zoomToBoundsOnClick: false, spiderfyOnMaxZoom: false });
    expect(fitBounds).toHaveBeenCalled();
    unmount();
    expect(remove).toHaveBeenCalled();
  });

  it("a marker's popup links to the eulogy in the reader", async () => {
    render(<EulogyMap entries={entries} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={vi.fn()} />);
    await waitFor(() => expect(groups[0]?.layers).toHaveLength(3));
    const popup = groups[0].layers[0].popup!;
    expect(popup.textContent).toContain("Subject mr:0102-a");
    expect(popup.querySelector("a[data-read]")!.getAttribute("href")).toBe("/read/mr_2004/01/02#mr:0102-a");
  });

  it("clicking a marker selects its eulogy", async () => {
    const onSelect = vi.fn();
    render(<EulogyMap entries={entries} edition="mr_2004" selected={null} onSelect={onSelect} onPlace={vi.fn()} />);
    await waitFor(() => expect(groups[0]?.layers).toHaveLength(3));
    groups[0].layers[2].handlers.click();
    expect(onSelect).toHaveBeenCalledWith("mr:0102-c");
  });

  it("a cluster at one place lists that place; a mixed cluster zooms in", async () => {
    const onPlace = vi.fn();
    render(<EulogyMap entries={entries} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={onPlace} />);
    await waitFor(() => expect(groups[0]?.layers).toHaveLength(3));
    const [a, b, c] = groups[0].layers;
    const zoomToBounds = vi.fn();
    groups[0].handlers.clusterclick({ layer: { getAllChildMarkers: () => [a, b], zoomToBounds } });
    expect(onPlace).toHaveBeenCalledWith("Q220");
    expect(zoomToBounds).not.toHaveBeenCalled();
    groups[0].handlers.clusterclick({ layer: { getAllChildMarkers: () => [a, c], zoomToBounds } });
    expect(zoomToBounds).toHaveBeenCalled();
  });

  it("selecting a eulogy reveals and opens its marker", async () => {
    const { rerender } = render(<EulogyMap entries={entries} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={vi.fn()} />);
    await waitFor(() => expect(groups[0]?.layers).toHaveLength(3));
    rerender(<EulogyMap entries={entries} edition="mr_2004" selected="mr:0102-c" onSelect={vi.fn()} onPlace={vi.fn()} />);
    await waitFor(() => expect(zoomToShowLayer).toHaveBeenCalled());
    expect(groups[0].layers[2].opened).toBe(1);
  });

  it("new entries replace the markers in the same group", async () => {
    const { rerender } = render(<EulogyMap entries={entries} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={vi.fn()} />);
    await waitFor(() => expect(groups[0]?.layers).toHaveLength(3));
    rerender(<EulogyMap entries={entries.slice(2)} edition="mr_2004" selected={null} onSelect={vi.fn()} onPlace={vi.fn()} />);
    await waitFor(() => expect(groups[0].layers).toHaveLength(1));
    expect(groups).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run components/__tests__/EulogyMap.test.tsx`
Expected: FAIL — cannot resolve `@/components/EulogyMap`.

- [ ] **Step 4: Implement** — `components/EulogyMap.tsx`:

```tsx
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

const MARKER = { color: "#7f1d1d", fillColor: "#b91c1c", radius: 6, weight: 2, fillOpacity: 0.85 };

/** The popup: subject, ID, typology, place as printed and on Wikidata, and a link into the reader. Built as DOM, not HTML, so no text is parsed as markup. */
function popupFor(e: MapEntry, edition: string): HTMLElement {
  const el = (tag: string, text?: string, cls?: string) => {
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
  const wd = el("a", e.label) as HTMLAnchorElement;
  wd.href = `https://www.wikidata.org/wiki/${e.qid}`;
  wd.target = "_blank";
  wd.rel = "noreferrer";
  place.append(wd);
  root.append(place);
  const read = el("a", "Read") as HTMLAnchorElement;
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
  const [ready, setReady] = useState<{ L: typeof import("leaflet"); map: LeafletMap; group: MarkerClusterGroup } | null>(null);
  const markers = useRef(new Map<string, CircleMarker>());
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
      (window as unknown as { L: typeof L }).L = L;
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
        const cluster = (ev as unknown as { layer: { getAllChildMarkers(): CircleMarker[]; zoomToBounds(): void } }).layer;
        const children = cluster.getAllChildMarkers();
        const first = children[0].getLatLng();
        if (children.every((m) => m.getLatLng().equals(first))) {
          const qid = (children[0] as CircleMarker & { qid?: string }).qid;
          if (qid) onPlaceRef.current(qid);
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
      const m = L.circleMarker(e.coords, MARKER)
        .bindPopup(popupFor(e, edition))
        .on("click", () => onSelectRef.current(e.id)) as CircleMarker & { qid?: string };
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
```

Notes for the implementer:
- `@types/leaflet.markercluster` augments the `leaflet` module with `MarkerClusterGroup` and `L.markerClusterGroup`; `tsconfig.json` has no `types` restriction, so the augmentation applies without an import. Do not add a static `import "leaflet.markercluster"`: it touches `window` during server rendering.
- `qid` is stashed on the marker object so the cluster handler can name the place.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run components/__tests__/EulogyMap.test.tsx && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json components/EulogyMap.tsx components/__tests__/EulogyMap.test.tsx
git commit -m "feat: eulogy map — clustered markers, popups into the reader, single-place clusters

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: MapPage, route and header link

**Files:**
- Create: `components/MapPage.tsx`, `app/map/page.tsx`
- Modify: `components/SiteHeader.tsx`
- Test: `components/__tests__/MapPage.test.tsx`, `components/__tests__/SiteHeader.test.tsx`

**Interfaces:**
- Consumes: `getEditions`, `getCatalog`, `ApiError` (`lib/api`); `editionLang`, `isOriginal`, `sortForShelf` (`lib/editions`); `getPlaces` (Task 2); `mapEntries`, `filterEntries`, `facetCounts`, `MapFilters`, `MapEntry` (Task 2); `MapSidebar` (Task 3); `EulogyMap` (Task 4).
- Produces: default export `MapPage({ initialEdition }: { initialEdition: string | null })`; route `/map`; exported `defaultEdition(editions: EditionOut[]): string | null`.

- [ ] **Step 1: Write the failing tests** — `components/__tests__/MapPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MapPage, { defaultEdition } from "@/components/MapPage";
import type { CatalogEntryOut, EditionOut } from "@/lib/types";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

// The map itself is Leaflet's business (EulogyMap.test); here it reports what it was given.
vi.mock("@/components/EulogyMap", () => ({
  default: ({ entries }: { entries: { id: string }[] }) => <div data-testid="map">{entries.map((e) => e.id).join(",")}</div>,
}));

vi.mock("@/lib/places", () => ({
  getPlaces: () => ({
    places: { Q220: { label: "Rome", country: "IT", coords: [41.9, 12.5] }, Q84: { label: "London", country: "GB", coords: [51.5, -0.1] } },
    eulogies: {
      "mr:0101-a": { place: "Q220", la: "Romæ", typology: "dies_natalis" },
      "mr:0101-b": { place: "Q84", la: "Londínii", typology: "dies_natalis" },
    },
  }),
}));

const getEditions = vi.fn();
const getCatalog = vi.fn();
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getEditions: () => getEditions(),
  getCatalog: (ed: string, loc: string) => getCatalog(ed, loc),
}));

const ed = (id: string, year: number, locale: string, nature: string): EditionOut => ({
  edition_id: id, book: "mr", year, nature, scope: {}, locale, promulgation: {},
  governance: { governing_body: "x", type: "x" }, availability: { status: "public" },
});
const editions = [
  ed("mr_2004_it", 2004, "it_IT", "editio_vernacula"),
  ed("mr_2004", 2004, "la", "editio_typica_altera"),
  ed("mr_1914_en", 1914, "en", "translation"),
];
const cat = (id: string): CatalogEntryOut => ({ id, subject: `S ${id}`, anchor_day: "01-01", deprecated: false, present: true, day_printed: "01-01", entry: 1 });

describe("defaultEdition", () => {
  it("is the newest Latin editio typica", () => {
    expect(defaultEdition(editions)).toBe("mr_2004");
  });
});

describe("MapPage", () => {
  beforeEach(() => {
    replace.mockClear();
    getEditions.mockReset().mockResolvedValue(editions);
    getCatalog.mockReset().mockResolvedValue([cat("mr:0101-a"), cat("mr:0101-b")]);
  });

  it("loads the default edition's catalog in its language and maps it", async () => {
    render(<MapPage initialEdition={null} />);
    await waitFor(() => expect(screen.getByTestId("map")).toHaveTextContent("mr:0101-a,mr:0101-b"));
    expect(getCatalog).toHaveBeenCalledWith("mr_2004", "la");
  });

  it("an unknown ?edition= falls back to the default", async () => {
    render(<MapPage initialEdition="nope" />);
    await waitFor(() => expect(getCatalog).toHaveBeenCalledWith("mr_2004", "la"));
  });

  it("a known ?edition= is used, in that edition's language", async () => {
    render(<MapPage initialEdition="mr_1914_en" />);
    await waitFor(() => expect(getCatalog).toHaveBeenCalledWith("mr_1914_en", "en"));
  });

  it("choosing an edition reloads, puts it in the address and clears the filters", async () => {
    render(<MapPage initialEdition={null} />);
    await waitFor(() => expect(screen.getByTestId("map")).toHaveTextContent("mr:0101-b"));
    fireEvent.click(screen.getByRole("checkbox", { name: /United Kingdom/ }));
    await waitFor(() => expect(screen.getByTestId("map")).toHaveTextContent(/^mr:0101-b$/));
    getCatalog.mockResolvedValue([cat("mr:0101-a")]);
    fireEvent.change(screen.getByLabelText("Edition"), { target: { value: "mr_2004_it" } });
    expect(replace).toHaveBeenCalledWith("/map?edition=mr_2004_it", { scroll: false });
    await waitFor(() => expect(getCatalog).toHaveBeenCalledWith("mr_2004_it", "it"));
    await waitFor(() => expect(screen.getByTestId("map")).toHaveTextContent(/^mr:0101-a$/));
    expect(screen.getByRole("checkbox", { name: /Italy/ })).not.toBeChecked();
  });

  it("searching narrows the map", async () => {
    render(<MapPage initialEdition={null} />);
    await waitFor(() => expect(screen.getByTestId("map")).toHaveTextContent("mr:0101-b"));
    fireEvent.change(screen.getByLabelText("Search subject or ID"), { target: { value: "london" } });
    await waitFor(() => expect(screen.getByTestId("map")).toHaveTextContent(/^mr:0101-b$/));
  });

  it("a failed catalog offers a retry that refetches", async () => {
    getCatalog.mockRejectedValueOnce(new Error("boom"));
    render(<MapPage initialEdition={null} />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByTestId("map")).toHaveTextContent("mr:0101-a"));
    expect(getCatalog).toHaveBeenCalledTimes(2);
  });
});
```

Append inside the `describe("SiteHeader")` block of `components/__tests__/SiteHeader.test.tsx` (it already mocks `getViewer` as `viewerMock`):

```tsx
  it("links the map for everyone, signed in or not", async () => {
    viewerMock.mockResolvedValue({ signedIn: false, curator: false });
    render(await SiteHeader());
    expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map");
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run components/__tests__/MapPage.test.tsx components/__tests__/SiteHeader.test.tsx`
Expected: FAIL — cannot resolve `@/components/MapPage`; no "Map" link.

- [ ] **Step 3: Implement** — `components/MapPage.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import EulogyMap from "@/components/EulogyMap";
import MapSidebar from "@/components/MapSidebar";
import { getCatalog, getEditions } from "@/lib/api";
import { describeError } from "@/lib/describe-error";
import { editionLang, isOriginal, sortForShelf } from "@/lib/editions";
import { facetCounts, filterEntries, mapEntries, type MapEntry, type MapFilters } from "@/lib/map-data";
import { getPlaces } from "@/lib/places";
import type { EditionOut } from "@/lib/types";

const NO_FILTERS: MapFilters = { query: "", hiddenTypologies: new Set(), countries: new Set() };

/** The newest Latin editio typica, else the newest available edition. */
export function defaultEdition(editions: EditionOut[]): string | null {
  const shelf = sortForShelf(editions.filter((e) => e.availability.status !== "unavailable"));
  return (shelf.find(isOriginal) ?? shelf[0])?.edition_id ?? null;
}

/** The map of an edition's eulogies: the sidebar's choices narrow the map and the list together. */
export default function MapPage({ initialEdition }: { initialEdition: string | null }) {
  const router = useRouter();
  const [editions, setEditions] = useState<EditionOut[]>([]);
  const [edition, setEdition] = useState<string | null>(null);
  const [mapped, setMapped] = useState<{ entries: MapEntry[]; unmapped: number }>({ entries: [], unmapped: 0 });
  const [filters, setFilters] = useState<MapFilters>(NO_FILTERS);
  const [place, setPlace] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Retry refetches whichever failed: the editions (nothing loaded yet) or the catalog.
  const [editionsTry, setEditionsTry] = useState(0);
  const [catalogTry, setCatalogTry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getEditions()
      .then((eds) => {
        if (cancelled) return;
        setEditions(eds);
        setEdition(eds.some((e) => e.edition_id === initialEdition) ? initialEdition : defaultEdition(eds));
      })
      .catch((err) => {
        console.error(`map: editions: ${describeError(err)}`);
        if (!cancelled) {
          setError("Could not load the editions.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // Once per page (and per retry): router.replace hands a new initialEdition after the
    // reader picks an edition, which is already chosen and must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editionsTry]);

  useEffect(() => {
    if (!edition) return;
    const e = editions.find((x) => x.edition_id === edition);
    if (!e) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCatalog(edition, editionLang(e))
      .then((catalog) => {
        if (!cancelled) setMapped(mapEntries(catalog, getPlaces()));
      })
      .catch((err) => {
        console.error(`map: catalog ${edition}: ${describeError(err)}`);
        if (!cancelled) setError("Could not load this edition's eulogies.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [edition, editions, catalogTry]);

  const chooseEdition = (id: string) => {
    setEdition(id);
    setFilters(NO_FILTERS);
    setPlace(null);
    setSelected(null);
    router.replace(`/map?edition=${encodeURIComponent(id)}`, { scroll: false });
  };

  const changeFilters = (f: MapFilters) => {
    setFilters(f);
    setPlace(null);
  };

  const filtered = useMemo(() => filterEntries(mapped.entries, filters), [mapped, filters]);
  const facets = useMemo(() => facetCounts(mapped.entries, filters), [mapped, filters]);
  const atPlace = useMemo(() => (place ? filtered.filter((e) => e.qid === place) : null), [filtered, place]);
  const onPlace = useCallback((qid: string) => setPlace(qid), []);
  const onSelect = useCallback((id: string) => setSelected(id), []);

  return (
    <div className="flex h-[calc(100dvh-4.5rem)] min-h-[32rem] flex-col md:flex-row">
      {/* One sidebar: a "Filters" disclosure above the map on narrow screens, a fixed column beside it from md up. */}
      <details
        open
        className="shrink-0 border-b border-slate-200 md:w-80 md:overflow-y-auto md:border-r md:border-b-0 dark:border-slate-800"
      >
        <summary className="cursor-pointer px-4 py-2 text-sm font-medium md:hidden">Filters</summary>
        <div className="max-h-[50dvh] overflow-y-auto md:max-h-none">{sidebar()}</div>
      </details>
      <div className="flex-1">
        {edition && (
          <EulogyMap entries={filtered} edition={edition} selected={selected} onSelect={onSelect} onPlace={onPlace} />
        )}
      </div>
    </div>
  );

  function sidebar() {
    return (
      <MapSidebar
        editions={editions}
        edition={edition ?? ""}
        onEdition={chooseEdition}
        filters={filters}
        onFilters={changeFilters}
        facets={facets}
        results={atPlace ?? filtered}
        mapped={mapped.entries.length}
        unmapped={mapped.unmapped}
        place={atPlace && atPlace.length > 0 ? { label: atPlace[0].label, count: atPlace.length } : null}
        onShowAll={() => setPlace(null)}
        selected={selected}
        onSelect={onSelect}
        status={{ loading, error }}
        onRetry={() => (editions.length ? setCatalogTry((n) => n + 1) : setEditionsTry((n) => n + 1))}
      />
    );
  }
}
```

The sidebar renders once (tests find a single "Edition" control). On desktop the summary is hidden; if a reader collapsed the disclosure on a narrow screen and then widened the window, the sidebar stays collapsed until reloaded — acceptable.

`app/map/page.tsx`:

```tsx
import MapPage from "@/components/MapPage";

export const metadata = { title: "Map — Roman Martyrology" };

export default async function MapRoute({ searchParams }: { searchParams: Promise<{ edition?: string | string[] }> }) {
  const { edition } = await searchParams;
  return <MapPage initialEdition={typeof edition === "string" ? edition : null} />;
}
```

`components/SiteHeader.tsx` — in the `<nav>`, before the curator links:

```tsx
          <Link href="/map">Map</Link>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/__tests__/MapPage.test.tsx components/__tests__/SiteHeader.test.tsx`
Expected: PASS.

Run the whole suite and lint: `npm test && npm run lint && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add components/MapPage.tsx app/map/page.tsx components/SiteHeader.tsx components/__tests__/MapPage.test.tsx components/__tests__/SiteHeader.test.tsx
git commit -m "feat: /map — an edition's eulogies on a map, searchable and filtered by typology and country

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Browser check

**Files:** none (fix-ups only, committed with the task they belong to)

- [ ] **Step 1: Start the app** against the local API (`docker compose up -d` for martyrology-api if not running; `npm run dev`).
- [ ] **Step 2: Check in a browser at `/map`:**
  - Default edition is the Latin 2004; clusters cover Europe, the Middle East, the Americas, East Asia.
  - Clicking the Rome cluster (zoom to Italy first) lists "Rome — N eulogies" in the sidebar; "Show all" returns.
  - Clicking a result zooms to the marker and opens its popup; "Read" lands on the reader day with the eulogy highlighted.
  - Search "caecilia" narrows to Cecilia; typology unchecks and country checks narrow both map and list; counts change.
  - Switch to the 1749 edition: URL becomes `/map?edition=martyrologium_romanum_1749`, filters reset, "not mapped" count is large (deprecated IDs).
  - Narrow window (< 768px): "Filters" disclosure above the map; map still fills the rest.
  - Dark mode: sidebar readable; cluster bubbles visible.
- [ ] **Step 3:** Fix anything found, re-run `npm test && npm run lint`, commit as `fix: …` with the co-author line.
