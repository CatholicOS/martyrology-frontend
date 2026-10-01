import { describe, it, expect, vi, afterEach } from "vitest";
import { getToken } from "next-auth/jwt";
import {
  MAX_COOKIE_VALUE_LENGTH,
  SESSION_MAX_AGE,
  resolveAccessToken,
  sessionCookieHeaders,
  sessionCookieName,
} from "@/lib/session-token";
import { REFRESH_REJECTED, REFRESH_TRANSIENT } from "@/lib/zitadel-token";

const SECRET = "test-auth-secret";
const NOW_MS = 2_000_000_000_000; // 2033, in milliseconds
const NOW_S = NOW_MS / 1000;

let seq = 0;
const freshRefreshToken = () => `rt-${++seq}-${Math.random()}`;

const valid = () => ({
  sub: "u1",
  email: "a@b.c",
  access_token: "AT",
  refresh_token: freshRefreshToken(),
  expires_at: NOW_S + 3_600,
});
const expired = () => ({ ...valid(), expires_at: NOW_S - 10 });

describe("sessionCookieName", () => {
  it("matches Auth.js's defaultCookies names", () => {
    expect(sessionCookieName(true)).toBe("__Secure-authjs.session-token");
    expect(sessionCookieName(false)).toBe("authjs.session-token");
  });
});

describe("resolveAccessToken", () => {
  it("is anonymous with no token or no access token", async () => {
    const refresh = vi.fn();
    expect(await resolveAccessToken(null, { refresh })).toEqual({});
    expect(await resolveAccessToken({ sub: "u1" }, { refresh })).toEqual({});
    expect(refresh).not.toHaveBeenCalled();
  });

  it("is anonymous, without refreshing, when the token carries an error", async () => {
    const refresh = vi.fn();
    const result = await resolveAccessToken({ ...expired(), error: REFRESH_REJECTED }, { nowMs: NOW_MS, refresh });
    expect(result).toEqual({});
    expect(refresh).not.toHaveBeenCalled();
  });

  it("forwards an unexpired access token as is and persists nothing", async () => {
    const refresh = vi.fn();
    const result = await resolveAccessToken(valid(), { nowMs: NOW_MS, refresh });
    expect(result).toEqual({ accessToken: "AT" });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes an expired token and persists the merged result with the error cleared", async () => {
    const token = { ...expired(), name: "Curator", iat: 1, error: undefined };
    const refresh = vi.fn().mockResolvedValue({
      access_token: "AT2",
      refresh_token: "RT2",
      expires_at: NOW_S + 43_200,
      error: undefined,
    });

    const result = await resolveAccessToken(token, { nowMs: NOW_MS, refresh });

    expect(result.accessToken).toBe("AT2");
    expect(result.persist).toEqual({
      sub: "u1",
      email: "a@b.c",
      name: "Curator",
      iat: 1,
      access_token: "AT2",
      refresh_token: "RT2",
      expires_at: NOW_S + 43_200,
    });
    expect(result.persist).not.toHaveProperty("error");
  });

  it("persists an error state without the access token when the issuer rejects the refresh", async () => {
    const refresh = vi.fn().mockResolvedValue({ error: REFRESH_REJECTED });

    const result = await resolveAccessToken(expired(), { nowMs: NOW_MS, refresh });

    expect(result.accessToken).toBeUndefined();
    expect(result.persist?.error).toBe(REFRESH_REJECTED);
    expect(result.persist).not.toHaveProperty("access_token");
    expect(result.persist?.email).toBe("a@b.c");
  });

  it("persists nothing on a transient refresh failure, and retries on the next request", async () => {
    const token = expired();
    const refresh = vi.fn().mockResolvedValue({ error: REFRESH_TRANSIENT });

    expect(await resolveAccessToken(token, { nowMs: NOW_MS, refresh })).toEqual({});
    expect(await resolveAccessToken(token, { nowMs: NOW_MS, refresh })).toEqual({});
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("treats a refresh that throws as transient", async () => {
    const refresh = vi.fn().mockRejectedValue(new Error("boom"));
    expect(await resolveAccessToken(expired(), { nowMs: NOW_MS, refresh })).toEqual({});
  });

  it("persists an error state when an expired token has no refresh token", async () => {
    const refresh = vi.fn();
    const { refresh_token: _rt, ...noRefresh } = expired();
    void _rt;

    const result = await resolveAccessToken(noRefresh, { nowMs: NOW_MS, refresh });

    expect(result.accessToken).toBeUndefined();
    expect(result.persist?.error).toBe(REFRESH_REJECTED);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shares one refresh between concurrent requests carrying the same refresh token", async () => {
    // Zitadel rotates refresh tokens; a second use of the same one is refused.
    const token = expired();
    let release!: () => void;
    const refresh = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({ access_token: "AT2", refresh_token: "RT2", expires_at: NOW_S + 43_200 });
        }),
    );

    const a = resolveAccessToken(token, { nowMs: NOW_MS, refresh });
    const b = resolveAccessToken({ ...token }, { nowMs: NOW_MS, refresh });
    release();
    const [ra, rb] = await Promise.all([a, b]);
    // A straggler sent with the old cookie just after also reuses the outcome.
    const rc = await resolveAccessToken({ ...token }, { nowMs: NOW_MS, refresh });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect([ra.accessToken, rb.accessToken, rc.accessToken]).toEqual(["AT2", "AT2", "AT2"]);
    expect(rb.persist?.refresh_token).toBe("RT2");
  });
});

