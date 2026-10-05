const API_BASE = process.env.API_BASE ?? "http://localhost:8000";

/** What the site is serving: the API's release and the CRMEDR registry commit it pins. */
export interface DataVersions {
  api: string;
  /** A commit hash: CRMEDR has no releases yet. */
  crmedr: string;
}

// The root layout awaits this on every page: a hung API must not hold the page up.
const DEADLINE_MS = 2000;

const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/**
 * The versions the API reports on /healthz, for the footer. Asked at most every
 * five minutes, with a short deadline; null when the API cannot be asked in time
 * or does not report them, so an outage never breaks a page.
 */
export async function getDataVersions(): Promise<DataVersions | null> {
  try {
    const res = await fetch(`${API_BASE}/healthz`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(DEADLINE_MS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: unknown; data?: { crmedr?: unknown } };
    const api = body.version;
    const crmedr = body.data?.crmedr;
    return nonEmpty(api) && nonEmpty(crmedr) ? { api, crmedr } : null;
  } catch {
    return null;
  }
}
