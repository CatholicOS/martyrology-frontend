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
