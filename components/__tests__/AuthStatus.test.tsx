import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/auth", () => ({ auth: authMock, signIn: vi.fn(), signOut: vi.fn() }));

import { AuthStatus } from "@/components/AuthStatus";

describe("AuthStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    authMock.mockReset();
  });

  it("renders signed out and logs only the error when the session read fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    authMock.mockRejectedValue(new Error("JWTSessionError: decryption failed"));

    render(await AuthStatus());

    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0])).toContain("decryption failed");
  });
});
