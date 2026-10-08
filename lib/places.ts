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

export interface PlacesSnapshot {
  places: Record<string, PlaceInfo>;
  eulogies: Record<string, EulogyPlace>;
}

export function getPlaces(): PlacesSnapshot {
  // JSON infers coords as number[]; the snapshot script writes [lat, lon] pairs.
  return snapshot as unknown as PlacesSnapshot;
}
