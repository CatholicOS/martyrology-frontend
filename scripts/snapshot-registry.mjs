import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @typedef {object} RegistryEntry
 * @property {string} id
 * @property {number} month
 * @property {number} day
 * @property {number|null} [entry]
 * @property {boolean} [asterisk]
 * @property {boolean} [deprecated]
 * @property {boolean} [unnumbered]
 * @property {string|null} [country]
 * @property {string|null} [attested_in]
 *
 * @typedef {object} SnapshotEntry
 * @property {boolean} deprecated
 * @property {number} month
 * @property {number} day
 * @property {number|null} entry
 * @property {boolean} asterisk
 * @property {boolean} unnumbered
 * @property {string|null} country
 * @property {string|null} attested_in
 * @property {{la: string, it: string, en: string}} subject
 *
 * @param {{entries: RegistryEntry[]}} registry
 * @param {Record<string, string>} la
 * @param {Record<string, string>} it
 * @param {Record<string, string>} en
 * @returns {Record<string, SnapshotEntry>}
 */
export function buildSnapshot(registry, la, it, en) {
  /** @type {Record<string, SnapshotEntry>} */
  const out = {};
  for (const e of registry.entries) {
    out[e.id] = {
      deprecated: Boolean(e.deprecated),
      month: e.month, day: e.day,
      entry: e.entry ?? null,
      asterisk: Boolean(e.asterisk),
      unnumbered: Boolean(e.unnumbered),
      country: e.country ?? null,
      attested_in: e.attested_in ?? null,
      subject: { la: la[e.id] ?? "", it: it[e.id] ?? "", en: en[e.id] ?? "" },
    };
  }
  return out;
}

/**
 * @typedef {object} Misprint
 * @property {string} id
 * @property {string} edition
 * @property {string} printed
 * @property {string} intended
 *
 * Keep what the reader needs to footnote a misprint (crmedr's `verified` is curation metadata).
 * @param {{misprints: (Misprint & {verified?: string})[]}} doc
 * @returns {Misprint[]}
 */
export function buildMisprints(doc) {
  return doc.misprints.map(({ id, edition, printed, intended }) => ({ id, edition, printed, intended }));
}

/**
 * The curators' notes on registry entries, by id: editorial remarks that are not part of any
 * printed text, shown in the reader alongside the canonical ids. `note` (crmedr's `note`) is about
 * the eulogy and shows with every edition; `editions` (crmedr's `edition_notes`) is about one
 * edition's text (a mistranslation, a misprint) and shows with that edition only.
 * @param {{entries: (RegistryEntry & {note?: string|null, edition_notes?: Record<string, string>})[]}} registry
 * @returns {Record<string, {note?: string, editions?: Record<string, string>}>}
 */
export function buildNotes(registry) {
  /** @type {Record<string, {note?: string, editions?: Record<string, string>}>} */
  const out = {};
  for (const e of registry.entries) {
    const editions = e.edition_notes && Object.keys(e.edition_notes).length ? e.edition_notes : undefined;
    if (!e.note && !editions) continue;
    out[e.id] = { ...(e.note ? { note: e.note } : {}), ...(editions ? { editions } : {}) };
  }
  return out;
}

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
    if (g?.wikidata) return { la: s.la, it: s.it, qid: g.wikidata, g };
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
  /** @type {Set<string>} */
  const qids = new Set();
  for (const stated of Object.values(placesDoc.places)) {
    const hit = firstResolved(stated, gazetteerDoc.places);
    if (hit) qids.add(hit.qid);
  }
  return [...qids].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}

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

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const crmedr = process.argv[2] ?? join(here, "..", "..", "crmedr");
  const registry = JSON.parse(readFileSync(join(crmedr, "data", "martyrology_ids.json"), "utf8"));
  const la = JSON.parse(readFileSync(join(crmedr, "i18n", "la.json"), "utf8"));
  const it = JSON.parse(readFileSync(join(crmedr, "i18n", "it.json"), "utf8"));
  const en = JSON.parse(readFileSync(join(crmedr, "i18n", "en.json"), "utf8"));
  const snap = buildSnapshot(registry, la, it, en);
  const dest = join(here, "..", "data", "registry-snapshot.json");
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(snap) + "\n");
  console.log(`wrote ${dest}: ${Object.keys(snap).length} ids`);
  const misprints = buildMisprints(JSON.parse(readFileSync(join(crmedr, "data", "misprints.json"), "utf8")));
  const misprintsDest = join(here, "..", "data", "misprints-snapshot.json");
  writeFileSync(misprintsDest, JSON.stringify(misprints, null, 2) + "\n");
  console.log(`wrote ${misprintsDest}: ${misprints.length} misprints`);
  const notes = buildNotes(registry);
  const notesDest = join(here, "..", "data", "notes-snapshot.json");
  writeFileSync(notesDest, JSON.stringify(notes, null, 2) + "\n");
  console.log(`wrote ${notesDest}: ${Object.keys(notes).length} notes`);
  const placesDoc = JSON.parse(readFileSync(join(crmedr, "data", "places.json"), "utf8"));
  const gazetteerDoc = JSON.parse(readFileSync(join(crmedr, "data", "gazetteer.json"), "utf8"));
  const typologyDoc = JSON.parse(readFileSync(join(crmedr, "data", "typology.json"), "utf8"));
  const qids = resolvedQids(placesDoc, gazetteerDoc);
  const placesDest = join(here, "..", "data", "places-snapshot.json");
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
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
