import type { NextRequest } from "next/server";
import { API_BASE, API_PUBLIC_URL, proxyTarget } from "@/lib/api-docs";

// The request headers worth passing on to the API, and the response headers worth passing back.
const FORWARD = ["accept", "accept-language", "authorization", "x-curation-branch"];
const RETURN = ["content-type", "cache-control", "etag", "vary", "last-modified"];

/**
 * Scalar's "Test request" for the API reference: GET and HEAD only, and only to the public API, which is reached
 * through API_BASE. The target is Scalar's `scalar_url` query parameter.
 */
async function proxy(req: NextRequest): Promise<Response> {
  const target = proxyTarget(req.nextUrl.searchParams.get("scalar_url"), API_PUBLIC_URL, API_BASE);
  if (!target) return Response.json({ title: "Only requests to the API can be tried here" }, { status: 400 });
  const headers = new Headers();
  for (const h of FORWARD) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  let res: Response;
  try {
    res = await fetch(target, { method: req.method, headers, cache: "no-store", redirect: "manual" });
  } catch {
    return Response.json({ title: "The API could not be reached" }, { status: 502 });
  }
  const out = new Headers();
  for (const h of RETURN) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  return new Response(req.method === "HEAD" ? null : res.body, { status: res.status, headers: out });
}

export const GET = proxy;
export const HEAD = proxy;

/** Writes aren't tried from the reference: they change data, and need a curator's token. */
function readOnly() {
  return Response.json(
    { title: "Only GET requests can be tried from the API reference; use curl for the others" },
    { status: 405, headers: { allow: "GET, HEAD" } },
  );
}

export const POST = readOnly;
export const PUT = readOnly;
export const PATCH = readOnly;
export const DELETE = readOnly;
