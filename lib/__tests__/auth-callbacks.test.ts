import { describe, it, expect, vi } from "vitest";

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
});
