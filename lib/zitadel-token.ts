// Token-lifecycle logic, kept free of Auth.js imports so it can be unit
// tested without booting a provider. lib/session-token.ts (used by the
// /api/mr route) is the only consumer.

export type ZitadelToken = {
  access_token?: string;
  refresh_token?: string;
  /** Seconds since epoch, matching Auth.js's account.expires_at. */
  expires_at?: number;
  error?: string;
};

/**
 * Refresh 60s before the wall-clock expiry. Without the skew a token that
 * passes this check can still expire in flight, between the session read and
 * the upstream API call, which surfaces as a spurious 401 for the curator.
 */
const SKEW_SECONDS = 60;

export function isExpired(expiresAt: number | undefined, nowMs: number): boolean {
  if (expiresAt === undefined) return true;
  return expiresAt - SKEW_SECONDS <= Math.floor(nowMs / 1000);
}

/**
 * The issuer definitively rejected the refresh (HTTP 4xx, e.g. invalid_grant),
 * or there is no refresh token to try. The session cannot recover; the
 * curator has to sign in again. Safe to persist and to show on the Session.
 */
export const REFRESH_REJECTED = "RefreshAccessTokenError";

/**
 * The refresh could not be completed for a reason that may not recur: network
 * failure, timeout, 5xx, or an unusable response body. Never persisted — the
 * next request simply tries again with the same refresh token.
 */
export const REFRESH_TRANSIENT = "RefreshAccessTokenTransientError";

/** Bound the token-endpoint call so a hung issuer cannot hang the proxy. */
const REFRESH_TIMEOUT_MS = 5_000;

export async function refreshAccessToken(
  token: ZitadelToken,
  fetchImpl: typeof fetch = fetch,
): Promise<ZitadelToken> {
  if (!token.refresh_token) {
    return { ...token, error: REFRESH_REJECTED };
  }

  // An issuer configured with a trailing slash must not produce
  // `https://issuer//oauth/v2/token`.
  const issuer = (process.env.AUTH_ZITADEL_ISSUER ?? "").replace(/\/+$/, "");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: token.refresh_token,
    client_id: process.env.AUTH_ZITADEL_ID ?? "",
    client_secret: process.env.AUTH_ZITADEL_SECRET ?? "",
  });

  try {
    const res = await fetchImpl(`${issuer}/oauth/v2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
    if (res.status >= 400 && res.status < 500) return { ...token, error: REFRESH_REJECTED };
    if (!res.ok) return { ...token, error: REFRESH_TRANSIENT };

    const refreshed = (await res.json()) as {
      access_token?: unknown;
      refresh_token?: unknown;
      expires_in?: unknown;
    };
    if (typeof refreshed.access_token !== "string" || typeof refreshed.expires_in !== "number") {
      return { ...token, error: REFRESH_TRANSIENT };
    }

    return {
      access_token: refreshed.access_token,
      // Zitadel rotates refresh tokens, but not on every response. Keeping the
      // previous one when none is returned avoids logging the curator out.
      refresh_token:
        typeof refreshed.refresh_token === "string" ? refreshed.refresh_token : token.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in,
      error: undefined,
    };
  } catch {
    // Network error, AbortSignal timeout, or a non-JSON body.
    return { ...token, error: REFRESH_TRANSIENT };
  }
}
