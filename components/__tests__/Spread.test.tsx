import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor, act } from "@testing-library/react";

const { signInMock } = vi.hoisted(() => ({ signInMock: vi.fn() }));
vi.mock("next-auth/react", () => ({ signIn: signInMock }));
vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    constructor(public status: number, public title: string) { super(title); }
  }
  return { getDay: vi.fn(), getElogium: vi.fn(), ApiError };
});

import styles from "@/components/page.module.css";
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
    render(<Spread a={A} b={B} editions={EDITIONS} mm={10} dd={4} signedIn={false} turn={null} />);
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
    render(<Spread a={A} b={B} editions={EDITIONS} mm={10} dd={4} signedIn={false} turn={null} />);
    expect((await screen.findByText(/not on this day in/)).closest("p")).toHaveTextContent("[not on this day in 1749]");
    resolve({ id: "mr:w", subject: {}, anchor_day: "10-05", deprecated: false,
      editions: { [B]: { day_printed: "10-05", entry: 3, asterisk: false, unnumbered: false, text: null } } });
    const link = await screen.findByRole("link", { name: /5 October, n\. 3/ });
    expect(link).toHaveAttribute("href", `/read/${A}/10/05?with=${B}`);
    expect(link.closest("[data-row]")!.getAttribute("data-row")).toBe(cellOf("Sancti W.").getAttribute("data-row"));
  });

  it("keeps the asterisk in the note of a eulogy printed elsewhere", async () => {
    serve({ [A]: day(A, [el("mr:w", 2, "Sancti W.")]), [B]: day(B, []) });
    vi.mocked(getElogium).mockResolvedValue({ id: "mr:w", subject: {}, anchor_day: "10-05", deprecated: false,
      editions: { [B]: { day_printed: "10-05", entry: 9, asterisk: true, unnumbered: false, text: null } } });
    render(<Spread a={A} b={B} editions={EDITIONS} mm={10} dd={4} signedIn={false} turn={null} />);
    expect(await screen.findByRole("link", { name: /5 October, n\. 9\*/ })).toBeInTheDocument();
  });

  it("notes a eulogy the other edition does not print", async () => {
    serve({ [A]: day(A, [el("mr:w", 2, "Sancti W.")]), [B]: day(B, []) });
    vi.mocked(getElogium).mockResolvedValue({ id: "mr:w", subject: {}, anchor_day: "10-04", deprecated: false, editions: {} });
    render(<Spread a={A} b={B} editions={EDITIONS} mm={10} dd={4} signedIn={false} turn={null} />);
    expect((await screen.findByText(/not in/)).closest("p")).toHaveTextContent("[not in 1749]");
  });

  it("names editions of the same year by year and language", async () => {
    const IT = "martyrologium_romanum_2004_it_IT";
    serve({ [A]: day(A, [el("mr:w", 2, "Sancti W.")]), [IT]: day(IT, []) });
    vi.mocked(getElogium).mockResolvedValue({ id: "mr:w", subject: {}, anchor_day: "10-04", deprecated: false, editions: {} });
    render(<Spread a={A} b={IT} editions={[...EDITIONS, ed(IT, 2004, "it-IT")]} mm={10} dd={4} signedIn={false} turn={null} />);
    expect((await screen.findByText(/not in/)).closest("p")).toHaveTextContent("[not in 2004 Italian]");
  });

  it("falls back to two independent pages for an unaligned edition, saying why", async () => {
    const EN = "martyrologium_romanum_1914_en_unofficial";
    serve({ [A]: day(A, [el("mr:x", 1, "Sancti X.")]), [EN]: day(EN, [{ ...el("mr:x", 1, "Of Saint X."), id: null }]) });
    render(<Spread a={A} b={EN} editions={[...EDITIONS, ed(EN, 1914, "en", false)]} mm={10} dd={4} signedIn={false} turn={null} />);
    expect(await screen.findByText("Of Saint X.")).toBeInTheDocument();
    expect(screen.getByText("The 1914 English edition is not yet aligned, so its eulogies are not matched.")).toBeInTheDocument();
    expect(screen.getByText("Sancti X.").closest("[data-row]")).toBeNull();
  });

  it("shows the locked notice on a locked side, and the other side reads", async () => {
    serve({ [A]: day(A, [el("mr:x", 1, "Sancti X.")]), [B]: day(B, [{ ...el("mr:x", 4, ""), text: null }], "restricted-texts") });
    render(<Spread a={A} b={B} editions={EDITIONS} mm={10} dd={4} signedIn={false} turn={null} />);
    expect(await screen.findByText("Sancti X.")).toBeInTheDocument();
    expect(screen.getByText(/is a copyrighted edition/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(signInMock).toHaveBeenCalledWith("zitadel");
  });

  it("shows one loading state until both sides settle, and turns only the settled content", async () => {
    let resolveB!: (d: DayOut) => void;
    vi.mocked(getDay).mockImplementation((edition: string) =>
      edition === A ? Promise.resolve(day(A, [el("mr:x", 1, "Romae sancti X.")])) : new Promise((r) => { resolveB = r; }),
    );
    const { container } = render(<Spread a={A} b={B} editions={EDITIONS} mm={10} dd={4} signedIn={false} turn="next" />);
    await waitFor(() => expect(resolveB).toBeDefined());
    await act(async () => { await Promise.resolve(); });
    expect(screen.getAllByRole("status")).toHaveLength(2);
    expect(screen.queryByText("Romae sancti X.")).toBeNull();
    expect(container.querySelector("[data-row]")).toBeNull();
    expect(container.querySelectorAll(`.${styles.turnNext}`)).toHaveLength(0);
    await act(async () => { resolveB(day(B, [el("mr:x", 4, "Romae passio sancti X.")])); });
    await screen.findByText("Romae passio sancti X.");
    expect(container.querySelectorAll(`.${styles.turnNext}`)).toHaveLength(1);
    expect(container.querySelectorAll(`.${styles.turnPrev}`)).toHaveLength(0);
  });

  it("shows a side that settled locked while the other is still loading", async () => {
    vi.mocked(getDay).mockImplementation((edition: string) =>
      edition === B
        ? Promise.resolve(day(B, [{ ...el("mr:x", 4, ""), text: null }], "restricted-texts"))
        : new Promise<DayOut>(() => {}), // A never settles in this test
    );
    render(<Spread a={A} b={B} editions={EDITIONS} mm={10} dd={4} signedIn={false} turn={null} />);
    // B's locked notice (with its Sign in button) does not wait for A.
    expect(await screen.findByText(/is a copyrighted edition/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument(); // A's placeholder
  });

  it("labels every eulogy cell with its edition, for screen readers", async () => {
    serve({ [A]: day(A, [el("mr:x", 1, "Romae sancti X.")]), [B]: day(B, [el("mr:x", 4, "Romae passio sancti X.")]) });
    render(<Spread a={A} b={B} editions={EDITIONS} mm={10} dd={4} signedIn={false} turn={null} />);
    await screen.findByText("Romae sancti X.");
    expect(within(cellOf("Romae sancti X.") as HTMLElement).getByText("2004")).toBeInTheDocument();
    expect(within(cellOf("Romae passio sancti X.") as HTMLElement).getByText("1749")).toBeInTheDocument();
  });

  it("tags the B cell only when it has a eulogy or a note", async () => {
    serve({ [A]: day(A, [{ ...el("mr:x", 1, "Sancti X."), id: null }]), [B]: day(B, []) });
    render(<Spread a={A} b={B} editions={EDITIONS} mm={10} dd={4} signedIn={false} turn={null} />);
    await screen.findByText("Sancti X.");
    const b = document.querySelector(`[data-row="2"][data-side="b"]`) as HTMLElement;
    expect(b).not.toBeNull();
    expect(within(b).queryByText("1749")).toBeNull();
    expect(b.className).not.toMatch(/ruled/);
  });

  it("shows independent pages until the editions' alignment is known", async () => {
    serve({ [A]: day(A, [el("mr:x", 1, "Sancti X.")]), [B]: day(B, [el("mr:x", 4, "Sancti X antiqui.")]) });
    render(<Spread a={A} b={B} editions={[]} mm={10} dd={4} signedIn={false} turn={null} />);
    await screen.findByText("Sancti X antiqui.");
    expect(document.querySelector("[data-row]")).toBeNull();
  });

  it("marks each sheet's curators' notes from † down that sheet, with the ids shown", async () => {
    serve({
      [A]: day(A, [el("mr:0104-ferreolus", 4, "Sancti Ferreoli."), el("mr:x", 5, "Sancti X.")]),
      [B]: day(B, [el("mr:x", 1, "Sancti X, 1749."), el("mr:0220-eleutherius-et-socii", 3, "In Perside sancti Eleutherii.")]),
    });
    vi.mocked(getElogium).mockReturnValue(new Promise(() => {})); // the one-sided rows' placements
    render(<Spread a={A} b={B} editions={EDITIONS} mm={10} dd={4} signedIn={false} turn={null} showIds />);
    await screen.findByText("Sancti Ferreoli.");
    const notes = screen.getAllByRole("complementary", { name: "Editorial notes" });
    expect(notes.map((n) => n.closest("[data-side]")!.getAttribute("data-side"))).toEqual(["a", "b"]);
    expect(notes[1]).toHaveTextContent(/^†The 1749 edition names Eleutherius/);
    const marks = screen.getAllByRole("link", { name: "Editorial note 1" });
    expect(marks.map((m) => m.getAttribute("href"))).toEqual([
      `#note-${A}-mr:0104-ferreolus`, `#note-${B}-mr:0220-eleutherius-et-socii`,
    ]);
  });
});
