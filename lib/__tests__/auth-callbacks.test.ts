import { describe, it, expect, vi, afterEach } from "vitest";

// auth.ts reads these at module load; dummy values suffice for unit tests.
vi.stubEnv("AUTH_ZITADEL_ISSUER", "https://issuer.test");
vi.stubEnv("AUTH_ZITADEL_ID", "test-client");
vi.stubEnv("AUTH_ZITADEL_SECRET", "test-secret");
vi.stubEnv("AUTH_SECRET", "test-auth-secret");

const { callbacks } = await import("@/auth");

const token = {
  access_token: "SECRET-TOKEN",
  refresh_token: "SECRET-REFRESH",
  expires_at: 9_999_999_999,
  error: undefined,
};

describe("session callback", () => {
  it("never exposes the access or refresh token on the session", async () => {
    const session = await callbacks.session({
      session: { user: { email: "a@b.c" }, expires: "2099-01-01" },
      token,
    } as never);

    // Auth.js returns this object as the body of GET /api/auth/session.
    const serialized = JSON.stringify(session);
    expect(serialized).not.toContain("SECRET-TOKEN");
    expect(serialized).not.toContain("SECRET-REFRESH");
    expect(serialized).not.toContain("access_token");
    expect(serialized).not.toContain("accessToken");
  });

  it("does pass the refresh error through, which is not sensitive", async () => {
    const session = await callbacks.session({
      session: { user: { email: "a@b.c" }, expires: "2099-01-01" },
      token: { ...token, error: "RefreshAccessTokenError" },
    } as never);

    expect((session as { error?: string }).error).toBe("RefreshAccessTokenError");
  });

  it("exposes curator as a boolean, and never the roles claim", async () => {
    const session = await callbacks.session({
      session: { user: { email: "a@b.c" }, expires: "2099-01-01" },
      token: { ...token, curator: true },
    } as never);
    expect((session as { curator?: unknown }).curator).toBe(true);
    expect(JSON.stringify(session)).not.toContain("urn:zitadel");
  });
});

describe("jwt callback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps the provider tokens onto the JWT at sign-in", async () => {
    const result = await callbacks.jwt({
      token: { sub: "user-1", email: "a@b.c" },
      account: {
        provider: "zitadel",
        type: "oidc",
        providerAccountId: "user-1",
        access_token: "AT",
        refresh_token: "RT",
        expires_at: 1_700_000_000,
      },
    } as never);

    expect(result).toEqual({
      sub: "user-1",
      email: "a@b.c",
      access_token: "AT",
      refresh_token: "RT",
      expires_at: 1_700_000_000,
      curator: false,
    });
  });

  it("marks a curator from the ID token's project roles at sign-in", async () => {
    const result = await callbacks.jwt({
      token: { sub: "user-1" },
      account: { provider: "zitadel", type: "oidc", providerAccountId: "user-1", access_token: "AT" },
      profile: { "urn:zitadel:iam:org:project:roles": { martyrology_editor: { "1": "x" } } },
    } as never);
    expect(result).toMatchObject({ curator: true });
  });

  it("does not mark a curator when the roles claim is missing or malformed", async () => {
    for (const profile of [{}, { "urn:zitadel:iam:org:project:roles": "admin" }, undefined]) {
      const result = await callbacks.jwt({
        token: { sub: "user-1" },
        account: { provider: "zitadel", type: "oidc", providerAccountId: "user-1", access_token: "AT" },
        profile,
      } as never);
      expect(result).toMatchObject({ curator: false });
    }
  });

  it("returns the token unchanged on later calls, without refreshing even when expired", async () => {
    // Refresh lives in the /api/mr route, which can persist the result. Here
    // (auth() in a Server Component) a refresh would be thrown away.
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const expiredToken = { ...token, expires_at: 1_000 };

    const result = await callbacks.jwt({ token: expiredToken } as never);

    expect(result).toBe(expiredToken);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
