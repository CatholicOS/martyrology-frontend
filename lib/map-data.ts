import type { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { Day } from "@/lib/calendar";
import { fold } from "@/lib/fold";
import type { PlacesSnapshot } from "@/lib/places";
import { placeLabel, placeLabelLang } from "@/lib/places-index";
import { PLACE_ROLES } from "@/lib/body-places";
import type { CatalogEntryOut, MentionRole } from "@/lib/types";

/** One eulogy an edition prints, at one of its places: a eulogy naming several places is several entries. */
export interface MapEntry {
  /** `<eulogy>@<qid>`: the entry's identity (markers, selection, list rows, cluster picks). */
  key: string;
  /** The eulogy's ID, shown and linked into the reader. */
  id: string;
  /** The interface language's subject. */
  subject: string;
  /** The catalog's own (edition, Latin) subject, kept for searching. */
  editionSubject: string;
  day: Day;
  entry: number | null;
  qid: string;
  la: string;
  /** The place's name in the interface language, else English (as the index of places heads it). */
  label: string;
  /** The label's language: the interface's, or English when it fell back; null when the label is the QID. */
  labelLang: Locale | null;
  /** The gazetteer's (English) name, kept for searching. */
  labelEn: string;
  country: string;
  /** A place in several countries (PlaceInfo.countries): the entry counts and filters under each. */
  countries?: string[];
  coords: [number, number];
  typology: string | null;
  /** What the place is to the eulogy (crmedr roles), in crmedr's order. */
  roles: MentionRole[];
}

type MapT = ReturnType<typeof useTranslations<"Map">>;

export interface MapFilters {
  query: string;
  /** Typologies unchecked in the sidebar (all checked by default); NO_TYPOLOGY for none. */
  hiddenTypologies: Set<string>;
  /** Countries checked in the sidebar; empty means every country. */
  countries: Set<string>;
  /** Roles unchecked in the sidebar (all checked by default): an entry shows while any of its roles is checked. */
  hiddenRoles: Set<string>;
}

export const NO_TYPOLOGY = "none";

// crmedr's typology.json `values`, in its order.
const TYPOLOGY_ORDER = [
  "dies_natalis", "depositio", "translatio", "inventio", "dedicatio", "ordinatio", "celebratio", "commemoratio",
];

/**
 * The eulogies an edition prints (its catalog's `present` entries with a printed day) at each of their
 * places on the map, in printed order, a eulogy's places in crmedr's order; `unmapped` counts the
 * printed ones that have none (no resolved place, no place with coordinates, or a deprecated ID, which
 * the gazetteer does not cover) and `mapped` those that have one or more: both count eulogies, not places.
 */
export function mapEntries(
  catalog: CatalogEntryOut[],
  snap: PlacesSnapshot,
  locale: Locale,
  /** The subject to show for an eulogy (the interface language's); the catalog's own, else the ID, by default. */
  subjectOf: (id: string, catalogSubject: string) => string = (_id, s) => s,
): { entries: MapEntry[]; mapped: number; unmapped: number } {
  const entries: MapEntry[] = [];
  let unmapped = 0;
  let mapped = 0;
  for (const c of catalog) {
    const m = c.present !== false ? /^(\d{2})-(\d{2})$/.exec(c.day_printed ?? "") : null;
    if (!m) continue;
    const ep = snap.eulogies[c.id];
    const onMap = (ep?.places ?? []).flatMap((pa) => {
      const place = snap.places[pa.place];
      return place?.coords ? [{ pa, place, coords: place.coords }] : [];
    });
    if (!ep || onMap.length === 0) {
      unmapped++;
      continue;
    }
    mapped++;
    for (const { pa, place, coords } of onMap) {
      entries.push({
        key: `${c.id}@${pa.place}`,
        id: c.id,
        subject: subjectOf(c.id, c.subject ?? c.id),
        editionSubject: c.subject ?? c.id,
        day: { mm: Number(m[1]), dd: Number(m[2]) },
        entry: c.entry ?? null,
        qid: pa.place,
        la: pa.la,
        label: placeLabel(place, pa.place, locale),
        labelLang: placeLabelLang(place, locale),
        labelEn: place.label,
        country: place.country,
        ...(place.countries ? { countries: place.countries } : {}),
        coords,
        typology: ep.typology,
        roles: pa.roles,
      });
    }
  }
  entries.sort(
    (a, b) => a.day.mm - b.day.mm || a.day.dd - b.day.dd || (a.entry ?? Infinity) - (b.entry ?? Infinity),
  );
  return { entries, mapped, unmapped };
}

/** Whether the search text is in the eulogy's subject, ID, printed place or the place's name (shown, or English). */
export function matchesQuery(e: MapEntry, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  return [e.subject, e.editionSubject, e.id, e.la, e.label, e.labelEn].some((s) => fold(s).includes(q));
}

const typologyKey = (e: MapEntry) => e.typology ?? NO_TYPOLOGY;
const typologyOk = (e: MapEntry, f: MapFilters) => !f.hiddenTypologies.has(typologyKey(e));
// An entry in no country counts under "" (shown as unknown).
const countryKeys = (e: MapEntry) => (e.countries?.length ? e.countries : [e.country]);
const countryOk = (e: MapEntry, f: MapFilters) => f.countries.size === 0 || countryKeys(e).some((c) => f.countries.has(c));
const roleOk = (e: MapEntry, f: MapFilters) => e.roles.length === 0 || e.roles.some((r) => !f.hiddenRoles.has(r.role));

export function filterEntries(entries: MapEntry[], f: MapFilters): MapEntry[] {
  return entries.filter((e) => matchesQuery(e, f.query) && typologyOk(e, f) && countryOk(e, f) && roleOk(e, f));
}

function tally(entries: MapEntry[], key: (e: MapEntry) => string | string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of entries) for (const k of [key(e)].flat()) out.set(k, (out.get(k) ?? 0) + 1);
  return out;
}

