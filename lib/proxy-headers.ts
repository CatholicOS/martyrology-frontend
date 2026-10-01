/**
 * Build the header map for the upstream API call.
 *
 * With no token this returns exactly what the proxy sent before sign-in
 * existed, which is what keeps anonymous browsing byte-identical: the API
 * redacts restricted editions for callers it cannot identify, and that
 * behaviour is a feature, not a fallback.
 */
export function buildUpstreamHeaders(accessToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  return headers;
}
