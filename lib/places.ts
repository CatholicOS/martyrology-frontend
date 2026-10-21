import snapshot from "@/data/places-snapshot.json";
import type { Locale } from "@/i18n/routing";
import type { MentionRole } from "@/lib/types";

/** A Wikidata place: its English label, its labels in the interface languages, its modern country (ISO 3166-1 alpha-2) and [lat, lon], null when Wikidata has none. */
export interface PlaceInfo {
  label: string;
  /** "" for a place in no single country; then `countries` lists them when it lies in several (Frisia: NL, DE). */
  country: string;
  countries?: string[];
  coords: [number, number] | null;
  labels?: Partial<Record<Locale, string>>;
  /** The names the Latin prints for the place, "Oświęcim seu Auschwitz" (crmedr's places_variants_curated). */
  also?: string[];
}

/**
 * One place a eulogy names (QID), as the Latin 2004 and the Italian print it, with its roles in the
 * eulogy (crmedr's, in its order: whose, when the eulogy says).
 */
export interface PlaceAt {
  place: string;
  la: string;
  it?: string;
  roles: MentionRole[];
}

/** A current eulogy's typology and the places it names that resolve to Wikidata, the opening place first. */
export interface EulogyPlaces {
  typology: string | null;
  places: PlaceAt[];
}

export interface PlacesSnapshot {
  places: Record<string, PlaceInfo>;
  eulogies: Record<string, EulogyPlaces>;
}

export function getPlaces(): PlacesSnapshot {
  // JSON infers coords as number[]; the snapshot script writes [lat, lon] pairs.
  return snapshot as unknown as PlacesSnapshot;
}
