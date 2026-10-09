import { editionTitle, titleCase } from "@/lib/editions";
import type { CatalogEntryOut, EditionOut, Locale } from "@/lib/types";

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

/** The API's edition list, from the data cache (revalidated hourly). Null when the API cannot be asked. */
export async function listEditions(): Promise<EditionOut[] | null> {
  return fetchEditions(false);
}

/**
 * The edition from the cached list; on a miss, from a fresh one, so an edition published by an
 * API release is found at once rather than when the hour-long cache expires. Undefined when the
 * API cannot be asked, null when it does not know the edition.
 */
export async function editionInfo(id: string): Promise<EditionOut | null | undefined> {
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
  return (await editionInfo(id)) !== null;
}

/** Display name and year for a page title; null when the edition is unknown or the API cannot be asked. */
export async function editionMeta(id: string): Promise<{ title: string; year: number } | null> {
  const e = await editionInfo(id);
  return e ? { title: titleCase(editionTitle(e)), year: e.year } : null;
}

/** The catalog in one answer of the API, or null when the answer is not one (a proxy's error page, an unexpected body). */
async function readCatalog(res: Response): Promise<CatalogEntryOut[] | null> {
  if (!res.ok) throw new Error(`catalog ${res.status}`);
  try {
    const body = (await res.json()) as { elogia?: unknown };
    return Array.isArray(body.elogia) ? (body.elogia as CatalogEntryOut[]) : null;
  } catch {
    return null;
  }
}

/**
 * The edition's catalog (every eulogy, with its subject in `lang`), from the data cache (revalidated
 * hourly). The cache keeps any answer the API gave with a 200, so an answer that is not a catalog is
 * asked for again, fresh, rather than served for the hour. Throws when the API cannot give it.
 */
export async function fetchCatalog(edition: string, lang: Locale): Promise<CatalogEntryOut[]> {
  const url = `${API_BASE}/api/v1/elogia?edition=${encodeURIComponent(edition)}&locale=${lang}`;
  const cached = await readCatalog(await fetch(url, { next: { revalidate: 3600 } }));
  if (cached) return cached;
  const fresh = await readCatalog(await fetch(url, { cache: "no-store" }));
  if (fresh) return fresh;
  throw new Error(`catalog of ${edition}: the API's answer is not a catalog`);
}
