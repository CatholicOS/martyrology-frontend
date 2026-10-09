import snapshot from "@/data/person-details-snapshot.json";
import type { PersonDetails } from "@/lib/entities";

/** The persons' Wikidata details for the popups: for server code only (/api/entities). */
export function getPersonDetails(): Record<string, PersonDetails> {
  return snapshot as unknown as Record<string, PersonDetails>;
}
