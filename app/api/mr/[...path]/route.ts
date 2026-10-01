import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { buildUpstreamHeaders } from "@/lib/proxy-headers";

const API_BASE = process.env.API_BASE ?? "http://localhost:8000";

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const qs = req.nextUrl.search; // includes leading "?" or ""
  const url = `${API_BASE}/api/v1/${path.map(encodeURIComponent).join("/")}${qs}`;
  // Read the token from the encrypted JWT, NOT from auth(). auth() returns the
  // Session, which Auth.js also serves as the body of GET /api/auth/session —
  // so a token routed through the session would be readable by the browser.
  // getToken decodes the cookie server-side and never leaves this process.
  //
  // A failure to read it must not take the site down for anonymous visitors,
  // who are the majority and who need no token at all.
  let accessToken: string | undefined;
  try {
    const token = await getToken({
      req,
      secret: process.env.AUTH_SECRET,
      // Set explicitly: in production behind Plesk's Passenger reverse proxy,
      // req.url is http, so getToken's default would look for
      // `authjs.session-token` while Auth.js (AUTH_URL is https) set
      // `__Secure-authjs.session-token` — every signed-in request would
      // silently go anonymous.
      secureCookie: (process.env.AUTH_URL ?? "").startsWith("https://"),
    });
    accessToken = typeof token?.access_token === "string" ? token.access_token : undefined;
  } catch {
    accessToken = undefined;
  }

  try {
    const upstream = await fetch(url, { headers: buildUpstreamHeaders(accessToken), cache: "no-store" });
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
