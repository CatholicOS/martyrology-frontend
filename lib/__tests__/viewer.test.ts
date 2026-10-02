import { describe, it, expect, vi, beforeEach } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => undefined }));

import { getViewer } from "@/lib/viewer";

describe("getViewer", () => {
  beforeEach(() => {
    // Braces matter: vitest runs a function returned from beforeEach as teardown,
    // and mockReset() returns the mock itself, which would then be called after each test.
    authMock.mockReset();
  });

  it("is signed out with no session", async () => {
    authMock.mockResolvedValue(null);
    expect(await getViewer()).toEqual({ signedIn: false, curator: false });
  });

  it("reports a signed-in curator", async () => {
    authMock.mockResolvedValue({ user: { email: "a@b.c" }, curator: true });
    expect(await getViewer()).toEqual({ signedIn: true, curator: true });
  });

  it("falls back to signed out when the session cannot be read", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    authMock.mockRejectedValue(new Error("bad cookie"));
    expect(await getViewer()).toEqual({ signedIn: false, curator: false });
    expect(warn).toHaveBeenCalled();
  });
});
