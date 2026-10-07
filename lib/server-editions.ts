import { editionTitle, titleCase } from "@/lib/editions";
import type { EditionOut } from "@/lib/types";

const API_BASE = process.env.API_BASE ?? "http://localhost:8000";

/**
 * The API's edition list, from the data cache (revalidated hourly) or fresh. Null when the API
 * cannot be asked.
 */
async function fetchEditions(fresh: boolean): Promise<EditionOut[] | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/editions`,
      fresh ? { cache: "no-store" } : { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    return ((await res.json()) as { editions: EditionOut[] }).editions;
  } catch {
    return null;
  }
}

/**
 * The edition from the cached list; on a miss, from a fresh one, so an edition published by an
 * API release is found at once rather than when the hour-long cache expires. Undefined when the
 * API cannot be asked, null when it does not know the edition.
 */
async function findEdition(id: string): Promise<EditionOut | null | undefined> {
  const cached = await fetchEditions(false);
  const hit = cached?.find((e) => e.edition_id === id);
  if (hit) return hit;
  const fresh = await fetchEditions(true);
  if (fresh) return fresh.find((e) => e.edition_id === id) ?? null;
  return cached ? null : undefined;
}

/**
 * Whether the API knows this edition, so /read can 404 on a mistyped link.
 * If the API cannot be asked, assume yes: the reader then shows its own
 * "unreachable" state rather than a misleading 404.
 */
export async function editionExists(id: string): Promise<boolean> {
  return (await findEdition(id)) !== null;
}

/** Display name and year for a page title; null when the edition is unknown or the API cannot be asked. */
export async function editionMeta(id: string): Promise<{ title: string; year: number } | null> {
  const e = await findEdition(id);
  return e ? { title: titleCase(editionTitle(e)), year: e.year } : null;
}
