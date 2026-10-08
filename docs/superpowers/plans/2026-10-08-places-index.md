# Index of places Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A server-rendered index of places for each edition at `/<locale>/read/<edition>/places`, like a printed book's index: places A–Z, under each the eulogies that name it, with their day, subject, printed form and typology.

**Architecture:** The places snapshot (`data/places-snapshot.json`, built by `scripts/snapshot-registry.mjs` from crmedr and Wikidata) gains place labels in the six interface languages, the Italian printed form, and places without coordinates. A pure `placesIndex()` joins the edition's catalog (fetched from the API on the server, cached hourly) with the snapshot. A server route renders a presentational `PlacesIndex` component. The reader bar and the notes page link to it.

**Tech Stack:** Next.js (App Router; read `node_modules/next/dist/docs/` before writing route code, as AGENTS.md requires), next-intl, React, Vitest + Testing Library, Node ESM script for the snapshot, Wikidata SPARQL.

**Spec:** `docs/superpowers/specs/2026-10-08-places-index-design.md`

## Global Constraints

- Route: `/<locale>/read/<edition>/places`.
- Headings: the place's modern name in the interface language, falling back to English, then to the Wikidata QID; with its country in the interface language (`Intl.DisplayNames`).
- Headings sorted with `Intl.Collator(locale, { sensitivity: "base" })`; a heading's letter is its first letter with accents folded, upper case.
- Lines: one per eulogy, in calendar order (`day_printed`, then entry number); day link `/read/<edition>/MM/DD#<id>`; subject in the edition's language (la, it or en); printed form `la` only for `martyrologium_romanum_2004`, `it` only for `martyrologium_romanum_2004_it_IT`, none otherwise; typology label (existing `Map.typology.*`) unless `dies_natalis`.
- Coverage note "1,407 of the 3,223 eulogies of this edition are placed so far." shown only when not every printed eulogy is placed.
- Catalog fetched on the server from `${API_BASE}/api/v1/elogia?edition=…&locale=…`, `next: { revalidate: 3600 }`.
- Every new interface string is added to all six `messages/*.json` (en, it, fr, de, es, pt); `lib/__tests__/messages.test.ts` requires identical keys and ICU arguments. French puts a U+00A0 no-break space before `:`, as the existing French messages do.
- Comments and naming follow the surrounding code: short doc comments in plain sentences, no comment noise.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv
  ```

## Review Focus

- A heading that starts with an accented, lowercase or non-letter character ("Ōtsu", "ʼs-Hertogenbosch", a bare QID): it belongs under its folded letter, or under "#" when it has no letter; it never makes an empty or duplicate letter section. Test in Task 3.
- An unnumbered eulogy on the same day as numbered ones (the leading celebrations of a day are printed without a number): it comes first on its day, as printed. Test in Task 3.
- A eulogy whose snapshot entry names a QID missing from `places` (an inconsistent snapshot): counted as not placed, no crash. Test in Task 3.
- The API down, or the edition list unreachable, while the page renders: the page shows the error note with a link to try again, never a crash or a 404. Test in Task 6.
- A typology value the messages don't know (crmedr adds a new one): the line shows no label rather than throwing. Test in Task 5.

---

## File Structure

- Modify `scripts/snapshot-registry.mjs`: `buildPlaces` adds `labels`, `it`, keeps places without coordinates; new `fetchLabels`; `main` wires both with the offline fallback.
- Modify `lib/__tests__/snapshot.test.ts`: tests for the above.
- Modify `lib/places.ts`: snapshot types (`labels`, `coords | null`, `it`).
- Modify `lib/map-data.ts`, `lib/__tests__/map-data.test.ts`: the map skips places without coordinates.
- Regenerate `data/places-snapshot.json`.
- Create `lib/places-index.ts`, `lib/__tests__/places-index.test.ts`: the pure join.
- Modify `lib/server-editions.ts`, `lib/__tests__/server-editions.test.ts`: `editionInfo`, `fetchCatalog`.
- Create `components/PlacesIndex.tsx`, `components/__tests__/PlacesIndex.test.tsx`: the page body.
- Modify `messages/{en,it,fr,de,es,pt}.json`: `Places` namespace, `Metadata.placesTitle`, `Reader.placesLink`.
- Create `app/[locale]/read/[edition]/places/page.tsx`, `components/__tests__/PlacesRoute.test.tsx`: the route.
- Modify `components/ReaderBar.tsx`, `components/ApparatusPage.tsx`, their tests: the links.
- Modify the spec: `fetchCatalog` lives in `lib/server-editions.ts`, beside `fetchEditions`, not in `lib/places-index.ts`, so the pure module has no server fetch.

---

### Task 1: Snapshot: labels, Italian form, places without coordinates

**Files:**
- Modify: `scripts/snapshot-registry.mjs` (`firstResolved`, `buildPlaces`, new `fetchLabels`, `main`)
- Modify: `lib/places.ts`
- Modify: `lib/map-data.ts:56-75`
- Test: `lib/__tests__/snapshot.test.ts`, `lib/__tests__/map-data.test.ts`

**Interfaces:**
- Produces: `buildPlaces(placesDoc, gazetteerDoc, typologyDoc, coords, labels = {})` returning `{ places: Record<qid, { label, country, coords: [number, number] | null, labels?: Partial<Record<"en"|"it"|"fr"|"de"|"es"|"pt", string>> }>, eulogies: Record<id, { place, la, it?: string, typology }> }`; `fetchLabels(qids: string[]): Promise<Record<qid, Record<lang, string>>>`; `LABEL_LANGS = ["en", "it", "fr", "de", "es", "pt"]`.
- Produces (TypeScript, `lib/places.ts`): `PlaceInfo { label: string; country: string; coords: [number, number] | null; labels?: Partial<Record<Locale, string>> }` (`Locale` from `@/i18n/routing`); `EulogyPlace { place: string; la: string; it?: string; typology: string | null }`.

- [ ] **Step 1: Write the failing tests** in `lib/__tests__/snapshot.test.ts`, inside `describe("buildPlaces", …)`. Replace the first test (`"gives each eulogy its first resolved place, …"`) with:

```ts
  it("gives each eulogy its first resolved place, its Italian form, typology, and the place's coordinates and labels", () => {
    const labels = { Q220: { en: "Rome", it: "Roma", fr: "Rome" }, Q490: { it: "Milano" } };
    expect(buildPlaces(placesDoc, gazetteerDoc, typologyDoc, coords, labels)).toEqual({
      places: {
        Q220: { label: "Rome", country: "IT", coords: [41.893, 12.483], labels: { en: "Rome", it: "Roma", fr: "Rome" } },
        Q490: { label: "Milan", country: "IT", coords: [45.464, 9.19], labels: { it: "Milano" } },
        Q999: { label: "Island", country: "GR", coords: null },
      },
      eulogies: {
        "mr:0101-almachius": { place: "Q220", la: "Romæ", it: "A Roma", typology: "dies_natalis" },
        "mr:0102-x": { place: "Q490", la: "Mediolani", typology: "depositio" },
        "mr:0104-z": { place: "Q999", la: "Insula", typology: "dies_natalis" },
      },
    });
  });

  it("keeps a place without coordinates, for the index, with null coordinates", () => {
    const snap = buildPlaces(placesDoc, gazetteerDoc, typologyDoc, {});
    expect(snap.places.Q220.coords).toBeNull();
    expect(snap.eulogies["mr:0101-almachius"].place).toBe("Q220");
  });

  it("gives the QID as the label of a place the gazetteer has no label for", () => {
    const snap = buildPlaces(
      { places: { "mr:0101-a": [{ role: "death", la: "Nullibi", source: "lead" }] } },
      { places: { Nullibi: { wikidata: "Q5", status: "auto" } } },
      { typology: {} },
      {},
    );
    expect(snap.places.Q5.label).toBe("Q5");
  });
