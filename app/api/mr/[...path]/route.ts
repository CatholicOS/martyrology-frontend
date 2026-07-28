import { NextRequest } from "next/server";

const API_BASE = process.env.API_BASE ?? "http://localhost:8000";

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const qs = req.nextUrl.search; // includes leading "?" or ""
  const url = `${API_BASE}/api/v1/${path.map(encodeURIComponent).join("/")}${qs}`;
  try {
    const upstream = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ title: "API unreachable", detail: `Could not reach ${API_BASE}` }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}
