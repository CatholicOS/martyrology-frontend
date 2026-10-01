import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the JWT reader, not the session. The route deliberately never calls
// auth() — see the comment in route.ts.
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: authMock }));

import { GET } from "@/app/api/mr/[...path]/route";

const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });
const req = (url: string) => ({ nextUrl: new URL(url) }) as never;
const okResponse = () =>
  new Response("{}", { status: 200, headers: { "content-type": "application/json" } });

describe("/api/mr proxy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not send an authorization header when signed out", async () => {
    authMock.mockResolvedValue(null);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse());

    await GET(req("http://localhost:3000/api/mr/editions"), ctx(["editions"]));

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it("forwards the session access token as a bearer header when signed in", async () => {
    authMock.mockResolvedValue({ access_token: "tok-123" });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse());

    await GET(req("http://localhost:3000/api/mr/editions"), ctx(["editions"]));

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok-123");
  });

  it("still proxies anonymously if the session lookup throws", async () => {
    authMock.mockRejectedValue(new Error("cannot decrypt session cookie"));
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse());

    const res = await GET(req("http://localhost:3000/api/mr/editions"), ctx(["editions"]));

    expect(res.status).toBe(200);
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
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
});