```

Add a `labelsQuery` test at the end of the file (import `labelsQuery` with the others on line 2):

```ts
describe("labelsQuery", () => {
  it("asks for the labels of the items in the six interface languages", () => {
    const q = labelsQuery(["Q220", "Q490"]);
    expect(q).toContain("VALUES ?item { wd:Q220 wd:Q490 }");
    expect(q).toContain("rdfs:label ?label");
    expect(q).toContain('FILTER(LANG(?label) IN ("en", "it", "fr", "de", "es", "pt"))');
  });
});
```

In `lib/__tests__/map-data.test.ts`, add to `snap.places`: `Q2: { label: "Nowhere", country: "", coords: null },`, to `snap.eulogies`: `"mr:0107-nemo": { place: "Q2", la: "Nusquam", typology: "dies_natalis" },`, to `catalog`: `cat("mr:0107-nemo", "Sanctus Nemo", "01-07"), // placed, but no coordinates: not on the map`, and change the first `mapEntries` test's expectation to `expect(unmapped).toBe(2); // mr:0106-martina has no place, mr:0107-nemo no coordinates; mr:0105-absent is not printed at all`.

- [ ] **Step 2: Run the tests to check they fail**

Run: `npx vitest run lib/__tests__/snapshot.test.ts lib/__tests__/map-data.test.ts`
Expected: FAIL: `labelsQuery` is not exported; `buildPlaces` drops `Q999` and has no `it`/`labels`; `unmapped` is 1, not 2.

- [ ] **Step 3: Implement in `scripts/snapshot-registry.mjs`**

`firstResolved` also returns the Italian form:

```js
function firstResolved(stated, gazetteer) {
  for (const s of stated) {
    const g = gazetteer[s.la];
    if (g?.wikidata) return { la: s.la, it: s.it, qid: g.wikidata, g };
  }
  return null;
}
```

Replace `buildPlaces` and its doc comment:

```js
/**
 * The places of the map and of the index: each current eulogy's place (the first it states that the
 * gazetteer resolves), as the Latin 2004 and the Italian print it, its typology, and each place's
 * label, its labels in the interface languages, modern country and coordinates (null when Wikidata
 * has none: the index lists the place, the map leaves it out).
 * @param {{places: Record<string, StatedPlace[]>}} placesDoc crmedr data/places.json (curated places included)
 * @param {{places: Record<string, GazetteerPlace>}} gazetteerDoc crmedr data/gazetteer.json
 * @param {{typology: Record<string, string>}} typologyDoc crmedr data/typology.json
 * @param {Record<string, [number, number]>} coords [lat, lon] by QID
 * @param {Record<string, Record<string, string>>} [labels] Wikidata labels by QID, then language
 */
export function buildPlaces(placesDoc, gazetteerDoc, typologyDoc, coords, labels = {}) {
  /** @type {Record<string, {label: string, country: string, coords: [number, number] | null, labels?: Record<string, string>}>} */
  const places = {};
  /** @type {Record<string, {place: string, la: string, it?: string, typology: string|null}>} */
  const eulogies = {};
  for (const [id, stated] of Object.entries(placesDoc.places)) {
    const hit = firstResolved(stated, gazetteerDoc.places);
    if (!hit) continue;
    places[hit.qid] ??= {
      label: hit.g.label ?? hit.qid,
      country: hit.g.country ?? "",
      coords: coords[hit.qid] ?? null,
      ...(labels[hit.qid] ? { labels: labels[hit.qid] } : {}),
    };
    eulogies[id] = { place: hit.qid, la: hit.la, ...(hit.it ? { it: hit.it } : {}), typology: typologyDoc.typology[id] ?? null };
  }
  return { places, eulogies };
}
```

After `fetchCoords`, add:

```js
/** The interface languages, whose Wikidata labels head the index of places. */
export const LABEL_LANGS = ["en", "it", "fr", "de", "es", "pt"];

/**
 * The SPARQL query for the labels of `qids` in the interface languages.
 * @param {string[]} qids
 */
export function labelsQuery(qids) {
  const values = qids.map((q) => `wd:${q}`).join(" ");
  const langs = LABEL_LANGS.map((l) => `"${l}"`).join(", ");
  return `SELECT ?item ?label WHERE { VALUES ?item { ${values} } ?item rdfs:label ?label FILTER(LANG(?label) IN (${langs})) }`;
}

/**
 * Each item's label by language, from Wikidata, a few hundred items per query.
 * @param {string[]} qids
 * @returns {Promise<Record<string, Record<string, string>>>}
 */
export async function fetchLabels(qids) {
  /** @type {Record<string, Record<string, string>>} */
  const out = {};
  for (let i = 0; i < qids.length; i += 300) {
    const res = await fetch(SPARQL, {
      method: "POST",
      headers: {
        accept: "application/sparql-results+json",
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": USER_AGENT,
      },
      body: new URLSearchParams({ query: labelsQuery(qids.slice(i, i + 300)) }),
    });
    if (!res.ok) throw new Error(`Wikidata SPARQL ${res.status}`);
    const body = await res.json();
    for (const b of body.results.bindings) {
      const qid = b.item.value.split("/").pop();
      (out[qid] ??= {})[b.label["xml:lang"]] = b.label.value;
    }
  }
  return out;
}
```

In `main`, replace everything from `/** @type {Record<string, [number, number]>} */` / `let coords;` down to the `writeFileSync(placesDest, …)` and its `console.log` with:

```js
  /** @type {Record<string, [number, number]>} */
  let coords;
  /** @type {Record<string, Record<string, string>>} */
  let labels;
  try {
    coords = await fetchCoords(qids);
    labels = await fetchLabels(qids);
  } catch (err) {
    // Offline: the previous snapshot's coordinates and labels, so the rest of the snapshot still updates.
    console.warn(`Wikidata unreachable (${err instanceof Error ? err.message : err}); reusing ${placesDest}`);
    /** @type {{places: Record<string, {coords: [number, number] | null, labels?: Record<string, string>}>}} */
    const prev = JSON.parse(readFileSync(placesDest, "utf8"));
    coords = Object.fromEntries(Object.entries(prev.places).flatMap(([q, p]) => (p.coords ? [[q, p.coords]] : [])));
    labels = Object.fromEntries(Object.entries(prev.places).flatMap(([q, p]) => (p.labels ? [[q, p.labels]] : [])));
  }
  const missing = qids.filter((q) => !coords[q]);
  if (missing.length) console.log(`no coordinates on Wikidata for ${missing.length} places (in the index, not on the map): ${missing.join(" ")}`);
  const places = buildPlaces(placesDoc, gazetteerDoc, typologyDoc, coords, labels);
  const unlabelled = Object.entries(places.places).filter(([q, p]) => p.label === q && !p.labels).map(([q]) => q);
  if (unlabelled.length) console.log(`no label for ${unlabelled.length} places (the index heads them with the QID): ${unlabelled.join(" ")}`);
  writeFileSync(placesDest, JSON.stringify(places) + "\n");
  console.log(`wrote ${placesDest}: ${Object.keys(places.eulogies).length} eulogies at ${Object.keys(places.places).length} places`);
```

