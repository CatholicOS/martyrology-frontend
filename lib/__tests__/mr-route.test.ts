import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the JWT reader, not the session. The route deliberately never calls
// auth() — see the comment in route.ts. encode/decode stay real so the
// Set-Cookie the route writes is a genuine Auth.js session cookie.
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("next-auth/jwt", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next-auth/jwt")>()),
  getToken: authMock,
}));

import { GET } from "@/app/api/mr/[...path]/route";

const ISSUER = "https://issuer.test";
const TOKEN_ENDPOINT = `${ISSUER}/oauth/v2/token`;

const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });
const req = (url: string, cookie?: string) =>
  ({ nextUrl: new URL(url), headers: new Headers(cookie ? { cookie } : {}) }) as never;
const okResponse = () =>
  new Response("{}", { status: 200, headers: { "content-type": "application/json" } });

// Refresh tokens are unique per test: the route de-duplicates concurrent
// refreshes of the same refresh token in-process, and that cache must not
// leak between tests.
let seq = 0;
const nextRefreshToken = () => `refresh-${++seq}-${Math.random()}`;

const expired = (refresh_token?: string) => ({
  sub: "user-1",
  email: "a@b.c",
  access_token: "OLD-TOKEN",
  refresh_token,
  expires_at: 1_000, // 1970: long expired
});

/** Route the global fetch: token endpoint vs the upstream API. */
function stubFetch(tokenEndpoint: () => Promise<Response>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (String(input) === TOKEN_ENDPOINT) return tokenEndpoint();
    return okResponse();
  });
}

const upstreamCalls = (spy: ReturnType<typeof stubFetch>) =>
  spy.mock.calls.filter(([url]) => String(url) !== TOKEN_ENDPOINT);
const authHeader = (call: unknown[]) =>
  ((call[1] as RequestInit).headers as Record<string, string>).authorization;