describe("sessionCookieHeaders", () => {
  it.each([true, false])("writes a cookie getToken reads back (secure %s)", async (secure) => {
    const token = { sub: "u1", email: "a@b.c", access_token: "AT2", refresh_token: "RT2", expires_at: 123 };

    const [setCookie, ...rest] = await sessionCookieHeaders(token, { secret: SECRET, secure });
    expect(rest).toEqual([]);

    const pair = setCookie.split(";")[0];
    const decoded = await getToken({
      req: new Request("http://localhost:3000/api/mr/editions", { headers: { cookie: pair } }),
      secret: SECRET,
      secureCookie: secure,
    });
    expect(decoded).toMatchObject(token);
  });

  it("uses Auth.js's default cookie attributes and 30-day lifetime", async () => {
    const [secureCookie] = await sessionCookieHeaders({ sub: "u1" }, { secret: SECRET, secure: true, nowMs: NOW_MS });
    const attrs = secureCookie.split("; ").slice(1);

    expect(secureCookie.startsWith("__Secure-authjs.session-token=")).toBe(true);
    expect(attrs).toEqual(
      expect.arrayContaining([
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        "Secure",
        `Max-Age=${SESSION_MAX_AGE}`,
        `Expires=${new Date(NOW_MS + SESSION_MAX_AGE * 1000).toUTCString()}`,
      ]),
    );
    expect(SESSION_MAX_AGE).toBe(30 * 24 * 60 * 60);

    const [plain] = await sessionCookieHeaders({ sub: "u1" }, { secret: SECRET, secure: false });
    expect(plain.startsWith("authjs.session-token=")).toBe(true);
    expect(plain.split("; ")).not.toContain("Secure");
  });

  it("expires chunk cookies present on the request, and nothing else", async () => {
    const headers = await sessionCookieHeaders(
      { sub: "u1" },
      {
        secret: SECRET,
        secure: false,
        requestCookieHeader:
          "authjs.session-token.0=aaa; authjs.session-token.1=bbb; authjs.csrf-token=x; other=y",
      },
    );

    expect(headers).toHaveLength(3);
    expect(headers[1]).toMatch(/^authjs\.session-token\.0=; .*Max-Age=0/);
    expect(headers[2]).toMatch(/^authjs\.session-token\.1=; .*Max-Age=0/);
  });

  it("persists nothing, and logs no token, when the encoded session is too large", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const huge = "x".repeat(MAX_COOKIE_VALUE_LENGTH);

    const headers = await sessionCookieHeaders(
      { sub: "u1", access_token: huge },
      { secret: SECRET, secure: false },
    );

    expect(headers).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0])).not.toContain("xxxx");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
