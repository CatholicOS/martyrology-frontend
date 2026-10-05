const API_BASE = process.env.API_BASE ?? "http://localhost:8000";

/** What the site is serving: the API's release and the CRMEDR registry commit it pins. */
export interface DataVersions {
  api: string;
  /** A commit hash: CRMEDR has no releases yet. */
  crmedr: string;
}

/**
 * The versions the API reports on /healthz, for the footer. Asked at most every
 * five minutes; null when the API cannot be asked, so an outage never breaks a page.
 */
export async function getDataVersions(): Promise<DataVersions | null> {
  try {
    const res = await fetch(`${API_BASE}/healthz`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: string; data?: { crmedr?: string } };
    return body.version && body.data?.crmedr ? { api: body.version, crmedr: body.data.crmedr } : null;
  } catch {
    return null;
  }
}
