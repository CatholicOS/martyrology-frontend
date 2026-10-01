import { NextRequest } from "next/server";
import { getToken, type JWT } from "next-auth/jwt";
import { buildUpstreamHeaders } from "@/lib/proxy-headers";
import { resolveAccessToken, sessionCookieHeaders } from "@/lib/session-token";
import { describeError } from "@/lib/describe-error";

const API_BASE = process.env.API_BASE ?? "http://localhost:8000";

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const qs = req.nextUrl.search; // includes leading "?" or ""
  const url = `${API_BASE}/api/v1/${path.map(encodeURIComponent).join("/")}${qs}`;
  const secret = process.env.AUTH_SECRET;
  // Set explicitly: in production behind Plesk's Passenger reverse proxy,
  // req.url is http, so getToken's default would look for
  // `authjs.session-token` while Auth.js (AUTH_URL is https) set
  // `__Secure-authjs.session-token` — every signed-in request would silently
  // go anonymous. The cookie written back below uses the same choice.
  const secureCookie = (process.env.AUTH_URL ?? "").startsWith("https://");

  // Read the token from the encrypted JWT, NOT from auth(). auth() returns the
  // Session, which Auth.js also serves as the body of GET /api/auth/session —
  // so a token routed through the session would be readable by the browser.
  // getToken decodes the cookie server-side and never leaves this process.
  //
  // A failure to read it must not take the site down for anonymous visitors,
  // who are the majority and who need no token at all.
  let token: JWT | null = null;
  try {
    token = await getToken({ req, secret, secureCookie });
  } catch (err) {
    console.warn(`[api/mr] could not read the session token; proxying anonymously (${describeError(err)})`);
  }

  // Refresh an expired access token here, before the upstream call. This
  // route is the token's only consumer, and a Route Handler — unlike the
  // Server Components that call auth() — can persist the refreshed token in
  // the session cookie. A token that cannot be used or refreshed means an
  // anonymous request (redacted text), never a 401 caused by a dead token.
  const { accessToken, persist } = await resolveAccessToken(token);

  let setCookies: string[] = [];
  if (persist && secret) {
    try {
      setCookies = await sessionCookieHeaders(persist, {
        secret,
        secure: secureCookie,
        requestCookieHeader: req.headers.get("cookie"),
      });
    } catch (err) {
      console.warn(`[api/mr] could not persist the session token (${describeError(err)})`);
    }
  }

  const respond = (body: string, status: number, contentType: string) => {
    const headers = new Headers({ "content-type": contentType });
    for (const cookie of setCookies) headers.append("set-cookie", cookie);
    return new Response(body, { status, headers });
  };

  try {
    const upstream = await fetch(url, { headers: buildUpstreamHeaders(accessToken), cache: "no-store" });
    const body = await upstream.text();
    return respond(body, upstream.status, upstream.headers.get("content-type") ?? "application/json");
  } catch {
    return respond(
      JSON.stringify({ title: "API unreachable", detail: `Could not reach ${API_BASE}` }),
      502,
      "application/json",
    );
  }
}
