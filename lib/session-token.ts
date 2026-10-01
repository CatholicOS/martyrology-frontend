// Access-token lifecycle for the /api/mr proxy: decide whether the decoded
// session token can be used as is, refresh it if not, and write the result
// back as the Auth.js session cookie.
//
// This lives here, not in Auth.js's jwt callback, because the only place that
// can persist a refreshed token is a Route Handler. The jwt callback also runs
// under auth() in Server Components, where Auth.js discards the Set-Cookie
// (next-auth/lib/index.js, React Server Components branch): a refresh there
// would burn a rotating refresh token on every header render and still leave
// the proxy holding the expired access token.
import { encode, type JWT } from "next-auth/jwt";
import {
  isExpired,
  refreshAccessToken,
  REFRESH_REJECTED,
  REFRESH_TRANSIENT,
  type ZitadelToken,
} from "@/lib/zitadel-token";

/** Auth.js's default session.maxAge (@auth/core lib/init.js). */
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * Largest cookie value written as a single cookie. Mirrors Auth.js's own
 * threshold (@auth/core lib/utils/cookie.js: 4096 allowed − 160 estimated
 * for name and attributes); above it Auth.js would chunk, which we do not.
 */
export const MAX_COOKIE_VALUE_LENGTH = 4096 - 160;

/** The name Auth.js and getToken use (@auth/core defaultCookies). */
export function sessionCookieName(secure: boolean): string {
  return `${secure ? "__Secure-" : ""}authjs.session-token`;
}

export type Resolution = {
  /** Bearer token to forward upstream; undefined means proxy anonymously. */
  accessToken?: string;
  /** Session token to write back as the cookie; undefined means leave it. */
  persist?: JWT;
};

type Refresh = (token: ZitadelToken) => Promise<ZitadelToken>;

export async function resolveAccessToken(
  token: JWT | null,
  { nowMs = Date.now(), refresh = refreshAccessToken }: { nowMs?: number; refresh?: Refresh } = {},
): Promise<Resolution> {
  if (!token || typeof token.access_token !== "string" || !token.access_token) return {};
  // A session already marked dead stays anonymous until the curator signs in
  // again; retrying would only hit the issuer with a refresh token it refused.
  if (token.error) return {};
  if (!isExpired(token.expires_at, nowMs)) return { accessToken: token.access_token };

  if (!token.refresh_token) return { persist: errorState(token) };

  const result = await refreshOnce(token, refresh);
  if (!result.error && typeof result.access_token === "string") {
    const updated: JWT = {
      ...token,
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_at: result.expires_at,
    };
    delete updated.error;
    return { accessToken: result.access_token, persist: updated };
  }
  // Only a definitive rejection ends the session. A transient failure leaves
  // the cookie alone so the next request retries with the same refresh token.
  if (result.error === REFRESH_REJECTED) return { persist: errorState(token) };
  return {};
}

function errorState(token: JWT): JWT {
  const { access_token: _dropped, ...rest } = token;
  void _dropped;
  return { ...rest, error: REFRESH_REJECTED };
}

// Zitadel rotates refresh tokens: once one is used, a second use is refused.
// Pages fetch several /api/mr resources at once (e.g. Promise.all on
// /compare), so without this the parallel requests would race, all but one
// would be refused, and an error-state Set-Cookie could overwrite the good
// one. Concurrent requests carrying the same refresh token therefore share a
// single refresh, and the outcome is kept briefly for requests that were sent
// with the old cookie before the browser received the new one. In-process
// only: separate Node processes do not share it.
const RETAIN_MS = 30_000;
const refreshes = new Map<string, Promise<ZitadelToken>>();

function refreshOnce(token: JWT, refresh: Refresh): Promise<ZitadelToken> {
  const key = token.refresh_token as string;
  const existing = refreshes.get(key);
  if (existing) return existing;

  const pending = refresh(token)
    .catch((): ZitadelToken => ({ error: REFRESH_TRANSIENT }))
    .then((result) => {
      if (result.error === REFRESH_TRANSIENT) {
        refreshes.delete(key);
      } else {
        const timer = setTimeout(() => refreshes.delete(key), RETAIN_MS);
        (timer as { unref?: () => void }).unref?.();
      }
      return result;
    });
  refreshes.set(key, pending);
  return pending;
}

/**
 * Serialize the session token as Set-Cookie header values, in the format
 * Auth.js itself writes and getToken reads: same name, same salt (the cookie
 * name), same encryption, same attributes. Also expires any chunked
 * `<name>.N` cookies present on the request, which would otherwise be joined
 * with the new value by getToken.
 *
 * Returns [] (persist nothing) when the encoded token is too large for a
 * single cookie.
 */
export async function sessionCookieHeaders(
  token: JWT,
  {
    secret,
    secure,
    requestCookieHeader,
    nowMs = Date.now(),
  }: { secret: string; secure: boolean; requestCookieHeader?: string | null; nowMs?: number },
): Promise<string[]> {
  const name = sessionCookieName(secure);
  const value = await encode({ token, secret, salt: name, maxAge: SESSION_MAX_AGE });
  if (value.length > MAX_COOKIE_VALUE_LENGTH) {
    console.warn(
      `[session-token] encoded session is ${value.length} bytes, over the single-cookie limit; not persisting it`,
    );
    return [];
  }

  const attrs = `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
  const expires = new Date(nowMs + SESSION_MAX_AGE * 1000).toUTCString();
  const headers = [`${name}=${value}; ${attrs}; Expires=${expires}; Max-Age=${SESSION_MAX_AGE}`];

  const chunk = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.\\d+$`);
  for (const cookieName of cookieNames(requestCookieHeader)) {
    if (chunk.test(cookieName)) {
      headers.push(`${cookieName}=; ${attrs}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0`);
    }
  }
  return headers;
}

function cookieNames(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(";")
    .map((pair) => pair.split("=")[0].trim())
    .filter(Boolean);
}