- [ ] **Step 4: Update `lib/places.ts`**

```ts
import snapshot from "@/data/places-snapshot.json";
import type { Locale } from "@/i18n/routing";

/** A Wikidata place: its English label, its labels in the interface languages, its modern country (ISO 3166-1 alpha-2) and [lat, lon], null when Wikidata has none. */
export interface PlaceInfo {
  label: string;
  country: string;
  coords: [number, number] | null;
  labels?: Partial<Record<Locale, string>>;
}

/** A current eulogy's place (QID), the place as the Latin 2004 and the Italian print it, and its typology. */
export interface EulogyPlace {
  place: string;
  la: string;
  it?: string;
  typology: string | null;
}
```

(The rest of the file is unchanged.)

- [ ] **Step 5: The map skips places without coordinates.** In `lib/map-data.ts`, `mapEntries`, change the guard and its doc comment:

```ts
/**
 * The eulogies an edition prints (its catalog's `present` entries with a printed day) that have a
 * place on the map, in printed order; `unmapped` counts the printed ones that have none (no
 * resolved place, a place without coordinates, or a deprecated ID, which the gazetteer does not cover).
 */
```

```ts
    const ep = snap.eulogies[c.id];
    const place = ep ? snap.places[ep.place] : undefined;
    if (!ep || !place?.coords) {
      unmapped++;
      continue;
    }
```

and in the pushed entry, `coords: place.coords,` stays (TypeScript narrows it to `[number, number]`).

- [ ] **Step 6: Run the tests and the type check**

Run: `npx vitest run lib/__tests__/snapshot.test.ts lib/__tests__/map-data.test.ts && npx tsc --noEmit`
Expected: PASS, and no type errors. The other `map-data` tests (facets, filters) work on `mapEntries`' entries, which `mr:0107-nemo` is not among; if one of them counts catalog rows directly, update its expected count by one and say why in a comment. If `tsc` reports another place that reads `PlaceInfo.coords` as non-null, guard it the same way and add a test there.

- [ ] **Step 7: Commit**

```bash
git add scripts/snapshot-registry.mjs lib/places.ts lib/map-data.ts lib/__tests__/snapshot.test.ts lib/__tests__/map-data.test.ts
git commit -m "feat(snapshot): place labels in the interface languages, the Italian form, places without coordinates"
```

---

### Task 2: Regenerate the places snapshot

**Files:**
- Modify: `data/places-snapshot.json`

**Interfaces:**
- Consumes: `npm run snapshot-registry` (Task 1). Needs `../crmedr` checked out beside this repo and network access to `query.wikidata.org`.
- Produces: `data/places-snapshot.json` with `labels`, `it`, and `coords: null` places.

- [ ] **Step 1: Run the script**

Run: `npm run snapshot-registry`
Expected: lines `wrote …/places-snapshot.json: N eulogies at M places`, with N ≥ 4,205 and M ≥ 1,789 (the counts before this change), and no "Wikidata unreachable" warning. If Wikidata is unreachable, stop: the fallback has no labels to reuse yet.

- [ ] **Step 2: Keep only the places snapshot**

The script rewrites every snapshot from the current crmedr. This change is about places only, so restore the others:

Run: `git diff --stat data/ && git checkout -- data/registry-snapshot.json data/misprints-snapshot.json data/notes-snapshot.json && git status --short data/`
Expected: only `data/places-snapshot.json` modified.

- [ ] **Step 3: Check the result**

Run:
```bash
node -e 'const s=require("./data/places-snapshot.json"); const p=Object.values(s.places); console.log("places", p.length, "with labels", p.filter(x=>x.labels).length, "it labels", p.filter(x=>x.labels?.it).length, "no coords", p.filter(x=>!x.coords).length); console.log("eulogies", Object.keys(s.eulogies).length, "with it", Object.values(s.eulogies).filter(e=>e.it).length); console.log(JSON.stringify(s.places.Q220))'
```
Expected: nearly every place has labels; `Q220` is `{"label":"Rome","country":"IT","coords":[…],"labels":{"en":"Rome","it":"Roma",…}}`; some places have no coordinates; most eulogies have an `it` form.

- [ ] **Step 4: Run the whole test suite** (the map and other users of the snapshot)

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add data/places-snapshot.json
git commit -m "data: place labels in six languages, Italian forms, places without coordinates"
```

---

### Task 3: `placesIndex()`, the pure join

**Files:**
- Create: `lib/places-index.ts`
- Test: `lib/__tests__/places-index.test.ts`

**Interfaces:**
- Consumes: `PlacesSnapshot`, `PlaceInfo` from `@/lib/places`; `CatalogEntryOut` from `@/lib/types`; `Day` from `@/lib/calendar`; `Locale` from `@/i18n/routing`.
- Produces:
  ```ts
  export interface PlaceLine { id: string; day: Day; entry: number | null; subject: string; printed: string | null; typology: string | null }
  export interface IndexPlace { qid: string; label: string; country: string; lines: PlaceLine[] }
  export interface IndexLetter { letter: string; places: IndexPlace[] }
  export interface PlacesIndexData { letters: IndexLetter[]; placed: number; printed: number }
  export function placesIndex(catalog: CatalogEntryOut[], snap: PlacesSnapshot, edition: string, locale: Locale): PlacesIndexData
  export function placeLabel(place: PlaceInfo, qid: string, locale: Locale): string
  export function headingLetter(label: string): string
  ```

- [ ] **Step 1: Write the failing tests** in `lib/__tests__/places-index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { headingLetter, placeLabel, placesIndex } from "@/lib/places-index";
import type { PlacesSnapshot } from "@/lib/places";
import type { CatalogEntryOut } from "@/lib/types";

const snap: PlacesSnapshot = {
  places: {
    Q220: { label: "Rome", country: "IT", coords: [41.9, 12.5], labels: { en: "Rome", it: "Roma", de: "Rom" } },
    Q84: { label: "London", country: "GB", coords: [51.5, -0.1], labels: { en: "London", it: "Londra" } },
    Q1: { label: "Ōtsu", country: "JP", coords: null },
    Q2: { label: "avila", country: "ES", coords: [40.6, -4.7] },
    Q3: { label: "Q3", country: "", coords: null },
  },
  eulogies: {
    "mr:0101-almachius": { place: "Q220", la: "Romæ", it: "A Roma", typology: "dies_natalis" },
    "mr:0102-caecilia": { place: "Q220", la: "Romæ via Appia", typology: "depositio" },
    "mr:0103-thomas": { place: "Q84", la: "Londínii", it: "A Londra", typology: "dies_natalis" },
    "mr:0104-otsu": { place: "Q1", la: "Otsu", typology: null },
    "mr:0105-avila": { place: "Q2", la: "Abulæ", typology: "dies_natalis" },
    "mr:0106-nemo": { place: "Q3", la: "Nusquam", typology: "dies_natalis" },
    "mr:0107-lost": { place: "Q404", la: "Ubique", typology: "dies_natalis" }, // the QID is missing from places
  },
};

const cat = (id: string, subject: string, day: string | null, entry: number | null = 1, present = true): CatalogEntryOut => ({
  id, subject, anchor_day: day ?? "01-01", deprecated: false, present, day_printed: day, entry,
});

