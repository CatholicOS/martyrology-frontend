// Token-lifecycle logic, kept free of Auth.js imports so it can be unit
// tested without booting a provider. auth.ts is the only consumer.

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

export async function refreshAccessToken(
  token: ZitadelToken,
  fetchImpl: typeof fetch = fetch,
): Promise<ZitadelToken> {
  if (!token.refresh_token) {
    return { ...token, error: "RefreshAccessTokenError" };
  }

  const issuer = process.env.AUTH_ZITADEL_ISSUER ?? "";
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
    });
    if (!res.ok) return { ...token, error: "RefreshAccessTokenError" };

    const refreshed = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    return {
      access_token: refreshed.access_token,
      // Zitadel rotates refresh tokens, but not on every response. Keeping the
      // previous one when none is returned avoids logging the curator out.
      refresh_token: refreshed.refresh_token ?? token.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}
