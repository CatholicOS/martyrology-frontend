import { ApiError } from "@/lib/api";

/** The statuses for a proxy or gateway that could not reach the API (the route answers 502). */
const UNREACHABLE = new Set([502, 503, 504]);

/**
 * The title of an ApiError for the UI: a translated message for an unreachable API (the route's own title is
 * English), the error's raw title otherwise.
 */
export function apiErrorTitle(err: ApiError, unreachable: string): string {
  return UNREACHABLE.has(err.status) ? unreachable : err.title;
}
