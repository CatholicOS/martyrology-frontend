import snapshot from "@/data/event-details-snapshot.json";
import type { EventDetails } from "@/lib/entities";

/** The events' (councils', synods') Wikidata details for the popups: for server code only (/api/entities). */
export function getEventDetails(): Record<string, EventDetails> {
  return snapshot as unknown as Record<string, EventDetails>;
}
