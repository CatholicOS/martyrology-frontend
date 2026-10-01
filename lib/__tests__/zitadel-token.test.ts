import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isExpired,
  refreshAccessToken,
  REFRESH_REJECTED,
  REFRESH_TRANSIENT,
} from "@/lib/zitadel-token";

describe("isExpired", () => {
  it("treats a missing expiry as expired", () => {
    expect(isExpired(undefined, 1_000_000)).toBe(true);
  });

  it("is false while the token still has more than the 60s skew left", () => {
    // expires_at is in SECONDS; now is in MILLISECONDS.
    expect(isExpired(2_000, 1_000_000)).toBe(false);
  });

  it("is true inside the 60s skew window, before the wall-clock expiry", () => {
    // 30s of real life left, which is inside the skew, so refresh early.
    expect(isExpired(1_030, 1_000_000)).toBe(true);
  });
});

describe("refreshAccessToken", () => {
  const base = { access_token: "old", refresh_token: "r1", expires_at: 1_000 };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("posts the refresh grant with client credentials and returns new values", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "new", refresh_token: "r2", expires_in: 3600 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await refreshAccessToken(base, fetchImpl as never);

    expect(result.access_token).toBe("new");
    expect(result.refresh_token).toBe("r2");
    expect(result.error).toBeUndefined();

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain("/oauth/v2/token");
    const body = (init as RequestInit).body as URLSearchParams;
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("r1");
  });

  it("keeps the previous refresh token when the response omits a new one", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "new", expires_in: 3600 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await refreshAccessToken(base, fetchImpl as never);

    expect(result.refresh_token).toBe("r1");
  });

  it("flags RefreshAccessTokenError on an invalid_grant response rather than throwing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"error":"invalid_grant"}', { status: 400 }));

    const result = await refreshAccessToken(base, fetchImpl as never);

    expect(result.error).toBe("RefreshAccessTokenError");
    expect(result.error).toBe(REFRESH_REJECTED);
  });

  it.each([
    ["a 5xx response", () => Promise.resolve(new Response("{}", { status: 503 }))],
    ["an invalid_client 401", () => Promise.resolve(new Response('{"error":"invalid_client"}', { status: 401 }))],
    ["a 429 rate limit", () => Promise.resolve(new Response('{"error":"slow_down"}', { status: 429 }))],
    ["a 4xx with no error code", () => Promise.resolve(new Response("{}", { status: 400 }))],
    ["a 4xx with a non-JSON body", () => Promise.resolve(new Response("<html>", { status: 400 }))],
    ["a network failure", () => Promise.reject(new TypeError("fetch failed"))],
    ["a timeout", () => Promise.reject(new DOMException("timed out", "TimeoutError"))],
    ["a 2xx body without an access token", () => Promise.resolve(new Response("{}", { status: 200 }))],
    ["a non-JSON 2xx body", () => Promise.resolve(new Response("<html>", { status: 200 }))],
  ])("flags a transient error, not a rejection, on %s", async (_label, respond) => {
    const fetchImpl = vi.fn().mockImplementation(respond);

    const result = await refreshAccessToken(base, fetchImpl as never);

    expect(result.error).toBe(REFRESH_TRANSIENT);
  });

  it("bounds the token-endpoint call with an abort signal", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 400 }));

    await refreshAccessToken(base, fetchImpl as never);

    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("does not double the slash when the issuer ends with one", async () => {
    vi.stubEnv("AUTH_ZITADEL_ISSUER", "https://issuer.test/");
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 400 }));

    await refreshAccessToken(base, fetchImpl as never);

    expect(fetchImpl.mock.calls[0][0]).toBe("https://issuer.test/oauth/v2/token");
  });

  it("flags RefreshAccessTokenError when there is no refresh token to use", async () => {
    const fetchImpl = vi.fn();

    const result = await refreshAccessToken({ access_token: "old" }, fetchImpl as never);

    expect(result.error).toBe("RefreshAccessTokenError");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