describe("/api/mr proxy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authMock.mockReset();
    vi.stubEnv("AUTH_SECRET", "test-auth-secret");
    vi.stubEnv("AUTH_ZITADEL_ISSUER", ISSUER);
    vi.stubEnv("AUTH_ZITADEL_ID", "test-client");
    vi.stubEnv("AUTH_ZITADEL_SECRET", "test-secret");
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not send an authorization header when signed out", async () => {
    authMock.mockResolvedValue(null);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse());

    const res = await GET(req("http://localhost:3000/api/mr/editions"), ctx(["editions"]));

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("forwards the session access token as a bearer header when signed in", async () => {
    authMock.mockResolvedValue({ access_token: "tok-123", expires_at: 9_999_999_999 });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse());

    const res = await GET(req("http://localhost:3000/api/mr/editions"), ctx(["editions"]));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok-123");
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("still proxies anonymously if the session lookup throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    authMock.mockRejectedValue(new Error("cannot decrypt session cookie"));
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse());

    const res = await GET(req("http://localhost:3000/api/mr/editions"), ctx(["editions"]));

    expect(res.status).toBe(200);
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0])).toContain("cannot decrypt session cookie");
  });

  it("preserves the query string on the upstream URL", async () => {
    authMock.mockResolvedValue(null);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse());

    await GET(
      req("http://localhost:3000/api/mr/elogia?edition=x&locale=la"),
      ctx(["elogia"]),
    );

    expect(fetchSpy.mock.calls[0][0]).toContain("?edition=x&locale=la");
  });

  it.each([
    ["https://martyrology.example.org", true],
    ["http://localhost:3000", false],
  ])("selects the cookie name from AUTH_URL (%s -> secureCookie %s)", async (authUrl, expected) => {
    vi.stubEnv("AUTH_URL", authUrl);
    authMock.mockResolvedValue(null);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse());

    // The request URL is http either way, as behind a TLS-terminating proxy.
    await GET(req("http://localhost:3000/api/mr/editions"), ctx(["editions"]));

    expect(authMock).toHaveBeenCalledWith(expect.objectContaining({ secureCookie: expected }));
  });

  // Spec §5 test 3: expired access token → refresh path taken before the
  // upstream call, and the refreshed token is persisted.
  it("refreshes an expired access token before the upstream call and persists it", async () => {
    authMock.mockResolvedValue(expired(nextRefreshToken()));
    const fetchSpy = stubFetch(async () =>
      new Response(JSON.stringify({ access_token: "NEW-TOKEN", refresh_token: "r2", expires_in: 43_200 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const res = await GET(req("http://localhost:3000/api/mr/editions"), ctx(["editions"]));

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[0][0])).toBe(TOKEN_ENDPOINT);
    expect(authHeader(fetchSpy.mock.calls[1])).toBe("Bearer NEW-TOKEN");
    const cookies = res.headers.getSetCookie();
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatch(/^authjs\.session-token=[^;]+;/);
    expect(cookies[0]).toContain("HttpOnly");
    // The cookie is encrypted; neither token appears in clear.
    expect(cookies[0]).not.toContain("NEW-TOKEN");
    expect(cookies[0]).not.toContain("r2");
  });

  it("proxies anonymously and records the error when the issuer rejects the refresh (4xx)", async () => {
    authMock.mockResolvedValue(expired(nextRefreshToken()));
    const fetchSpy = stubFetch(async () => new Response('{"error":"invalid_grant"}', { status: 400 }));

    const res = await GET(req("http://localhost:3000/api/mr/editions"), ctx(["editions"]));

    const upstream = upstreamCalls(fetchSpy);
    expect(upstream).toHaveLength(1);
    expect(authHeader(upstream[0])).toBeUndefined();
    expect(res.status).toBe(200); // the upstream's status, not a 401 we caused
    const cookies = res.headers.getSetCookie();
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatch(/^authjs\.session-token=[^;]+;/);
  });

  it("proxies anonymously and persists nothing when the token endpoint is unreachable", async () => {
    authMock.mockResolvedValue(expired(nextRefreshToken()));
    const fetchSpy = stubFetch(async () => {
      throw new TypeError("fetch failed");
    });

    const res = await GET(req("http://localhost:3000/api/mr/editions"), ctx(["editions"]));

    const upstream = upstreamCalls(fetchSpy);
    expect(upstream).toHaveLength(1);
    expect(authHeader(upstream[0])).toBeUndefined();
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("proxies anonymously without refreshing when the token already carries an error", async () => {
    authMock.mockResolvedValue({ ...expired(nextRefreshToken()), error: "RefreshAccessTokenError" });
    const fetchSpy = stubFetch(async () => okResponse());

    const res = await GET(req("http://localhost:3000/api/mr/editions"), ctx(["editions"]));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).not.toBe(TOKEN_ENDPOINT);
    expect(authHeader(fetchSpy.mock.calls[0])).toBeUndefined();
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("proxies anonymously and records the error when an expired token has no refresh token", async () => {
    authMock.mockResolvedValue(expired(undefined));
    const fetchSpy = stubFetch(async () => okResponse());

    const res = await GET(req("http://localhost:3000/api/mr/editions"), ctx(["editions"]));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(authHeader(fetchSpy.mock.calls[0])).toBeUndefined();
    expect(res.headers.getSetCookie()).toHaveLength(1);
  });

  it("persists a refreshed token even when the upstream is unreachable", async () => {
    authMock.mockResolvedValue(expired(nextRefreshToken()));
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input) === TOKEN_ENDPOINT) {
        return new Response(JSON.stringify({ access_token: "NEW-TOKEN", expires_in: 43_200 }), { status: 200 });
      }
      throw new TypeError("fetch failed");
    });

    const res = await GET(req("http://localhost:3000/api/mr/editions"), ctx(["editions"]));

    expect(res.status).toBe(502);
    expect(res.headers.getSetCookie()).toHaveLength(1);
  });
});
