import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@/test/intl";

const { authMock, signInMock } = vi.hoisted(() => ({ authMock: vi.fn(), signInMock: vi.fn() }));
vi.mock("@/auth", () => ({ auth: authMock, signIn: signInMock, signOut: vi.fn() }));

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

  it("sign-in form carries a redirectTo field with the current path", async () => {
    window.history.pushState({}, "", "/en/docs?q=1");
    authMock.mockResolvedValue(null);
    const { container } = render(await AuthStatus());
    const input = container.querySelector("input[name=redirectTo]") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe("/en/docs?q=1");
  });

  it("the sign-in action signs in to the validated redirectTo, else the locale home", async () => {
    authMock.mockResolvedValue(null);
    const el = await AuthStatus();
    render(el);
    // Find the server action on the element tree.
    const find = (n: unknown): ((fd: FormData) => Promise<void>) | undefined => {
      if (!n || typeof n !== "object") return undefined;
      const props = (n as { props?: Record<string, unknown> }).props ?? {};
      if (n && (props as { action?: unknown }).action && typeof props.action === "function") return props.action as never;
      for (const c of [props.onSignIn, props.children].flat()) { const r = find(c); if (r) return r; }
      return undefined;
    };
    const action = find(el)!;
    const fd = new FormData();
    fd.set("redirectTo", "/it/docs?x=1");
    await action(fd);
    expect(signInMock).toHaveBeenLastCalledWith("zitadel", { redirectTo: "/it/docs?x=1" });
    const bad = new FormData();
    bad.set("redirectTo", "https://evil.example/");
    await action(bad);
    expect(signInMock).toHaveBeenLastCalledWith("zitadel", { redirectTo: "/en" });
  });
});