const catalog: CatalogEntryOut[] = [
  cat("mr:0102-caecilia", "Sancta Cæcilia", "01-02", 3),
  cat("mr:0101-almachius", "Sanctus Almachius", "01-02", 2),
  cat("mr:0103-thomas", "Sanctus Thomas", "01-03"),
  cat("mr:0104-otsu", "Beati Martyres Otsuenses", "01-04"),
  cat("mr:0105-avila", "Sancta Teresia", "01-05"),
  cat("mr:0106-nemo", "Sanctus Nemo", "01-06"),
  cat("mr:0107-lost", "Sanctus Perditus", "01-07"),
  cat("mr:0108-unplaced", "Sancta Martina", "01-08"),
  cat("mr:0109-absent", "Sanctus Absens", "01-09", 1, false),
  cat("mr:0110-nodate", "Sanctus Sine Die", null),
  cat("mr:0111-lead", "In Nativitate", "01-02", null), // unnumbered: printed first on its day
];
snap.eulogies["mr:0111-lead"] = { place: "Q220", la: "Romæ", typology: "commemoratio" };

const LA = "martyrologium_romanum_2004";
const IT = "martyrologium_romanum_2004_it_IT";
const OLD = "martyrologium_romanum_1749";

describe("placesIndex", () => {
  it("counts the eulogies the edition prints and those of them that are placed", () => {
    const { placed, printed } = placesIndex(catalog, snap, LA, "en");
    // printed: every present eulogy with a printed day (not 0109-absent, not 0110-nodate)
    expect(printed).toBe(9);
    // placed: those with a place in the snapshot (not 0107-lost, whose QID is missing; not 0108-unplaced)
    expect(placed).toBe(7);
  });

  it("groups the eulogies by place, under letters, headings sorted in the interface language", () => {
    const { letters } = placesIndex(catalog, snap, LA, "en");
    expect(letters.map((l) => [l.letter, l.places.map((p) => p.label)])).toEqual([
      ["A", ["avila"]],
      ["L", ["London"]],
      ["O", ["Ōtsu"]],
      ["Q", ["Q3"]],
      ["R", ["Rome"]],
    ]);
  });

  it("heads each place with its label in the interface language, else English, else the gazetteer's", () => {
    const it_ = placesIndex(catalog, snap, LA, "it").letters.flatMap((l) => l.places.map((p) => p.label));
    expect(it_).toEqual(["avila", "Londra", "Ōtsu", "Q3", "Roma"]);
    const fr = placesIndex(catalog, snap, LA, "fr").letters.flatMap((l) => l.places.map((p) => p.label));
    expect(fr).toEqual(["avila", "London", "Ōtsu", "Q3", "Rome"]);
  });

  it("lists a place's eulogies in calendar order, the unnumbered first on its day", () => {
    const rome = placesIndex(catalog, snap, LA, "en").letters.find((l) => l.letter === "R")!.places[0];
    expect(rome.qid).toBe("Q220");
    expect(rome.country).toBe("IT");
    expect(rome.lines.map((l) => l.id)).toEqual(["mr:0111-lead", "mr:0101-almachius", "mr:0102-caecilia"]);
    expect(rome.lines[1]).toEqual({
      id: "mr:0101-almachius", day: { mm: 1, dd: 2 }, entry: 2, subject: "Sanctus Almachius", printed: "Romæ", typology: "dies_natalis",
    });
  });

  it("shows the printed form only where it is the edition's own: Latin 2004 and Italian 2004", () => {
    const line = (edition: string) =>
      placesIndex(catalog, snap, edition, "en").letters.find((l) => l.letter === "L")!.places[0].lines[0].printed;
    expect(line(LA)).toBe("Londínii");
    expect(line(IT)).toBe("A Londra");
    expect(line(OLD)).toBeNull();
    // An Italian eulogy without an Italian form has none.
    const avila = placesIndex(catalog, snap, IT, "en").letters.find((l) => l.letter === "A")!.places[0].lines[0];
    expect(avila.printed).toBeNull();
  });

  it("is empty for an edition that prints nothing", () => {
    expect(placesIndex([cat("mr:0109-absent", "Sanctus Absens", "01-09", 1, false)], snap, OLD, "en")).toEqual({
      letters: [], placed: 0, printed: 0,
    });
  });
});

describe("placeLabel", () => {
  it("falls back from the interface language to English to the gazetteer's label", () => {
    expect(placeLabel(snap.places.Q220, "Q220", "de")).toBe("Rom");
    expect(placeLabel(snap.places.Q84, "Q84", "de")).toBe("London");
    expect(placeLabel({ label: "", country: "", coords: null }, "Q9", "de")).toBe("Q9");
  });
});

describe("headingLetter", () => {
  it("folds accents and case, and files a heading without a letter under #", () => {
    expect(headingLetter("Ōtsu")).toBe("O");
    expect(headingLetter("ávila")).toBe("A");
    expect(headingLetter("ʼs-Hertogenbosch")).toBe("S");
    expect(headingLetter("123")).toBe("#");
    expect(headingLetter("Łódź")).toBe("Ł");
  });
});
```

- [ ] **Step 2: Run the tests to check they fail**

Run: `npx vitest run lib/__tests__/places-index.test.ts`
Expected: FAIL: cannot find module `@/lib/places-index`.

- [ ] **Step 3: Implement `lib/places-index.ts`**

```ts
import type { Locale } from "@/i18n/routing";
import type { Day } from "@/lib/calendar";
import type { PlaceInfo, PlacesSnapshot } from "@/lib/places";
import type { CatalogEntryOut } from "@/lib/types";

/** One eulogy under a place: its day, number, subject in the edition's language, the place as the edition prints it, and its typology. */
export interface PlaceLine {
  id: string;
  day: Day;
  entry: number | null;
  subject: string;
  printed: string | null;
  typology: string | null;
}

export interface IndexPlace {
  qid: string;
  label: string;
  country: string;
  lines: PlaceLine[];
}

export interface IndexLetter {
  letter: string;
  places: IndexPlace[];
}

export interface PlacesIndexData {
  letters: IndexLetter[];
  /** The eulogies the edition prints that have a place. */
  placed: number;
  /** The eulogies the edition prints. */
  printed: number;
}

/** Which printed form of a place is the edition's own: the snapshot's forms come from these two editions' texts. */
const PRINTED_FORM: Record<string, "la" | "it"> = {
  martyrologium_romanum_2004: "la",
  martyrologium_romanum_2004_it_IT: "it",
};

/** A place's heading: its label in the interface language, else in English, else the gazetteer's, else its QID. */
export function placeLabel(place: PlaceInfo, qid: string, locale: Locale): string {
  return place.labels?.[locale] || place.labels?.en || place.label || qid;
}

/** Letters a heading can be filed under; modifier letters (the ʼ of "ʼs-Hertogenbosch") are not. */
const FILING = /[\p{Lu}\p{Ll}\p{Lt}\p{Lo}]/u;

/** The letter a heading is filed under: its first letter, accents folded, upper case; "#" when it starts with a digit or has no letter. */
export function headingLetter(label: string): string {
  const first = [...label.normalize("NFD").replace(/\p{M}/gu, "")].find((c) => FILING.test(c) || /\p{N}/u.test(c));
  return first && FILING.test(first) ? first.toUpperCase() : "#";
}

/**
 * An edition's index of places: the eulogies it prints (its catalog's `present` entries with a
 * printed day) that have a place, grouped by place, the places sorted in the interface language and
 * filed by letter, each place's eulogies in calendar order, the unnumbered first on their day as
 * printed. `placed` and `printed` count the eulogies for the coverage note.
 */
