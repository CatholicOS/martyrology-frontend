import type { Locale } from "@/i18n/routing";
import type { PersonsSnapshot } from "@/lib/persons";
import type { PlacesSnapshot } from "@/lib/places";
import type { RegistrySnapshot, SnapshotEntry } from "@/lib/snapshot";

/** A text in some of the interface languages. */
export type Labels = Partial<Record<Locale, string>>;

/** A Commons file and the credit it must be shown with: the license always, the author and license link when Commons gives them. */
export interface CommonsImage {
  file: string;
  author: string | null;
  license: string;
  license_url: string | null;
}

/**
 * A Wikidata date as crmedr keeps it: the year (negative before Christ), how precise Wikidata is about it, and
 * whether it is "circa". For a decade or a century, `year` is any year in it.
 */
export interface WikidataDate {
  year: number;
  precision: "year" | "decade" | "century";
  circa: boolean;
}

/** A person's Wikidata details for the popup (crmedr data/person_details.json). */
export interface PersonDetails {
  description: Labels;
  born: WikidataDate | null;
  died: WikidataDate | null;
  image: CommonsImage | null;
  wikipedia: Labels;
}

/** A eulogy that names a person: its day and subject, and whether the subject names them (their own eulogy). */
export interface EulogyLink {
  id: string;
  month: number;
  day: number;
  subject: SnapshotEntry["subject"];
  own: boolean;
}

/**
 * What a popup shows of one Wikidata item: a person's names, details and the eulogies that name them, or a
 * place's names and position.
 */
export type Entity =
  | { kind: "person"; labels: Labels; details: PersonDetails | null; eulogies: EulogyLink[] }
  | { kind: "place"; labels: Labels; label: string; country: string; countries?: string[]; coords: [number, number] | null };

/** The most items one request may ask for: a day names a few dozen, a spread of two long days up to ~150. */
export const MAX_IDS = 200;

const QID = /^Q[1-9]\d*$/;

/** The QIDs a request asks for (`ids=Q1,Q2`), well-formed and each once; null when there are more than MAX_IDS. */
export function parseIds(param: string | null): string[] | null {
  const ids = [...new Set((param ?? "").split(",").map((s) => s.trim()).filter((s) => QID.test(s)))];
  return ids.length > MAX_IDS ? null : ids;
}

/** A name's words, lowercased, without accents, æ and œ as ae and oe. */
const words = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/æ/g, "ae").replace(/œ/g, "oe").match(/\p{L}+/gu) ?? [];

const linksBy = new WeakMap<PersonsSnapshot, Map<string, EulogyLink[]>>();

/**
 * The eulogies that name each item, by QID: their own first (every word of the person's name is in the Latin
 * subject), then by day; deprecated eulogies and those the registry does not know are left out.
 */
function eulogyLinks(persons: PersonsSnapshot, registry: RegistrySnapshot): Map<string, EulogyLink[]> {
  const cached = linksBy.get(persons);
  if (cached) return cached;
  const out = new Map<string, EulogyLink[]>();
  for (const eulogies of Object.values(persons.editions)) {
    for (const [id, mentions] of Object.entries(eulogies)) {
      const e = registry[id];
      if (!e || e.deprecated) continue;
      const subject = new Set(words(e.subject.la));
      for (const m of mentions) {
        if (!m.wikidata) continue;
        const links = out.get(m.wikidata) ?? [];
        const own = words(m.name).every((w) => subject.has(w));
        const seen = links.find((l) => l.id === id);
        if (seen) seen.own ||= own;
        else links.push({ id, month: e.month, day: e.day, subject: e.subject, own });
        out.set(m.wikidata, links);
      }
    }
  }
  for (const links of out.values()) {
    links.sort((x, y) => Number(y.own) - Number(x.own) || x.month - y.month || x.day - y.day || x.id.localeCompare(y.id));
  }
  linksBy.set(persons, out);
  return out;
}

/**
 * What the popups show of each item asked for that the snapshots know: a place's labels, country and position,
 * else a person's labels, details and eulogies. An item none of them knows is left out.
 */
export function entitiesFor(
  ids: string[], persons: PersonsSnapshot, details: Record<string, PersonDetails>, places: PlacesSnapshot,
  registry: RegistrySnapshot,
): Record<string, Entity> {
  const links = eulogyLinks(persons, registry);
  const out: Record<string, Entity> = {};
  for (const q of ids) {
    const p = places.places[q];
    if (p) out[q] = { kind: "place", labels: p.labels ?? {}, label: p.label, country: p.country, ...(p.countries ? { countries: p.countries } : {}), coords: p.coords };
    else if (persons.labels[q] || details[q] || links.has(q)) out[q] = {
      kind: "person", labels: persons.labels[q] ?? {}, details: details[q] ?? null, eulogies: links.get(q) ?? [],
    };
  }
  return out;
}
