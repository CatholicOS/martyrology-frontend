import snapshot from "@/data/persons-snapshot.json";
import type { Locale } from "@/i18n/routing";

/** A saint or blessed a eulogy names: the Latin name, which person of that name in the eulogy (`n`, from 2;
 *  absent for the first), where it is printed, and the Wikidata item crmedr decided. */
export interface PersonMention {
  name: string;
  n?: number;
  where: "text" | { footnote: number };
  wikidata?: string;
}

export interface PersonsSnapshot {
  editions: Record<string, Record<string, PersonMention[]>>;
  labels: Record<string, Partial<Record<Locale, string>>>;
}

/** The persons snapshot: large, so for server code only (the index of names). */
export function getPersons(): PersonsSnapshot {
  return snapshot as unknown as PersonsSnapshot;
}
