import type { useTranslations } from "next-intl";
import type { Day } from "@/lib/calendar";
import type { PlacesSnapshot } from "@/lib/places";
import type { CatalogEntryOut } from "@/lib/types";

/** One eulogy an edition prints, at its place. */
export interface MapEntry {
  id: string;
  /** The interface language's subject. */
  subject: string;
  /** The catalog's own (edition, Latin) subject, kept for searching. */
  editionSubject: string;
  day: Day;
  entry: number | null;
  qid: string;
  la: string;
  label: string;
  country: string;
  coords: [number, number];
  typology: string | null;
}

type MapT = ReturnType<typeof useTranslations<"Map">>;

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
 * resolved place, a place without coordinates, or a deprecated ID, which the gazetteer does not cover).
 */
export function mapEntries(
  catalog: CatalogEntryOut[],
  snap: PlacesSnapshot,
  /** The subject to show for an eulogy (the interface language's); the catalog's own, else the ID, by default. */
  subjectOf: (id: string, catalogSubject: string) => string = (_id, s) => s,
): { entries: MapEntry[]; unmapped: number } {
  const entries: MapEntry[] = [];
  let unmapped = 0;
  for (const c of catalog) {
    const m = c.present !== false ? /^(\d{2})-(\d{2})$/.exec(c.day_printed ?? "") : null;
    if (!m) continue;
    const ep = snap.eulogies[c.id];
    const place = ep ? snap.places[ep.place] : undefined;
    if (!ep || !place?.coords) {
      unmapped++;
      continue;
    }
    entries.push({
      id: c.id,
      subject: subjectOf(c.id, c.subject ?? c.id),
      editionSubject: c.subject ?? c.id,
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

/**
 * Lower case, without accents, with æ/œ spelled out, so "caecilia" finds "Cæcilia". Accents go
 * first: an accented ligature (ǽ) only becomes a plain æ once its accent is stripped.
 */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe");
}

/** Whether the search text is in the eulogy's subject, ID, printed place or the place's label. */
export function matchesQuery(e: MapEntry, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  return [e.subject, e.editionSubject, e.id, e.la, e.label].some((s) => fold(s).includes(q));
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

const typologyRank = (t: string) =>
  t === NO_TYPOLOGY ? Infinity : TYPOLOGY_ORDER.indexOf(t) + 1 || TYPOLOGY_ORDER.length + 1;

/**
 * How many eulogies each typology and each country would show: each facet is counted under the
 * search and the other facet, not its own, so every choice says what it would yield.
 * Typologies in crmedr's order ("none" last); countries by code.
 */
export function facetCounts(
  entries: MapEntry[],
  f: MapFilters,
): { typologies: [string, number][]; countries: [string, number][] } {
  const searched = entries.filter((e) => matchesQuery(e, f.query));
  const typologies = [...tally(searched.filter((e) => countryOk(e, f)), typologyKey)].sort(
    ([a], [b]) => typologyRank(a) - typologyRank(b),
  );
  const countries = [...tally(searched.filter((e) => typologyOk(e, f)), (e) => e.country)].sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return { typologies, countries };
}

/** "dies_natalis" → "Dies natalis"; a typology without a message is spelled out from its id. */
export function typologyLabel(t: MapT, typology: string | null): string {
  if (typology === null || typology === NO_TYPOLOGY) return t("typology.none");
  if (t.has(`typology.${typology}` as "typology.none")) return t(`typology.${typology}` as "typology.none");
  const s = typology.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