const typologyRank = (t: string) =>
  t === NO_TYPOLOGY ? Infinity : TYPOLOGY_ORDER.indexOf(t) + 1 || TYPOLOGY_ORDER.length + 1;

const roleRank = (r: string) => (PLACE_ROLES as readonly string[]).indexOf(r) + 1 || PLACE_ROLES.length + 1;

/**
 * How many entries each typology, country and role would show: each facet is counted under the
 * search and the other facets, not its own, so every choice says what it would yield (an entry with
 * two roles counts under both). Typologies in crmedr's order ("none" last); countries by code; roles
 * in crmedr's order.
 */
export function facetCounts(
  entries: MapEntry[],
  f: MapFilters,
): { typologies: [string, number][]; countries: [string, number][]; roles: [string, number][] } {
  const searched = entries.filter((e) => matchesQuery(e, f.query));
  const typologies = [...tally(searched.filter((e) => countryOk(e, f) && roleOk(e, f)), typologyKey)].sort(
    ([a], [b]) => typologyRank(a) - typologyRank(b),
  );
  const countries = [...tally(searched.filter((e) => typologyOk(e, f) && roleOk(e, f)), countryKeys)].sort(
    ([a], [b]) => a.localeCompare(b),
  );
  const roles = new Map<string, number>();
  for (const e of searched.filter((x) => typologyOk(x, f) && countryOk(x, f))) {
    for (const r of new Set(e.roles.map((x) => x.role))) roles.set(r, (roles.get(r) ?? 0) + 1);
  }
  return { typologies, countries, roles: [...roles].sort(([a], [b]) => roleRank(a) - roleRank(b)) };
}

/** "dies_natalis" → "Dies natalis"; a typology without a message is spelled out from its id. */
export function typologyLabel(t: MapT, typology: string | null): string {
  if (typology === null || typology === NO_TYPOLOGY) return t("typology.none");
  if (t.has(`typology.${typology}` as "typology.none")) return t(`typology.${typology}` as "typology.none");
  const s = typology.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