export function placesIndex(catalog: CatalogEntryOut[], snap: PlacesSnapshot, edition: string, locale: Locale): PlacesIndexData {
  const form = PRINTED_FORM[edition];
  const byPlace = new Map<string, IndexPlace>();
  let printed = 0;
  let placed = 0;
  for (const c of catalog) {
    const m = c.present !== false ? /^(\d{2})-(\d{2})$/.exec(c.day_printed ?? "") : null;
    if (!m) continue;
    printed++;
    const ep = snap.eulogies[c.id];
    const place = ep ? snap.places[ep.place] : undefined;
    if (!ep || !place) continue;
    placed++;
    let p = byPlace.get(ep.place);
    if (!p) {
      p = { qid: ep.place, label: placeLabel(place, ep.place, locale), country: place.country, lines: [] };
      byPlace.set(ep.place, p);
    }
    p.lines.push({
      id: c.id,
      day: { mm: Number(m[1]), dd: Number(m[2]) },
      entry: c.entry ?? null,
      subject: c.subject ?? c.id,
      printed: (form && ep[form]) || null,
      typology: ep.typology,
    });
  }
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  const places = [...byPlace.values()].sort((a, b) => collator.compare(a.label, b.label) || a.qid.localeCompare(b.qid));
  const letters: IndexLetter[] = [];
  const byLetter = new Map<string, IndexLetter>();
  for (const p of places) {
    p.lines.sort((a, b) => a.day.mm - b.day.mm || a.day.dd - b.day.dd || (a.entry ?? -Infinity) - (b.entry ?? -Infinity));
    const letter = headingLetter(p.label);
    let l = byLetter.get(letter);
    if (!l) {
      l = { letter, places: [] };
      byLetter.set(letter, l);
      letters.push(l);
    }
    l.places.push(p);
  }
  return { letters, placed, printed };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/__tests__/places-index.test.ts`
Expected: PASS. If the `"#"` or "Ł" letter cases fail, fix `headingLetter`, not the test: the spec files a heading under its folded first letter.

- [ ] **Step 5: Commit**

```bash
git add lib/places-index.ts lib/__tests__/places-index.test.ts
git commit -m "feat: placesIndex, an edition's eulogies grouped by place and filed by letter"
```

---

### Task 4: The edition and its catalog on the server

**Files:**
- Modify: `lib/server-editions.ts`
- Test: `lib/__tests__/server-editions.test.ts`

**Interfaces:**
- Consumes: `API_BASE`, `findEdition` (already in the file), `CatalogEntryOut`, `EditionOut`, `Locale` (the API's, `"la" | "it" | "en"`) from `@/lib/types`.
- Produces: `editionInfo(id: string): Promise<EditionOut | null | undefined>` (undefined when the API cannot be asked, null when it does not know the edition); `fetchCatalog(edition: string, lang: Locale): Promise<CatalogEntryOut[]>`, which throws on a failed request.

- [ ] **Step 1: Write the failing tests**, appended to `lib/__tests__/server-editions.test.ts` (add `editionInfo, fetchCatalog` to the import on line 2):

```ts
describe("editionInfo", () => {
  it("returns the API's edition, null when unknown, undefined when the API cannot be asked", async () => {
    const e = { edition_id: "mr1749", year: 1749, locale: "la" };
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ editions: [e] })));
    expect(await editionInfo("mr1749")).toEqual(e);
    expect(await editionInfo("nope")).toBeNull();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
    expect(await editionInfo("mr1749")).toBeUndefined();
  });
});

