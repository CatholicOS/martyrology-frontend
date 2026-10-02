import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { push, signInMock } = vi.hoisted(() => ({ push: vi.fn(), signInMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next-auth/react", () => ({ signIn: signInMock }));
vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    constructor(public status: number, public title: string) { super(title); }
  }
  return { getDay: vi.fn(), getEditions: vi.fn(), getAccess: vi.fn(), ApiError };
});

import Reader from "@/components/Reader";
import { getDay, getEditions, getAccess, ApiError } from "@/lib/api";
import type { EditionOut } from "@/lib/types";

function ed(edition_id: string, year: number, locale: string, nature: string, status: string): EditionOut {
  return { edition_id, year, locale, nature, book: "martyrologium", scope: {}, promulgation: {},
    governance: { governing_body: "", type: "" }, availability: { status } };
}
const DAY = {
  titulus: "2 Octobris Sexto Nonas Octobris. xxj. B",
  elogia: [{ id: "mr:1002-modestus-sardus", entry: 2, asterisk: false, unnumbered: false, anchor_day: "10-02", text: "Romae passio sancti Modesti Sardi." }],
  conclusio: null,
  metadata: { edition: "martyrologium_romanum_1749", month: 10, day: 2, access: "public" },
};

beforeEach(() => {
  push.mockReset();
  vi.mocked(getDay).mockResolvedValue(DAY);
  vi.mocked(getEditions).mockResolvedValue([
    ed("martyrologium_romanum_1749", 1749, "la", "editio_typica_recognita", "public"),
    ed("martyrologium_romanum_1914_en_unofficial", 1914, "en", "translatio", "public"),
    ed("martyrologium_romanum_2004", 2004, "la", "editio_typica_altera", "restricted-texts"),
  ]);
  vi.mocked(getAccess).mockResolvedValue({
    martyrologium_romanum_1749: { can_read_texts: true },
    martyrologium_romanum_1914_en_unofficial: { can_read_texts: true },
    martyrologium_romanum_2004: { can_read_texts: false },
  });
});

const render1749 = (mm = 10, dd = 2, signedIn = false) =>
  render(<Reader edition="martyrologium_romanum_1749" mm={mm} dd={dd} signedIn={signedIn} />);

describe("Reader", () => {
  it("shows the day's page", async () => {
    render1749();
    expect(await screen.findByText("Romae passio sancti Modesti Sardi.")).toBeInTheDocument();
    expect(getDay).toHaveBeenCalledWith("martyrologium_romanum_1749", "10", "02");
  });

  it("turns to the next and previous day, wrapping the year", async () => {
    render1749(12, 31);
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    expect(push).toHaveBeenCalledWith("/read/martyrologium_romanum_1749/01/01");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(push).toHaveBeenCalledWith("/read/martyrologium_romanum_1749/12/30");
  });

  it("leaves the arrow keys to a focused picker", async () => {
    render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    const month = screen.getByLabelText("Month");
    month.focus();
    fireEvent.keyDown(month, { key: "ArrowRight" });
    expect(push).not.toHaveBeenCalled();
  });

  it("jumps with the pickers, and Switch book keeps the date and lists only openable books", async () => {
    render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "15" } });
    expect(push).toHaveBeenCalledWith("/read/martyrologium_romanum_1749/10/15");
    const switcher = screen.getByLabelText("Switch book");
    expect([...switcher.querySelectorAll("option")].map((o) => o.value)).toEqual([
      "martyrologium_romanum_1914_en_unofficial", "martyrologium_romanum_1749",
    ]);
    fireEvent.change(switcher, { target: { value: "martyrologium_romanum_1914_en_unofficial" } });
    expect(push).toHaveBeenCalledWith("/read/martyrologium_romanum_1914_en_unofficial/10/02");
  });

  it("shows the locked notice, not blank eulogies, for a redacted edition", async () => {
    vi.mocked(getDay).mockResolvedValue({ ...DAY, elogia: [{ ...DAY.elogia[0], text: null }],
      metadata: { ...DAY.metadata, access: "restricted-texts", access_info: "https://example/licensing" } });
    render(<Reader edition="martyrologium_romanum_2004" mm={10} dd={2} signedIn={false} />);
    expect(await screen.findByRole("status")).toHaveTextContent("Sign in to open this edition");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("says when the edition has no text for the day, and keeps the controls", async () => {
    vi.mocked(getDay).mockRejectedValue(new ApiError(404, "No entries for this day"));
    render(<Reader edition="martyrologium_romanum_1914_en_unofficial" mm={10} dd={2} signedIn={false} />);
    expect(await screen.findByText("This edition has no text for 2 October.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    expect(push).toHaveBeenCalledWith("/read/martyrologium_romanum_1914_en_unofficial/10/03");
  });

  it("offers a retry when the API is unreachable", async () => {
    vi.mocked(getDay).mockRejectedValueOnce(new ApiError(502, "API unreachable"));
    render1749();
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Romae passio sancti Modesti Sardi.")).toBeInTheDocument();
  });
});
