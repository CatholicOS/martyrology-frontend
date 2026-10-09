import type { NextRequest } from "next/server";
import { entitiesFor, MAX_IDS, parseIds } from "@/lib/entities";
import { getPersonDetails } from "@/lib/person-details";
import { getPersons } from "@/lib/persons";
import { getPlaces } from "@/lib/places";

// The same for every reader and fixed between deploys: shared caches may keep it an hour.
const CACHE = { "cache-control": "public, max-age=3600" };

/**
 * The names, details and positions of the persons and places a reader's page marks (/api/entities?ids=Q1,Q2),
 * read from the snapshots here so the reader never downloads them.
 */
export function GET(request: NextRequest) {
  const ids = parseIds(request.nextUrl.searchParams.get("ids"));
  if (ids === null) {
    return Response.json(
      { title: `At most ${MAX_IDS} items per request`, status: 400 },
      { status: 400, headers: { "content-type": "application/problem+json" } },
    );
  }
  return Response.json({ entities: entitiesFor(ids, getPersons(), getPersonDetails(), getPlaces()) }, { headers: CACHE });
}
