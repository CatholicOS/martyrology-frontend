import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@/test/intl";

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn() }));
vi.mock("next-auth/react", () => ({ signOut: signOutMock }));

import { SignOutButton } from "@/components/SignOutButton";

describe("SignOutButton", () => {
  const reload = vi.fn();
  const original = window.location;
  beforeEach(() => {
    signOutMock.mockReset();
    reload.mockReset();
    Object.defineProperty(window, "location", { configurable: true, value: { ...original, reload } });
  });
  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: original });
  });

  it("signs out, then reloads the page so no signed-in content stays on screen", async () => {
    const order: string[] = [];
    signOutMock.mockImplementation(async () => {
      order.push("signOut");
    });
    reload.mockImplementation(() => order.push("reload"));
    render(<SignOutButton className="c" />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(signOutMock).toHaveBeenCalledWith({ redirect: false });
    expect(order).toEqual(["signOut", "reload"]);
  });

  it("does not reload, and says so, when signing out fails", async () => {
    signOutMock.mockRejectedValue(new Error("network down"));
    render(<SignOutButton className="c" />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/sign-out failed/i);
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not reload when Auth.js answers with its error page", async () => {
    signOutMock.mockResolvedValue({ url: "http://localhost:3000/api/auth/error?error=MissingCSRF" });
    render(<SignOutButton className="c" />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });
});
