/**
 * The API reference at /scalar (Scalar): the API's OpenAPI document, served from this site so the browser needs no
 * CORS from the API, and the proxy Scalar's "Test request" goes through.
 */

/** Where the frontend reaches the API (server-side; may be an internal address). */
export const API_BASE = (process.env.API_BASE ?? "http://localhost:8000").replace(/\/+$/, "");

/** The API's public address, shown to readers of the reference as the server to call. */
export const API_PUBLIC_URL = (process.env.API_PUBLIC_URL ?? "https://api.romanmartyrology.com").replace(/\/+$/, "");

/** The OpenAPI document with the public API as its only server. */
export function withPublicServer(doc: Record<string, unknown>, publicUrl: string): Record<string, unknown> {
  return { ...doc, servers: [{ url: publicUrl, description: "Roman Martyrology API" }] };
}

/**
 * The API URL a proxied request goes to: `target` (Scalar's `scalar_url`) must be on the public API's origin; its
 * path and query are sent to `apiBase`. Null for anything else, so the proxy can't be pointed at another host.
 */
export function proxyTarget(target: string | null, publicUrl: string, apiBase: string): string | null {
  if (!target) return null;
  let url: URL;
  let pub: URL;
  try {
    url = new URL(target);
    pub = new URL(publicUrl);
  } catch {
    return null;
  }
  if (url.origin !== pub.origin || url.username || url.password) return null;
  return `${apiBase.replace(/\/+$/, "")}${url.pathname}${url.search}`;
}

/**
 * Where a redirect from the API sends the reader, through the proxy again: `location` (resolved against the URL that
 * answered) must be on the API, reached at `apiBase` or at `publicUrl`; it comes back as `/scalar/proxy?scalar_url=`
 * the public URL. Null for a redirect anywhere else, which the proxy doesn't follow.
 */
export function proxiedLocation(location: string, from: string, apiBase: string, publicUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(location, from);
  } catch {
    return null;
  }
  const onApi = [apiBase, publicUrl].some((base) => {
    try {
      return url.origin === new URL(base).origin;
    } catch {
      return false;
    }
  });
  if (!onApi || url.username || url.password) return null;
  const pub = `${publicUrl.replace(/\/+$/, "")}${url.pathname}${url.search}`;
  return `/scalar/proxy?${new URLSearchParams([["scalar_url", pub]]).toString()}`;
}
