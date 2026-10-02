import { editionTitle, titleCase } from "@/lib/editions";
import type { EditionOut } from "@/lib/types";

const API_BASE = process.env.API_BASE ?? "http://localhost:8000";

/**
 * Whether the API knows this edition, so /read can 404 on a mistyped link.
 * If the API cannot be asked, assume yes: the reader then shows its own
 * "unreachable" state rather than a misleading 404.
 */
export async function editionExists(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/editions`, { next: { revalidate: 3600 } });
    if (!res.ok) return true;
    const body = (await res.json()) as { editions: { edition_id: string }[] };
    return body.editions.some((e) => e.edition_id === id);
  } catch {
    return true;
  }
}

/** Display name and year for a page title; null when the edition is unknown or the API cannot be asked. */
export async function editionMeta(id: string): Promise<{ title: string; year: number } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/editions`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const body = (await res.json()) as { editions: EditionOut[] };
    const e = body.editions.find((x) => x.edition_id === id);
    return e ? { title: titleCase(editionTitle(e)), year: e.year } : null;
  } catch {
    return null;
  }
}
