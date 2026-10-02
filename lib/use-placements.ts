"use client";

import { useEffect, useState } from "react";
import { ApiError, getElogium } from "@/lib/api";
import type { Placements } from "@/lib/parallel";

// For the session: an id's placements in every edition ({} when the API does not know it).
// A failed fetch is not cached, so the next page asks again.
const cache = new Map<string, Placements[string]>();

/** Test-only: forgets every cached placement. */
export function __resetPlacements() {
  cache.clear();
}

/** Every edition's placement of each eulogy in `ids`; an id still loading, or whose fetch failed, is absent. */
export function usePlacements(ids: string[]): Placements {
  const [, setVersion] = useState(0);
  const key = ids.join(" ");

  useEffect(() => {
    const missing = key ? key.split(" ").filter((id) => !cache.has(id)) : [];
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map((id) =>
        getElogium(id).then(
          (e) => void cache.set(id, e.editions),
          (err: unknown) => {
            if (err instanceof ApiError && err.status === 404) cache.set(id, {});
          },
        ),
      ),
    ).then(() => {
      if (!cancelled) setVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return Object.fromEntries(ids.flatMap((id) => (cache.has(id) ? [[id, cache.get(id)!]] : [])));
}
