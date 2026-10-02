import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { signInMock } = vi.hoisted(() => ({ signInMock: vi.fn() }));
vi.mock("next-auth/react", () => ({ signIn: signInMock }));
vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    constructor(public status: number, public title: string) { super(title); }
  }
  return { getDay: vi.fn(), getElogium: vi.fn(), ApiError };
});

import Spread from "@/components/Spread";
import { getDay, getElogium } from "@/lib/api";
import { __resetPlacements } from "@/lib/use-placements";
import type { DayOut, EditionOut, ElogiumOut } from "@/lib/types";

const A = "martyrologium_romanum_2004";
const B = "martyrologium_romanum_1749";
const ed = (edition_id: string, year: number, locale: string, aligned: boolean | null = true): EditionOut => ({
  edition_id, year, locale, nature: "editio_typica", book: "martyrologium", scope: {}, promulgation: {},
  governance: { governing_body: "", type: "" }, availability: { status: "public" }, aligned,
});
const EDITIONS = [ed(A, 2004, "la"), ed(B, 1749, "la")];
const el = (id: string, entry: number, text: string): ElogiumOut => ({ id, entry, asterisk: false, unnumbered: false, anchor_day: "10-04", text });
const day = (edition: string, elogia: ElogiumOut[], access = "public"): DayOut => ({
  titulus: null, elogia, conclusio: "Et alibi. R. Deo gratias.",
  metadata: { edition, month: 10, day: 4, access },
});

function serve(days: Record<string, DayOut>) {
  vi.mocked(getDay).mockImplementation(async (edition: string) => days[edition]);
}
const cellOf = (text: string) => screen.getByText(text).closest("[data-row]")!;

beforeEach(() => {
  __resetPlacements();
  vi.mocked(getDay).mockReset();
  vi.mocked(getElogium).mockReset();
});

describe("Spread", () => {
  it("sets a eulogy level with its counterpart, on its own sheet", async () => {
    serve({ [A]: day(A, [el("mr:x", 1, "Romae sancti X.")]), [B]: day(B, [el("mr:x", 4, "Romae passio sancti X.")]) });
    render(<Spread a={A} b={B} editions={EDITIONS} mm={10} dd={4} signedIn={false} />);
    await screen.findByText("Romae sancti X.");
    const left = cellOf("Romae sancti X.");
    const right = cellOf("Romae passio sancti X.");
    expect(left.getAttribute("data-row")).toBe(right.getAttribute("data-row"));
    expect(left.getAttribute("data-side")).toBe("a");
    expect(right.getAttribute("data-side")).toBe("b");
    expect(screen.getByText("Martyrologium Romanum 2004 · Latin")).toBeInTheDocument();
    expect(screen.getByText("Martyrologium Romanum 1749 · Latin")).toBeInTheDocument();
  });

  it("notes a eulogy the other edition prints on another day, linking there in the same pairing", async () => {
    serve({ [A]: day(A, [el("mr:x", 1, "Sancti X."), el("mr:w", 2, "Sancti W.")]), [B]: day(B, [el("mr:x", 4, "Sancti X antiqui.")]) });
    let resolve!: (v: unknown) => void;
    vi.mocked(getElogium).mockReturnValue(new Promise((r) => { resolve = r; }) as never);
    render(<Spread a={A} b={B} editions={EDITIONS} mm={10} dd={4} signedIn={false} />);
    expect((await screen.findByText(/not on this day in/)).closest("p")).toHaveTextContent("[not on this day in 1749]");
    resolve({ id: "mr:w", subject: {}, anchor_day: "10-05", deprecated: false,
      editions: { [B]: { day_printed: "10-05", entry: 3, asterisk: false, unnumbered: false, text: null } } });
    const link = await screen.findByRole("link", { name: /5 October, n\. 3/ });
    expect(link).toHaveAttribute("href", `/read/${A}/10/05?with=${B}`);
    expect(link.closest("[data-row]")!.getAttribute("data-row")).toBe(cellOf("Sancti W.").getAttribute("data-row"));
  });

  it("notes a eulogy the other edition does not print", async () => {
    serve({ [A]: day(A, [el("mr:w", 2, "Sancti W.")]), [B]: day(B, []) });
    vi.mocked(getElogium).mockResolvedValue({ id: "mr:w", subject: {}, anchor_day: "10-04", deprecated: false, editions: {} });
    render(<Spread a={A} b={B} editions={EDITIONS} mm={10} dd={4} signedIn={false} />);
    expect((await screen.findByText(/not in/)).closest("p")).toHaveTextContent("[not in 1749]");
  });

  it("names editions of the same year by year and language", async () => {
    const IT = "martyrologium_romanum_2004_it_IT";
    serve({ [A]: day(A, [el("mr:w", 2, "Sancti W.")]), [IT]: day(IT, []) });
    vi.mocked(getElogium).mockResolvedValue({ id: "mr:w", subject: {}, anchor_day: "10-04", deprecated: false, editions: {} });
    render(<Spread a={A} b={IT} editions={[...EDITIONS, ed(IT, 2004, "it-IT")]} mm={10} dd={4} signedIn={false} />);
    expect((await screen.findByText(/not in/)).closest("p")).toHaveTextContent("[not in 2004 Italian]");
  });

  it("falls back to two independent pages for an unaligned edition, saying why", async () => {
    const EN = "martyrologium_romanum_1914_en_unofficial";
    serve({ [A]: day(A, [el("mr:x", 1, "Sancti X.")]), [EN]: day(EN, [{ ...el("mr:x", 1, "Of Saint X."), id: null }]) });
    render(<Spread a={A} b={EN} editions={[...EDITIONS, ed(EN, 1914, "en", false)]} mm={10} dd={4} signedIn={false} />);
    expect(await screen.findByText("Of Saint X.")).toBeInTheDocument();
    expect(screen.getByText("The 1914 English edition is not yet aligned, so its eulogies are not matched.")).toBeInTheDocument();
    expect(screen.getByText("Sancti X.").closest("[data-row]")).toBeNull();
  });

  it("shows the locked notice on a locked side, and the other side reads", async () => {
    serve({ [A]: day(A, [el("mr:x", 1, "Sancti X.")]), [B]: day(B, [{ ...el("mr:x", 4, ""), text: null }], "restricted-texts") });
    render(<Spread a={A} b={B} editions={EDITIONS} mm={10} dd={4} signedIn={false} />);
    expect(await screen.findByText("Sancti X.")).toBeInTheDocument();
    expect(screen.getByText(/is a copyrighted edition/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(signInMock).toHaveBeenCalledWith("zitadel");
  });
});
