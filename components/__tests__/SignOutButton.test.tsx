import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

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
});
