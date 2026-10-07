import { API_BASE, API_PUBLIC_URL, withPublicServer } from "@/lib/api-docs";

/** The API's OpenAPI document, fetched server-side (the API sends no CORS headers) with the public API as server. */
export async function GET() {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/openapi.json`, { cache: "no-store" });
  } catch {
    return Response.json({ title: "The API could not be reached" }, { status: 502 });
  }
  if (!res.ok) return Response.json({ title: "The API's document could not be loaded" }, { status: 502 });
  const doc = withPublicServer(await res.json(), API_PUBLIC_URL);
  return Response.json(doc, { headers: { "cache-control": "public, max-age=300" } });
}
