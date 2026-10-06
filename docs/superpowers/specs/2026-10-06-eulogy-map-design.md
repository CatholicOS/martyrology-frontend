# Eulogy map — design

## Purpose

A full-page map of where the eulogies of one edition place their saints, now that
crmedr's gazetteer resolves nearly every current eulogy's place to a Wikidata item.
A reader picks an edition, narrows the eulogies by subject/ID search, typology and
country, and goes from a marker to the eulogy in the reader.

## Data

### Sources (crmedr)

- `data/places.json` — places each current eulogy states (`la` as printed, `role`).
- `data/places_curated.json` — hand-curated additions, same shape, merged over `places.json`.
- `data/gazetteer.json` — each printed Latin place → `{wikidata, label, country, status}`.
  No coordinates.
- `data/typology.json` — each current eulogy → one of `dies_natalis`, `depositio`,
  `translatio`, `inventio`, `dedicatio`, `ordinatio`, `celebratio`, `commemoratio`.

Only current (non-deprecated) IDs have places and typology. Eulogies an older edition
prints under deprecated IDs are counted as "not mapped".

### Snapshot

`scripts/snapshot-registry.mjs` gains `buildPlaces(places, curated, gazetteer, typology, coords)`
(pure, unit-tested) and writes `data/places-snapshot.json`:

```json
{
  "places": { "Q220": { "label": "Rome", "country": "IT", "coords": [41.893, 12.483] } },
  "eulogies": { "mr:0101-almachius": { "place": "Q220", "la": "Romæ", "typology": "dies_natalis" } }
}
```

- A eulogy's place is the first of its stated places whose Latin resolves to a Wikidata
  item (in practice every eulogy resolves at most one).
- A eulogy with no resolved place, or whose place has no coordinates, is left out of
  `eulogies`; typology alone is not needed by the map.
- `country` is the gazetteer's (the modern country of the place), not the registry's
  `country` (they differ for 80 eulogies).
- Coordinates (Wikidata P625) are fetched once per snapshot run for all resolved QIDs
  (~1,805) from `https://query.wikidata.org/sparql`, in batches of a few hundred
  `VALUES`, with a descriptive `User-Agent`. An item with several P625 values takes the
  first. QIDs with no coordinates are listed on stdout so they can be fixed on Wikidata.
- If the Wikidata query fails, the script reuses coordinates from the existing
  `data/places-snapshot.json` and says so, so a snapshot run works offline.

## Route

- `app/map/page.tsx` — public (no curator gate); the catalog endpoint carries subjects,
  not texts, so locked editions still map.
- A "Map" link in `SiteHeader` for everyone.
- `?edition=<id>` selects the edition (shareable). Missing or unknown → the newest Latin
  editio typica (first `isOriginal` edition of `sortForShelf`). Changing the edition
  replaces the query string (`router.replace`), without a reload.

## Layout

Full height below the site header: a left sidebar (≈20rem) and the map filling the rest.
Below the `md` breakpoint the sidebar stacks above the map, collapsible ("Filters").

### Sidebar (top to bottom)

1. **Edition** — a `<select>` of all available editions in shelf order
   (`yearAndLanguage` + nature label).
2. **Search** — a text input matching a eulogy's subject (in the edition's language, as
   the catalog returns it) or its ID; case- and diacritic-insensitive substring match.
3. **Typology** — one checkbox per typology present in the edition, with counts; all
   checked by default.
4. **Country** — a checkbox list of the countries present, by name
   (`Intl.DisplayNames(["en"], {type: "region"})`) with counts, sorted by name, with a
   "filter countries" text box above it; none checked means all countries.
5. **Summary** — "N shown · M mapped · K not mapped in this edition".
6. **Results** — the filtered eulogies (subject, ID, place label), sorted by printed day.
   Clicking one flies the map to its marker, opens its popup, and highlights the row.
   When a single-place cluster is clicked (see Map), the list shows that place's
   eulogies under a heading "Rome — 205 eulogies" with a "Show all" button to return.

Counts in typology and country reflect the other active filters (search and the other
facet), so a reader sees what each choice would yield.

### Map

- `components/EulogyMap.tsx`, client only, Leaflet loaded with dynamic `import()` like
  `PlaceMap`, same Esri World Street Map tiles and attribution.
- One `circleMarker` per filtered eulogy, in a `leaflet.markercluster` group (new
  dependencies: `leaflet.markercluster`, `@types/leaflet.markercluster`).
- Clusters split as one zooms. A cluster whose markers all share one coordinate is not
  spiderfied (`spiderfyOnMaxZoom: false`, `zoomToBoundsOnClick` handled by us): clicking
  it lists that place's eulogies in the sidebar.
- When the filtered set changes, markers are replaced (`clearLayers` + `addLayers`,
  chunked) and the map fits their bounds; the first load fits all markers.
- **Popup:** subject, ID (mono), typology, the place as printed (`la`) with its Wikidata
  label linked to wikidata.org, and "Read" → `/read/{edition}/{mm}/{dd}#{id}` from the
  catalog's `day_printed`.

## Components and modules

- `lib/places.ts` — the snapshot's types and loader (`import` of the JSON).
- `lib/map-data.ts` — pure: `mapEntries(catalog, snapshot)` joins the edition's present
  eulogies with places (→ `MapEntry[]` and the unmapped count); `filterEntries(entries,
  {query, typologies, countries})`; `facetCounts(...)`; `matchesQuery(entry, query)`.
- `components/MapPage.tsx` — loads editions and the catalog (`getEditions`,
  `getCatalog(edition, editionLang)`), holds filter and selection state.
- `components/MapSidebar.tsx` — presentational sidebar.
- `components/EulogyMap.tsx` — Leaflet + clustering; props: entries, selected id,
  `onSelect(id)`, `onPlace(qid)`.

## Errors and states

- Editions or catalog loading → a "Loading…" line in the sidebar; the map shows tiles.
- Catalog failure → the reader's retry pattern ("Could not load … Retry").
- No eulogy matches → "No eulogy matches these filters" in the results; map keeps its view.

## Testing

- `buildPlaces` — join, curated override, first-resolved place, missing coords left out
  (Wikidata fetch not exercised; coordinates passed in).
- `lib/map-data` — edition membership (`present`), deprecated IDs counted unmapped,
  search (subject, ID, diacritics), facet filters and counts.
- `MapSidebar` — renders facets and counts, search and checkbox callbacks, place list mode.
- `EulogyMap` — smoke test with Leaflet and markercluster mocked, as `PlaceMap.test`.
- `MapPage` — edition from `?edition=`, fallback default, catalog error retry.
- Manual check in the browser against the local API.

## Out of scope

- Roles other than the eulogy's first resolved place (burial, cult… as separate markers).
- Places for deprecated IDs (1749 / 1914-only eulogies).
- Exposing places/typology through the API.
