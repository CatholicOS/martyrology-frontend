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
  // JSON infers coords as number[]; the snapshot script writes [lat, lon] pairs.
  return snapshot as unknown as PlacesSnapshot;
}
