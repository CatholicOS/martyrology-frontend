import type { Locale } from "@/i18n/routing";
import type { PersonsSnapshot } from "@/lib/persons";
import type { PlacesSnapshot } from "@/lib/places";

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

/** What a popup shows of one Wikidata item: a person's names and details, or a place's names and position. */
export type Entity =
  | { kind: "person"; labels: Labels; details: PersonDetails | null }
  | { kind: "place"; labels: Labels; label: string; country: string; coords: [number, number] | null };

/** The most items one request may ask for: a day names a few dozen, a spread of two long days up to ~150. */
export const MAX_IDS = 200;

const QID = /^Q[1-9]\d*$/;

/** The QIDs a request asks for (`ids=Q1,Q2`), well-formed and each once; null when there are more than MAX_IDS. */
export function parseIds(param: string | null): string[] | null {
  const ids = [...new Set((param ?? "").split(",").map((s) => s.trim()).filter((s) => QID.test(s)))];
  return ids.length > MAX_IDS ? null : ids;
}

/**
 * What the popups show of each item asked for that the snapshots know: a place's labels, country and position,
 * else a person's labels and details. An item none of them knows is left out.
 */
export function entitiesFor(
  ids: string[], persons: PersonsSnapshot, details: Record<string, PersonDetails>, places: PlacesSnapshot,
): Record<string, Entity> {
  const out: Record<string, Entity> = {};
  for (const q of ids) {
    const p = places.places[q];
    if (p) out[q] = { kind: "place", labels: p.labels ?? {}, label: p.label, country: p.country, coords: p.coords };
    else if (persons.labels[q] || details[q]) out[q] = { kind: "person", labels: persons.labels[q] ?? {}, details: details[q] ?? null };
  }
  return out;
}
