import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const { push, signInMock } = vi.hoisted(() => ({ push: vi.fn(), signInMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next-auth/react", () => ({ signIn: signInMock }));
vi.mock("@/lib/api", () => ({
  getEditions: vi.fn(),
  getAccess: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

import Bookshelf from "@/components/Bookshelf";
import { getEditions, getAccess } from "@/lib/api";
import type { EditionOut } from "@/lib/types";

function ed(edition_id: string, year: number, locale: string, nature: string, status: string): EditionOut {
  return { edition_id, year, locale, nature, book: "martyrologium", scope: {}, promulgation: {},
    governance: { governing_body: "", type: "" }, availability: { status, note: status === "restricted-texts" ? "See https://example/licensing" : null } };
}
const EDITIONS = [
  ed("martyrologium_romanum_1749", 1749, "la", "editio_typica_recognita", "public"),
  ed("martyrologium_romanum_2004", 2004, "la", "editio_typica_altera", "restricted-texts"),
  ed("martyrologium_romanum_2001", 2001, "la", "editio_typica", "unavailable"),
];

beforeEach(() => {
  push.mockReset();
  signInMock.mockReset();
  vi.mocked(getEditions).mockResolvedValue(EDITIONS);
  vi.mocked(getAccess).mockResolvedValue({
    martyrologium_romanum_1749: { can_read_texts: true },
    martyrologium_romanum_2004: { can_read_texts: false },
    martyrologium_romanum_2001: { can_read_texts: true },
  });
  window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never; // reduced motion: open immediately
});

describe("Bookshelf", () => {
  it("shows the editions newest first", async () => {
    render(<Bookshelf signedIn={false} />);
    await screen.findByRole("button", { name: "Martyrologium Romanum 1749, Latin" });
    const names = screen
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label"))
      .filter((n) => !n?.startsWith("About this edition"));
    expect(names).toEqual(["Martyrologium Romanum 2004, Latin (locked)", "Martyrologium Romanum 1749, Latin"]);
    expect(screen.getByLabelText(/2001, Latin \(not yet available\)/)).toBeInTheDocument();
  });

  it("opens an open book in the reader", async () => {
    render(<Bookshelf signedIn={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Martyrologium Romanum 1749, Latin" }));
    expect(push).toHaveBeenCalledWith("/read/martyrologium_romanum_1749");
  });

  it("asks a signed-out visitor to sign in for a locked book", async () => {
    render(<Bookshelf signedIn={false} />);
    fireEvent.click(await screen.findByRole("button", { name: /2004, Latin \(locked\)/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Sign in to open this edition");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(signInMock).toHaveBeenCalledWith("zitadel");
    expect(push).not.toHaveBeenCalled();
  });

  it("tells a signed-in reader without rights that they have no access", async () => {
    render(<Bookshelf signedIn />);
    fireEvent.click(await screen.findByRole("button", { name: /2004, Latin \(locked\)/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Your account doesn't have access to this edition");
    expect(screen.getByRole("status")).toHaveTextContent("See https://example/licensing");
    expect(screen.getByRole("link", { name: "https://example/licensing" })).toHaveAttribute("href", "https://example/licensing");
  });

  it("still shows every available book as open when access cannot be loaded", async () => {
    vi.mocked(getAccess).mockRejectedValue(new Error("down"));
    render(<Bookshelf signedIn={false} />);
    expect(await screen.findByRole("button", { name: "Martyrologium Romanum 2004, Latin" })).toBeInTheDocument();
  });

  it("offers a retry when the editions cannot be loaded", async () => {
    vi.mocked(getEditions).mockRejectedValueOnce(new Error("down"));
    render(<Bookshelf signedIn={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: "Martyrologium Romanum 1749, Latin" })).toBeInTheDocument();
  });

  describe("book-opening swing", () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
    });
    afterEach(() => vi.useRealTimers());

    it("pushes once after the swing, ignoring a second click meanwhile", async () => {
      render(<Bookshelf signedIn={false} />);
      const book = await screen.findByRole("button", { name: "Martyrologium Romanum 1749, Latin" });
      fireEvent.click(book);
      fireEvent.click(book);
      expect(push).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(450); });
      expect(push).toHaveBeenCalledTimes(1);
    });

    it("does not push if unmounted mid-swing", async () => {
      const { unmount } = render(<Bookshelf signedIn={false} />);
      fireEvent.click(await screen.findByRole("button", { name: "Martyrologium Romanum 1749, Latin" }));
      unmount();
      act(() => { vi.advanceTimersByTime(1000); });
      expect(push).not.toHaveBeenCalled();
    });
  });
});