describe("fetchCatalog", () => {
  it("asks the API for the edition's catalog in the given language, cached hourly", async () => {
    const elogia = [{ id: "mr:0101-basilius", subject: "Sanctus Basilius", anchor_day: "01-01", deprecated: false, present: true, day_printed: "01-01", entry: 2 }];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ elogia })));
    expect(await fetchCatalog("martyrologium_romanum_2004_it_IT", "it")).toEqual(elogia);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/v1\/elogia\?edition=martyrologium_romanum_2004_it_IT&locale=it$/);
    expect(fetchMock.mock.calls[0][1]).toEqual({ next: { revalidate: 3600 } });
  });

  it("throws when the API answers with an error or cannot be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 503 }));
    await expect(fetchCatalog("x", "la")).rejects.toThrow();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
    await expect(fetchCatalog("x", "la")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to check they fail**

Run: `npx vitest run lib/__tests__/server-editions.test.ts`
Expected: FAIL: `editionInfo` and `fetchCatalog` are not exported.

- [ ] **Step 3: Implement**, appended to `lib/server-editions.ts` (extend the type import on line 2 to `import type { CatalogEntryOut, EditionOut, Locale } from "@/lib/types";`):

```ts
/** The edition as the API describes it: undefined when the API cannot be asked, null when it does not know the edition. */
export async function editionInfo(id: string): Promise<EditionOut | null | undefined> {
  return findEdition(id);
}

/** The edition's catalog (every eulogy, with its subject in `lang`), from the data cache (revalidated hourly) or fresh. Throws when the API cannot give it. */
export async function fetchCatalog(edition: string, lang: Locale): Promise<CatalogEntryOut[]> {
  const res = await fetch(
    `${API_BASE}/api/v1/elogia?edition=${encodeURIComponent(edition)}&locale=${lang}`,
    { next: { revalidate: 3600 } },
  );
  if (!res.ok) throw new Error(`catalog ${res.status}`);
  return ((await res.json()) as { elogia: CatalogEntryOut[] }).elogia;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/__tests__/server-editions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/server-editions.ts lib/__tests__/server-editions.test.ts
git commit -m "feat: the edition and its catalog, fetched on the server"
```

---

### Task 5: The `PlacesIndex` component and its messages

**Files:**
- Create: `components/PlacesIndex.tsx`
- Modify: `messages/en.json`, `messages/it.json`, `messages/fr.json`, `messages/de.json`, `messages/es.json`, `messages/pt.json`
- Test: `components/__tests__/PlacesIndex.test.tsx`

**Interfaces:**
- Consumes: `PlacesIndexData` from `@/lib/places-index` (Task 3); `dayPath`, `interfaceMonth` from `@/lib/calendar`; `Link` from `@/i18n/navigation`; `styles` from `@/components/page.module.css`; messages `Map.typology.*`.
- Produces: `export default function PlacesIndex({ edition, title, index }: { edition: string; title: string; index: PlacesIndexData | null })` (`index: null` renders the error state); messages `Places.*`, `Metadata.placesTitle`, `Reader.placesLink` (used by Tasks 6 and 7).

- [ ] **Step 1: Add the messages.** In each file, add `"placesTitle"` after `"notesTitle"` in `Metadata`, `"placesLink"` after `"notesLink"` in `Reader`, and a `"Places"` object after the `"Notes"` object, with these values (French uses U+00A0 before `:`, written here as ` `):

| key | en | it | fr | de | es | pt |
|---|---|---|---|---|---|---|
| `Metadata.placesTitle` | `{edition}: index of places` | `{edition}: indice dei luoghi` | `{edition} : index des lieux` | `{edition}: Ortsregister` | `{edition}: índice de lugares` | `{edition}: índice de lugares` |
| `Reader.placesLink` | `Index of places` | `Indice dei luoghi` | `Index des lieux` | `Ortsregister` | `Índice de lugares` | `Índice de lugares` |
| `Places.title` | `{title}: index of places` | `{title}: indice dei luoghi` | `{title} : index des lieux` | `{title}: Ortsregister` | `{title}: índice de lugares` | `{title}: índice de lugares` |
| `Places.readEdition` | `⟵ Read the edition` | `⟵ Leggi l’edizione` | `⟵ Lire l’édition` | `⟵ Ausgabe lesen` | `⟵ Leer la edición` | `⟵ Ler a edição` |
| `Places.letters` | `Letters` | `Lettere` | `Lettres` | `Buchstaben` | `Letras` | `Letras` |
| `Places.coverage` | `{placed, number} of the {printed, number} eulogies of this edition are placed so far.` | `{placed, number} dei {printed, number} elogi di questa edizione hanno finora un luogo.` | `{placed, number} des {printed, number} éloges de cette édition ont pour l’instant un lieu.` | `{placed, number} der {printed, number} Elogien dieser Ausgabe ist bisher ein Ort zugeordnet.` | `{placed, number} de los {printed, number} elogios de esta edición tienen ya un lugar.` | `{placed, number} dos {printed, number} elogios desta edição já têm um lugar.` |
| `Places.empty` | `No eulogies of this edition are placed yet.` | `Nessun elogio di questa edizione ha ancora un luogo.` | `Aucun éloge de cette édition n’a encore de lieu.` | `Den Elogien dieser Ausgabe ist noch kein Ort zugeordnet.` | `Ningún elogio de esta edición tiene aún un lugar.` | `Nenhum elogio desta edição tem ainda um lugar.` |
| `Places.loadError` | `The index could not be loaded.` | `Non è stato possibile caricare l’indice.` | `L’index n’a pas pu être chargé.` | `Das Register konnte nicht geladen werden.` | `No se pudo cargar el índice.` | `Não foi possível carregar o índice.` |
| `Places.retry` | `Try again` | `Riprova` | `Réessayer` | `Erneut versuchen` | `Reintentar` | `Tentar novamente` |
| `Places.notesLink` | `Notes & errata` | `Note ed errata` | `Notes et errata` | `Anmerkungen & Errata` | `Notas y fe de erratas` | `Notas e errata` |

Run: `npx vitest run lib/__tests__/messages.test.ts`
Expected: PASS (same keys, same ICU arguments in every language). If it flags a value as identical to English (e.g. a French "Index"), it is not: `Places.*` values above all differ from the English except where the test's `SAME_AS_ENGLISH` list would need an entry; add one only for a value that is rightly the same word.

- [ ] **Step 2: Write the failing component tests** in `components/__tests__/PlacesIndex.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@/test/intl";
import PlacesIndex from "@/components/PlacesIndex";
import type { PlacesIndexData } from "@/lib/places-index";

const index: PlacesIndexData = {
  placed: 3,
  printed: 5,
  letters: [
    { letter: "L", places: [{ qid: "Q84", label: "London", country: "GB", lines: [
      { id: "mr:0103-thomas", day: { mm: 1, dd: 3 }, entry: 1, subject: "Sanctus Thomas", printed: "Londínii", typology: "dies_natalis" },
    ] }] },
    { letter: "R", places: [{ qid: "Q220", label: "Rome", country: "IT", lines: [
      { id: "mr:0101-almachius", day: { mm: 1, dd: 1 }, entry: 2, subject: "Sanctus Almachius", printed: null, typology: "dies_natalis" },
      { id: "mr:0102-caecilia", day: { mm: 1, dd: 2 }, entry: 3, subject: "Sancta Cæcilia", printed: null, typology: "depositio" },
      { id: "mr:0104-novus", day: { mm: 1, dd: 4 }, entry: 1, subject: "Sanctus Novus", printed: null, typology: "nova_typologia" },
    ] }] },
  ],
};

const renderIndex = (i: PlacesIndexData | null = index) =>
  render(<PlacesIndex edition="martyrologium_romanum_2004" title="MARTYROLOGIUM ROMANUM 2004" index={i} />);

describe("PlacesIndex", () => {
  it("titles the page and links back to the edition and its notes", () => {
    renderIndex();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("MARTYROLOGIUM ROMANUM 2004: index of places");
    expect(screen.getByRole("link", { name: "⟵ Read the edition" })).toHaveAttribute("href", "/en/read/martyrologium_romanum_2004");
    expect(screen.getByRole("link", { name: "Notes & errata" })).toHaveAttribute("href", "/en/read/martyrologium_romanum_2004/notes");
  });

  it("links each letter to its section", () => {
    renderIndex();
    const bar = screen.getByRole("navigation", { name: "Letters" });
    expect(within(bar).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["L", "#letter-L"], ["R", "#letter-R"],
    ]);
    expect(document.getElementById("letter-R")).toHaveTextContent("Rome");
  });

  it("heads a place with its name and country, and lists its eulogies with day links to the eulogy", () => {
    renderIndex();
    const rome = screen.getByRole("heading", { level: 3, name: /Rome/ });
    expect(rome).toHaveTextContent("Rome (Italy)");
    const day = screen.getByRole("link", { name: "1 January" });
    expect(day).toHaveAttribute("href", "/en/read/martyrologium_romanum_2004/01/01#mr:0101-almachius");
    expect(day.closest("li")).toHaveTextContent("Sanctus Almachius");
  });

  it("shows the printed form where there is one, and the typology unless dies natalis", () => {
    renderIndex();
    expect(screen.getByText("Londínii").tagName).toBe("I");
    const thomas = screen.getByRole("link", { name: "3 January" }).closest("li")!;
    expect(thomas).not.toHaveTextContent("Dies natalis");
    const caecilia = screen.getByRole("link", { name: "2 January" }).closest("li")!;
    expect(caecilia).toHaveTextContent("Depositio");
  });

  it("shows no label for a typology the messages don't know", () => {
    renderIndex();
    const novus = screen.getByRole("link", { name: "4 January" }).closest("li")!;
    expect(novus).toHaveTextContent("Sanctus Novus");
    expect(novus).not.toHaveTextContent("nova_typologia");
  });

  it("says how many eulogies are placed when not all are, and nothing when all are", () => {
    const { unmount } = renderIndex();
    expect(screen.getByText("3 of the 5 eulogies of this edition are placed so far.")).toBeInTheDocument();
    unmount();
    renderIndex({ ...index, printed: 3 });
    expect(screen.queryByText(/are placed so far/)).toBeNull();
  });

  it("says so when no eulogy is placed", () => {
    renderIndex({ letters: [], placed: 0, printed: 0 });
    expect(screen.getByText("No eulogies of this edition are placed yet.")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Letters" })).toBeNull();
  });

  it("offers to try again when the index could not be loaded", () => {
    renderIndex(null);
    expect(screen.getByText("The index could not be loaded.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/en/read/martyrologium_romanum_2004/places");
  });

  it("names places and countries in the interface language", () => {
    render(<PlacesIndex edition="martyrologium_romanum_2004" title="X" index={index} />, { locale: "it" });
    expect(screen.getByRole("heading", { level: 3, name: /Rome/ })).toHaveTextContent("Rome (Italia)");
  });
});
```

- [ ] **Step 3: Run the tests to check they fail**

Run: `npx vitest run components/__tests__/PlacesIndex.test.tsx`
Expected: FAIL: cannot find module `@/components/PlacesIndex`.

- [ ] **Step 4: Implement `components/PlacesIndex.tsx`** (no `"use client"`: it renders on the server; `useTranslations` works in a non-async server component):

```tsx
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import styles from "@/components/page.module.css";
import { dayPath, interfaceMonth } from "@/lib/calendar";
import type { PlacesIndexData } from "@/lib/places-index";

/**
 * An edition's index of places, as at the back of a printed book: the places A–Z in the interface
 * language, under each the eulogies that name it with their day (linked to the eulogy in the reader),
 * subject, the place as the edition prints it, and their typology unless it is the dies natalis.
 * `index` null: the catalog could not be loaded.
 */
export default function PlacesIndex({ edition, title, index }: { edition: string; title: string; index: PlacesIndexData | null }) {
  const t = useTranslations("Places");
  const tMap = useTranslations("Map");
  const format = useFormatter();
  const locale = useLocale();
  const ed = encodeURIComponent(edition);
  const countries = new Intl.DisplayNames([locale], { type: "region" });
  const country = (code: string) => {
    try {
      return code ? countries.of(code) : undefined;
    } catch {
      return undefined; // not a region code
    }
  };

  return (
    <article className={styles.page} aria-labelledby="places-title">
      <h1 id="places-title" className={styles.heading}>
        {t("title", { title })}
      </h1>
      <p className="mb-3 text-center text-sm text-slate-600">
        <Link href={`/read/${ed}`} className="underline">{t("readEdition")}</Link>
        {" · "}
        <Link href={`/read/${ed}/notes`} className="underline">{t("notesLink")}</Link>
      </p>
      {!index ? (
        <p className="text-center text-red-700">
          {t("loadError")}{" "}
          <Link href={`/read/${ed}/places`} className="underline">{t("retry")}</Link>
        </p>
      ) : index.placed === 0 ? (
        <p className="text-center text-slate-600">{t("empty")}</p>
      ) : (
        <>
          {index.placed < index.printed && (
            <p className="mb-3 text-center text-sm text-slate-600">{t("coverage", { placed: index.placed, printed: index.printed })}</p>
          )}
          <nav aria-label={t("letters")} className="mb-4 flex flex-wrap justify-center gap-x-2 gap-y-1">
            {index.letters.map((l) => (
              <a key={l.letter} href={`#letter-${l.letter}`} className="underline">{l.letter}</a>
            ))}
          </nav>
          {index.letters.map((l) => (
            <section key={l.letter} id={`letter-${l.letter}`} aria-labelledby={`letter-${l.letter}-h`}>
              <h2 id={`letter-${l.letter}-h`} className={`${styles.heading} mt-6`}>{l.letter}</h2>
              {l.places.map((p) => {
                const c = country(p.country);
                return (
                  <div key={p.qid} className="mb-4">
                    <h3 className="font-semibold">
                      {p.label}
                      {c && <span className="font-normal text-slate-600"> ({c})</span>}
                    </h3>
                    <ul className="ml-4 text-sm">
                      {p.lines.map((line) => (
                        <li key={line.id}>
                          <Link href={`${dayPath(edition, line.day)}#${line.id}`} className="underline">
                            {line.day.dd} {interfaceMonth(format, line.day.mm)}
                          </Link>
                          {" · "}
                          {line.subject}
                          {line.printed && <>{" · "}<i>{line.printed}</i></>}
                          {line.typology && line.typology !== "dies_natalis" && tMap.has(`typology.${line.typology}` as "typology.none") && (
                            <span className="text-slate-600"> · {tMap(`typology.${line.typology}` as "typology.none")}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </section>
          ))}
        </>
      )}
    </article>
  );
}
```

The `as "typology.none"` casts follow `typologyLabel` in `lib/map-data.ts`, which checks and reads a typology key the same way.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run components/__tests__/PlacesIndex.test.tsx lib/__tests__/messages.test.ts`
Expected: PASS. If the `"1 January"` link name fails because `interfaceMonth` gives another form, match what `ApparatusPage` renders for the same date and adjust the test's expected names only.

- [ ] **Step 6: Commit**

```bash
git add components/PlacesIndex.tsx components/__tests__/PlacesIndex.test.tsx messages/*.json
git commit -m "feat: the index of places, A to Z, with its messages in six languages"
```

---

### Task 6: The route

**Files:**
- Create: `app/[locale]/read/[edition]/places/page.tsx`
- Test: `components/__tests__/PlacesRoute.test.tsx`

**Interfaces:**
- Consumes: `editionExists`, `editionInfo`, `fetchCatalog` (`@/lib/server-editions`, Task 4); `placesIndex` (Task 3); `getPlaces` (`@/lib/places`); `editionLang`, `editionTitle`, `titleCase` (`@/lib/editions`); `PlacesIndex` (Task 5); `Metadata.placesTitle` (Task 5).
- Produces: the page at `/<locale>/read/<edition>/places`.

- [ ] **Step 1: Read the Next.js docs** for page and `generateMetadata` conventions in this version: `ls node_modules/next/dist/docs/` and read the guide on pages/layouts and on metadata. Match `app/[locale]/read/[edition]/notes/page.tsx`, which already follows them.

- [ ] **Step 2: Write the failing tests** in `components/__tests__/PlacesRoute.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const { existsMock, infoMock, catalogMock, metaMock, indexProps } = vi.hoisted(() => ({
  existsMock: vi.fn(), infoMock: vi.fn(), catalogMock: vi.fn(), metaMock: vi.fn(), indexProps: vi.fn(),
}));
vi.mock("@/lib/server-editions", () => ({
  editionExists: existsMock, editionInfo: infoMock, fetchCatalog: catalogMock, editionMeta: metaMock,
}));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
}));
vi.mock("@/components/PlacesIndex", () => ({ default: (p: unknown) => { indexProps(p); return null; } }));
vi.mock("@/lib/places", () => ({
  getPlaces: () => ({
    places: { Q220: { label: "Rome", country: "IT", coords: null } },
    eulogies: { "mr:0101-almachius": { place: "Q220", la: "Romæ", typology: "dies_natalis" } },
  }),
}));

import PlacesRoute, { generateMetadata } from "@/app/[locale]/read/[edition]/places/page";

const params = (edition: string) => ({ params: Promise.resolve({ locale: "en", edition }) });
const E = { edition_id: "martyrologium_romanum_2004_it_IT", year: 2004, locale: "it-IT" };

describe("/read/<edition>/places", () => {
  beforeEach(() => {
    existsMock.mockReset().mockResolvedValue(true);
    infoMock.mockReset().mockResolvedValue(E);
    metaMock.mockReset().mockResolvedValue({ title: "Martirologio Romano", year: 2004 });
    catalogMock.mockReset().mockResolvedValue([
      { id: "mr:0101-almachius", subject: "Sant’Almachio", anchor_day: "01-01", deprecated: false, present: true, day_printed: "01-01", entry: 1 },
    ]);
    indexProps.mockReset();
  });

  it("404s on an unknown edition", async () => {
    existsMock.mockResolvedValue(false);
    await expect(PlacesRoute(params("nope"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("asks for the catalog in the edition's language and renders its index", async () => {
    render(await PlacesRoute(params(E.edition_id)));
    expect(catalogMock).toHaveBeenCalledWith(E.edition_id, "it");
    const props = indexProps.mock.calls[0][0];
    expect(props.edition).toBe(E.edition_id);
    expect(props.title).toBe("MARTIROLOGIO ROMANO 2004");
    expect(props.index.placed).toBe(1);
    expect(props.index.letters[0].places[0].lines[0].subject).toBe("Sant’Almachio");
  });

  it("renders the error state, not a crash, when the catalog cannot be loaded", async () => {
    catalogMock.mockRejectedValue(new Error("down"));
    render(await PlacesRoute(params(E.edition_id)));
    expect(indexProps.mock.calls[0][0].index).toBeNull();
  });

  it("renders the error state when the edition list cannot be asked", async () => {
    infoMock.mockResolvedValue(undefined);
    render(await PlacesRoute(params(E.edition_id)));
    expect(indexProps.mock.calls[0][0].index).toBeNull();
    expect(indexProps.mock.calls[0][0].title).toBe(E.edition_id);
  });

  it("titles the page with the edition", async () => {
    expect((await generateMetadata(params(E.edition_id))).title).toBe("Martirologio Romano 2004: index of places");
  });
});
```

- [ ] **Step 3: Run the tests to check they fail**

Run: `npx vitest run components/__tests__/PlacesRoute.test.tsx`
Expected: FAIL: cannot find module `@/app/[locale]/read/[edition]/places/page`.

- [ ] **Step 4: Implement `app/[locale]/read/[edition]/places/page.tsx`**

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PlacesIndex from "@/components/PlacesIndex";
import { editionLang, editionTitle } from "@/lib/editions";
import { getPlaces } from "@/lib/places";
import { placesIndex, type PlacesIndexData } from "@/lib/places-index";
import { editionExists, editionInfo, editionMeta, fetchCatalog } from "@/lib/server-editions";

type Params = Promise<{ locale: string; edition: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, edition } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Metadata" });
  const meta = await editionMeta(edition);
  return { title: t("placesTitle", { edition: meta ? `${meta.title} ${meta.year}` : edition }) };
}

/** One edition's index of places, rendered on the server from its catalog and the places snapshot. */
export default async function PlacesRoute({ params }: { params: Params }) {
  const { locale, edition } = await params;
  setRequestLocale(locale as Locale);
  if (!(await editionExists(edition))) notFound();
  const e = await editionInfo(edition);
  let index: PlacesIndexData | null = null;
  if (e) {
    try {
      index = placesIndex(await fetchCatalog(edition, editionLang(e)), getPlaces(), edition, locale as Locale);
    } catch {
      index = null; // the API could not give the catalog: PlacesIndex says so and offers to try again
    }
  }
  return (
    <main className="mx-auto max-w-5xl py-4 sm:p-4">
      <PlacesIndex edition={edition} title={e ? `${editionTitle(e)} ${e.year}` : edition} index={index} />
    </main>
  );
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run components/__tests__/PlacesRoute.test.tsx`
Expected: PASS. (`getTranslations` runs unmocked in tests, as in `components/__tests__/ReadRoutes.test.tsx`.)

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/read/[edition]/places/page.tsx" components/__tests__/PlacesRoute.test.tsx
git commit -m "feat: /read/<edition>/places, the index of places rendered on the server"
```

---

### Task 7: Links from the reader and the notes page

**Files:**
- Modify: `components/ReaderBar.tsx:143-145`, `components/ApparatusPage.tsx` (the `readEdition` paragraph)
- Test: `components/__tests__/Reader.test.tsx`, `components/__tests__/ApparatusPage.test.tsx`

**Interfaces:**
- Consumes: `Reader.placesLink` (Task 5); the route (Task 6).

- [ ] **Step 1: Write the failing tests.** In `components/__tests__/Reader.test.tsx`, inside `describe("Reader", …)`:

```tsx
  it("links to the edition's notes and its index of places", async () => {
    render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    expect(screen.getByRole("link", { name: "Index of places" })).toHaveAttribute("href", "/read/martyrologium_romanum_1749/places");
  });
```

In `components/__tests__/ApparatusPage.test.tsx`, inside `describe("ApparatusPage", …)`:

```tsx
  it("links to the edition's index of places", async () => {
    vi.spyOn(api, "getEditions").mockResolvedValue([]);
    vi.spyOn(api, "getMonth").mockImplementation(async (_ed, mm) => month(Number(mm)));
    render(<ApparatusPage edition="martyrologium_romanum_2004" />);
    expect(await screen.findByRole("link", { name: "Index of places" })).toHaveAttribute(
      "href", "/en/read/martyrologium_romanum_2004/places",
    );
  });
```

- [ ] **Step 2: Run the tests to check they fail**

Run: `npx vitest run components/__tests__/Reader.test.tsx components/__tests__/ApparatusPage.test.tsx`
Expected: FAIL: no link named "Index of places".

- [ ] **Step 3: Implement.** In `components/ReaderBar.tsx`, after the notes `Link`:

```tsx
      <Link href={`/read/${encodeURIComponent(edition)}/notes`} className="text-sm underline">
        {t("notesLink")}
      </Link>
      <Link href={`/read/${encodeURIComponent(edition)}/places`} className="text-sm underline">
        {t("placesLink")}
      </Link>
```

In `components/ApparatusPage.tsx`, the paragraph under the `<h1>` becomes:

```tsx
      <p className="mb-3 text-center text-sm text-slate-600">
        <Link href={`/read/${encodeURIComponent(edition)}`} className="underline">
          {t("readEdition")}
        </Link>
        {" · "}
        <Link href={`/read/${encodeURIComponent(edition)}/places`} className="underline">
          {tReader("placesLink")}
        </Link>
      </p>
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run components/__tests__/Reader.test.tsx components/__tests__/ApparatusPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ReaderBar.tsx components/ApparatusPage.tsx components/__tests__/Reader.test.tsx components/__tests__/ApparatusPage.test.tsx
git commit -m "feat: link the index of places from the reader and the notes page"
```

---

### Task 8: Verify the whole branch and the spec note

**Files:**
- Modify: `docs/superpowers/specs/2026-10-08-places-index-design.md` (the `### Server` section)

- [ ] **Step 1: Update the spec** so `fetchCatalog` is described in `lib/server-editions.ts`, beside `fetchEditions`, with `editionInfo`; `lib/places-index.ts` holds only the pure `placesIndex` (and `placeLabel`, `headingLetter`).

- [ ] **Step 2: Run every check**

Run: `npx vitest run && npx tsc --noEmit && npx eslint . && npm run build`
Expected: all tests pass; no type or lint errors; the build lists `/[locale]/read/[edition]/places`.

- [ ] **Step 3: Look at it on a local server.** Start the built site against the deployed API: `API_BASE=https://romanmartyrology.com PORT=3123 npx next start -p 3123` (run it in the background), then:

```bash
for p in en/read/martyrologium_romanum_2004/places it/read/martyrologium_romanum_2004_it_IT/places en/read/martyrologium_romanum_1749/places en/read/martyrologium_romanum_1584/places; do
  h=$(curl -s localhost:3123/$p)
  echo "$p h3:$(echo "$h" | grep -o '<h3' | wc -l) coverage:$(echo "$h" | grep -c 'placed so far\|hanno finora') empty:$(echo "$h" | grep -c 'placed yet') error:$(echo "$h" | grep -c 'could not be loaded')"
done
```

Expected: 2004 and 2004 Italian list over a thousand places each; 1749 lists places and shows the coverage note; 1584 shows the empty note; none shows the error note. Open one page in a browser if one is available and check that a day link lands on its eulogy. Stop the server afterwards.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-10-08-places-index-design.md
git commit -m "spec: fetchCatalog sits with fetchEditions on the server"
```
