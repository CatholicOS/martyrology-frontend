/**
 * The API reference at /scalar (Scalar): the API's OpenAPI document, served from this site so the browser needs no
 * CORS from the API, and the proxy Scalar's "Test request" goes through.
 */

/** Where the frontend reaches the API (server-side; may be an internal address). */
export const API_BASE = process.env.API_BASE ?? "http://localhost:8000";

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
