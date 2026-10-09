import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@/test/intl";

const { push, signInMock } = vi.hoisted(() => ({ push: vi.fn(), signInMock: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push }), Link: ({ href, children, ...p }: { href: string | { pathname: string }; children?: React.ReactNode }) => <a href={typeof href === "string" ? href : href.pathname} {...p}>{children}</a> }));
vi.mock("next-auth/react", () => ({ signIn: signInMock }));
// The subject search labels follow the interface language from the registry; these tests use the catalog's own subjects.
vi.mock("@/lib/snapshot", () => ({ getSnapshot: () => ({}) }));
// One curator's note, for the links to a note.
vi.mock("@/data/notes-snapshot.json", () => ({
  default: { "mr:1002-modestus-sardus": { editions: { martyrologium_romanum_1749: "A curator's note on Modestus." } } },
}));
vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    constructor(public status: number, public title: string) { super(title); }
  }
  return { getDay: vi.fn(), getEditions: vi.fn(), getAccess: vi.fn(), getElogium: vi.fn(), getCatalog: vi.fn(), ApiError };
});

// The reader asks for the popups' details while the markup is on.
vi.mock("@/lib/entities-client", () => ({
  useEntity: () => ({ status: "idle" }), requestEntities: vi.fn(), usePrefetchEntities: vi.fn(),
}));

import Reader, { __resetReaderState } from "@/components/Reader";
import styles from "@/components/page.module.css";
import { getDay, getEditions, getAccess, getElogium, getCatalog, ApiError } from "@/lib/api";
import { __resetShowIds } from "@/lib/use-show-ids";
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

const CATALOG = [
  { id: "mr:1002-modestus-sardus", subject: "Sanctus Modestus", anchor_day: "10-02", deprecated: false, present: true, day_printed: "10-02", entry: 2 },
  { id: "mr:1225-anastasia", subject: "Sancta Anastasia", anchor_day: "12-25", deprecated: false, present: true, day_printed: "12-25", entry: 3 },
];

beforeEach(() => {
  __resetReaderState();
  __resetShowIds();
  window.localStorage.clear();
  push.mockReset();
  vi.mocked(getCatalog).mockReset().mockResolvedValue(CATALOG);
  vi.mocked(getElogium).mockReset();
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
  it("does not link to an index of names for an edition without persons", async () => {
    render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    expect(screen.queryByRole("link", { name: "Index of names" })).toBeNull();
  });

  it("links to the edition's notes and its index of places", async () => {
    render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    expect(screen.getByRole("link", { name: "Index of places" })).toHaveAttribute("href", "/read/martyrologium_romanum_1749/places");
  });

  it("restores focus to the control that navigated, after the remount", async () => {
    const first = render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "15" } });
    first.unmount();
    render1749(10, 15);
    expect(screen.getByLabelText("Day")).toHaveFocus();
  });

  it("restores focus to Next day, and leaves it alone after an arrow key", async () => {
    const first = render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    first.unmount();
    const second = render1749(10, 3);
    expect(screen.getByRole("button", { name: "Next day" })).toHaveFocus();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    second.unmount();
    render1749(10, 4);
    expect(document.body).toHaveFocus();
  });

  it("keeps the day arrows for screen readers and keyboards, hidden on phones where swipe turns the page", async () => {
    render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    for (const name of ["Previous day", "Next day"]) {
      const strip = screen.getByRole("button", { name });
      expect(strip).toHaveClass("max-sm:sr-only", "max-sm:focus-visible:not-sr-only", "flex");
    }
  });

  it("pushes once when Next day is clicked twice quickly", async () => {
    render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    const next = screen.getByRole("button", { name: "Next day" });
    fireEvent.click(next);
    fireEvent.click(next);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("Today on today's date does not navigate, jam the guard or leak focus", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 2, 12));
    try {
      const first = render1749(10, 2);
      await screen.findByText("Romae passio sancti Modesti Sardi.");
      fireEvent.click(screen.getByRole("button", { name: "Today" }));
      expect(push).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Next day" }));
      expect(push).toHaveBeenCalledTimes(1);
      first.unmount();
      render1749(10, 3);
      expect(screen.getByRole("button", { name: "Next day" })).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it("announces loading as a status", () => {
    render1749();
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("sets the page language from the edition", async () => {
    render(<Reader edition="martyrologium_romanum_1914_en_unofficial" mm={10} dd={2} signedIn={false} />);
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    expect(screen.getByRole("article")).toHaveAttribute("lang", "en");
  });

  it("shows the day's page", async () => {
    render1749();
    expect(await screen.findByText("Romae passio sancti Modesti Sardi.")).toBeInTheDocument();
    expect(getDay).toHaveBeenCalledWith("martyrologium_romanum_1749", "10", "02", new Date().getFullYear());
  });

  it("turns pages from full-height side strips whose arrows are pinned at the top", async () => {
    render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    for (const [name, glyph] of [["Previous day", "‹"], ["Next day", "›"]]) {
      const strip = screen.getByRole("button", { name });
      // The strip itself is the target; the arrow inside is decoration pinned near the top.
      expect(strip).toHaveAttribute("data-strip", "true");
      const arrow = strip.querySelector("[aria-hidden]");
      expect(arrow).toHaveTextContent(glyph);
      expect(arrow?.className).toMatch(/\bsticky\b/);
    }
  });

  it("turns to the next and previous day, wrapping the year", async () => {
    const first = render1749(12, 31);
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    expect(push).toHaveBeenCalledWith("/read/martyrologium_romanum_1749/01/01");
    first.unmount(); // Next remounts the reader on each turn
    render1749(1, 1);
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(push).toHaveBeenCalledWith("/read/martyrologium_romanum_1749/12/31");
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
    const first = render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "15" } });
    expect(push).toHaveBeenCalledWith("/read/martyrologium_romanum_1749/10/15");
    first.unmount();
    render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    const switcher = screen.getByLabelText("Switch book");
    expect([...switcher.querySelectorAll("option")].map((o) => o.value)).toEqual([
      "martyrologium_romanum_1914_en_unofficial", "martyrologium_romanum_1749",
    ]);
    fireEvent.change(switcher, { target: { value: "martyrologium_romanum_1914_en_unofficial" } });
    expect(push).toHaveBeenCalledWith("/read/martyrologium_romanum_1914_en_unofficial/10/02");
  });

  it("keeps the current book selected in Switch book when the edition list cannot be loaded", async () => {
    vi.mocked(getEditions).mockRejectedValue(new Error("down"));
    render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    const switcher = screen.getByLabelText("Switch book") as HTMLSelectElement;
    expect([...switcher.querySelectorAll("option")].map((o) => o.value)).toEqual(["martyrologium_romanum_1749"]);
    expect(switcher.value).toBe("martyrologium_romanum_1749");
  });

  it("keeps a locked current book selectable in Switch book", async () => {
    vi.mocked(getDay).mockResolvedValue({ ...DAY, elogia: [{ ...DAY.elogia[0], text: null }],
      metadata: { ...DAY.metadata, access: "restricted-texts" } });
    render(<Reader edition="martyrologium_romanum_2004" mm={10} dd={2} signedIn={false} />);
    await screen.findByText(/Sign in to open this edition/);
    const switcher = screen.getByLabelText("Switch book") as HTMLSelectElement;
    await vi.waitFor(() =>
      expect([...switcher.querySelectorAll("option")].map((o) => o.value)).toEqual([
        "martyrologium_romanum_2004", "martyrologium_romanum_1914_en_unofficial", "martyrologium_romanum_1749",
      ]),
    );
    expect(switcher.value).toBe("martyrologium_romanum_2004");
  });

  it("shows the locked notice, not blank eulogies, for a redacted edition", async () => {
    vi.mocked(getDay).mockResolvedValue({ ...DAY, elogia: [{ ...DAY.elogia[0], text: null }],
      metadata: { ...DAY.metadata, access: "restricted-texts", access_info: "https://example/licensing" } });
    render(<Reader edition="martyrologium_romanum_2004" mm={10} dd={2} signedIn={false} />);
    await screen.findByText("Sign in to open this edition.", { exact: false });
    expect(screen.getByRole("status")).toHaveTextContent("Sign in to open this edition");
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

  it("plays the turn on the incoming page after an arrow, not after a picker jump", async () => {
    const first = render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    expect(screen.getByText("Romae passio sancti Modesti Sardi.").closest(`.${styles.turnNext}`)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    first.unmount();
    render1749(10, 3);
    const text = await screen.findByText("Romae passio sancti Modesti Sardi.");
    expect(text.closest(`.${styles.turnNext}`)).not.toBeNull();
    cleanup();
    fireEvent.change(render1749().getByLabelText("Day"), { target: { value: "15" } });
    cleanup();
    render1749(10, 15);
    const jumped = await screen.findByText("Romae passio sancti Modesti Sardi.");
    expect(jumped.closest(`.${styles.turnNext}`)).toBeNull();
    expect(jumped.closest(`.${styles.turnPrev}`)).toBeNull();
  });

  it("a remounted reader has the book list at once, without refetching", async () => {
    const first = render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    await screen.findAllByRole("option", { name: /1914/ });
    first.unmount();
    render1749(10, 3);
    expect(screen.getAllByRole("option", { name: /1914/ }).length).toBeGreaterThan(0);
    expect(getEditions).toHaveBeenCalledTimes(1);
  });

  it("ignores a mostly vertical swipe", async () => {
    render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    const area = screen.getByRole("button", { name: "Next day" }).parentElement!;
    fireEvent.touchStart(area, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(area, { changedTouches: [{ clientX: 130, clientY: 300 }] });
    expect(push).not.toHaveBeenCalled();
    fireEvent.touchStart(area, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(area, { changedTouches: [{ clientX: 130, clientY: 110 }] });
    expect(push).toHaveBeenCalledWith("/read/martyrologium_romanum_1749/10/03");
  });

  it("ignores arrow keys combined with a modifier", async () => {
    render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    fireEvent.keyDown(window, { key: "ArrowRight", altKey: true });
    expect(push).not.toHaveBeenCalled();
  });
});

const EN = "martyrologium_romanum_1914_en_unofficial";
const renderPair = (mm = 10, dd = 2) =>
  render(<Reader edition="martyrologium_romanum_1749" mm={mm} dd={dd} signedIn={false} withEdition={EN} />);

describe("Reader, two editions", () => {
  it("shows both editions' texts", async () => {
    renderPair();
    expect(await screen.findAllByText("Romae passio sancti Modesti Sardi.")).toHaveLength(2);
  });

  it("keeps the pairing on every way of turning the day", async () => {
    renderPair();
    await screen.findAllByText("Romae passio sancti Modesti Sardi.");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(push).toHaveBeenLastCalledWith(`/read/martyrologium_romanum_1749/10/03?with=${EN}`);
  });

  it("keeps the pairing from the strips and the day select", async () => {
    const first = renderPair();
    await screen.findAllByText("Romae passio sancti Modesti Sardi.");
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(push).toHaveBeenLastCalledWith(`/read/martyrologium_romanum_1749/10/01?with=${EN}`);
    first.unmount();
    __resetReaderState();
    renderPair();
    await screen.findAllByText("Romae passio sancti Modesti Sardi.");
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "15" } });
    expect(push).toHaveBeenLastCalledWith(`/read/martyrologium_romanum_1749/10/15?with=${EN}`);
  });

  it("swaps the two editions, and closes the second", async () => {
    const first = renderPair();
    await screen.findAllByText("Romae passio sancti Modesti Sardi.");
    fireEvent.click(screen.getByRole("button", { name: "Swap the two editions" }));
    expect(push).toHaveBeenLastCalledWith(`/read/${EN}/10/02?with=martyrologium_romanum_1749`);
    first.unmount();
    __resetReaderState();
    renderPair();
    await screen.findAllByText("Romae passio sancti Modesti Sardi.");
    fireEvent.click(screen.getByRole("button", { name: "Close the second edition" }));
    expect(push).toHaveBeenLastCalledWith("/read/martyrologium_romanum_1749/10/02");
  });

  it("opens a comparison from the Compare with select, offering every other open book", async () => {
    render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    const select = screen.getByLabelText("Compare with");
    // The book list arrives with the editions, after the day.
    await waitFor(() =>
      expect([...select.querySelectorAll("option")].map((o) => o.textContent)).toEqual(["Compare with…", "Roman Martyrology 1914"]),
    );
    fireEvent.change(select, { target: { value: EN } });
    expect(push).toHaveBeenLastCalledWith(`/read/martyrologium_romanum_1749/10/02?with=${EN}`);
  });

  it("drops the pairing when book A is switched to book B", async () => {
    renderPair();
    await screen.findAllByText("Romae passio sancti Modesti Sardi.");
    fireEvent.change(screen.getByLabelText("Switch book"), { target: { value: EN } });
    expect(push).toHaveBeenLastCalledWith(`/read/${EN}/10/02`);
  });

  it("turns the two sheets as one", async () => {
    const first = renderPair();
    await screen.findAllByText("Romae passio sancti Modesti Sardi.");
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    first.unmount();
    const { container } = renderPair(10, 3);
    await screen.findAllByText("Romae passio sancti Modesti Sardi.");
    expect(container.querySelectorAll(`.${styles.turnNext}`)).toHaveLength(1);
  });
});

describe("Reader, subject search", () => {
  const search = async () => {
    const box = screen.getByLabelText("Find a eulogy by subject");
    await waitFor(() => expect(box).toBeEnabled());
    return box;
  };

  it("lists the book's subjects with the day each is printed on, in the book's language", async () => {
    render1749();
    await search();
    expect(getCatalog).toHaveBeenCalledWith("martyrologium_romanum_1749", "la");
    expect([...document.querySelectorAll("#reader-subjects option")].map((o) => o.getAttribute("value"))).toEqual([
      "Sancta Anastasia — 25 December", "Sanctus Modestus — 2 October",
    ]);
  });

  it("goes to the day a picked subject is printed on, keeping the pairing, and finds it there", async () => {
    const first = renderPair();
    fireEvent.change(await search(), { target: { value: "Sancta Anastasia — 25 December" } });
    expect(push).toHaveBeenLastCalledWith(`/read/martyrologium_romanum_1749/12/25?with=${EN}`);
    first.unmount();
    vi.mocked(getDay).mockResolvedValue({ ...DAY, elogia: [{ ...DAY.elogia[0], id: "mr:1225-anastasia", text: "Sirmii sanctae Anastasiae." }] });
    renderPair(12, 25);
    const [found] = await screen.findAllByText("Sirmii sanctae Anastasiae.");
    await waitFor(() => expect(found.closest("[data-eulogy-id]")).toHaveAttribute("data-found"));
    expect(found.closest("[data-eulogy-id]")).toHaveFocus();
  });

  it("finds a subject on the open day without navigating, and takes typed text on Enter", async () => {
    render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    const box = await search();
    fireEvent.change(box, { target: { value: "modest" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(push).not.toHaveBeenCalled();
    expect(box).toHaveValue("");
    expect(screen.getByText("Romae passio sancti Modesti Sardi.").closest("[data-eulogy-id]")).toHaveAttribute("data-found");
  });

  it("still finds the eulogy when its day is drawn only after a retry", async () => {
    const first = render1749();
    fireEvent.change(await search(), { target: { value: "Sancta Anastasia — 25 December" } });
    first.unmount();
    vi.mocked(getDay).mockRejectedValueOnce(new ApiError(502, "API unreachable"));
    vi.mocked(getDay).mockResolvedValueOnce({ ...DAY, elogia: [{ ...DAY.elogia[0], id: "mr:1225-anastasia", text: "Sirmii sanctae Anastasiae." }] });
    render1749(12, 25);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    const found = await screen.findByText("Sirmii sanctae Anastasiae.");
    await waitFor(() => expect(found.closest("[data-eulogy-id]")).toHaveAttribute("data-found"));
  });

  it("stays disabled when the book's subjects cannot be loaded", async () => {
    vi.mocked(getCatalog).mockRejectedValue(new Error("down"));
    render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    await waitFor(() => expect(getCatalog).toHaveBeenCalled());
    expect(screen.getByLabelText("Find a eulogy by subject")).toBeDisabled();
  });
});

describe("Reader, id switch", () => {
  it("sets each eulogy's canonical id above it, and remembers the choice across days", async () => {
    const first = renderPair();
    await screen.findAllByText("Romae passio sancti Modesti Sardi.");
    expect(screen.queryByText("mr:1002-modestus-sardus")).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "IDs" }));
    expect(screen.getAllByText("mr:1002-modestus-sardus")).toHaveLength(2);
    first.unmount();
    render1749(10, 3);
    expect(await screen.findByText("mr:1002-modestus-sardus")).toHaveClass(styles.idHint);
    expect(screen.getByRole("switch", { name: "IDs" })).toBeChecked();
    expect(window.localStorage.getItem("reader.showIds")).toBe("1");
  });
});

describe("Reader, a link to a eulogy", () => {
  // A client-side navigation (a link from the index of places or of names) puts the new address in
  // place after the page renders and before its effects run: a parent's layout effect does the same.
  function ArriveBy({ hash, children }: { hash: string; children: React.ReactNode }) {
    React.useLayoutEffect(() => {
      window.history.replaceState(null, "", `/read/martyrologium_romanum_1749/10/02#${hash}`);
    }, [hash]);
    return <>{children}</>;
  }

  it("finds the eulogy when a client-side navigation brings the address after rendering", async () => {
    window.history.replaceState(null, "", "/read/martyrologium_romanum_1749/10/02");
    render(<ArriveBy hash="mr:1002-modestus-sardus"><Reader edition="martyrologium_romanum_1749" mm={10} dd={2} signedIn={false} /></ArriveBy>);
    const found = await screen.findByText("Romae passio sancti Modesti Sardi.");
    await waitFor(() => expect(found.closest("[data-eulogy-id]")).toHaveAttribute("data-found"));
    window.history.replaceState(null, "", "/");
  });

  const DAY_FN = {
    ...DAY,
    elogia: [{ ...DAY.elogia[0], footnotes: [{ mark: "1", after: "Sardi.", text: "A printed footnote on Modestus." }], marginalia: [] }],
  };

  it("finds the footnote named in the address when the page opens, without showing the IDs", async () => {
    vi.mocked(getDay).mockResolvedValue(DAY_FN);
    window.history.replaceState(null, "", "/read/martyrologium_romanum_1749/10/02#fn-martyrologium_romanum_1749-mr:1002-modestus-sardus-1");
    render1749();
    const note = await screen.findByText("A printed footnote on Modestus.");
    await waitFor(() => expect(note.closest("li")).toHaveAttribute("data-found"));
    expect(screen.getByRole("switch", { name: "IDs" })).not.toBeChecked();
    window.history.replaceState(null, "", "/");
  });

  it("finds the footnote when only the address's footnote changes, on the same day", async () => {
    vi.mocked(getDay).mockResolvedValue(DAY_FN);
    window.history.replaceState(null, "", "/read/martyrologium_romanum_1749/10/02");
    render1749();
    const note = await screen.findByText("A printed footnote on Modestus.");
    expect(note.closest("li")).not.toHaveAttribute("data-found");
    window.history.replaceState(null, "", "/read/martyrologium_romanum_1749/10/02#fn-martyrologium_romanum_1749-mr:1002-modestus-sardus-1");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await waitFor(() => expect(note.closest("li")).toHaveAttribute("data-found"));
    window.history.replaceState(null, "", "/");
  });

  it("shows the day when the footnote in the address is not there", async () => {
    window.history.replaceState(null, "", "/read/martyrologium_romanum_1749/10/02#fn-martyrologium_romanum_1749-mr:1002-modestus-sardus-9");
    render1749();
    expect(await screen.findByText("Romae passio sancti Modesti Sardi.")).toBeInTheDocument();
    window.history.replaceState(null, "", "/");
  });

  it("finds the eulogy named in the address when the page opens", async () => {
    window.history.replaceState(null, "", "/read/martyrologium_romanum_1749/10/02#mr:1002-modestus-sardus");
    render1749();
    const found = await screen.findByText("Romae passio sancti Modesti Sardi.");
    await waitFor(() => expect(found.closest("[data-eulogy-id]")).toHaveAttribute("data-found"));
    window.history.replaceState(null, "", "/");
  });

  it("finds it when only the address's eulogy changes, on the same day", async () => {
    window.history.replaceState(null, "", "/read/martyrologium_romanum_1749/10/02");
    render1749();
    const found = await screen.findByText("Romae passio sancti Modesti Sardi.");
    expect(found.closest("[data-eulogy-id]")).not.toHaveAttribute("data-found");
    window.history.replaceState(null, "", "/read/martyrologium_romanum_1749/10/02#mr:1002-modestus-sardus");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await waitFor(() => expect(found.closest("[data-eulogy-id]")).toHaveAttribute("data-found"));
    window.history.replaceState(null, "", "/");
  });

  it("shows the IDs and finds the curator's note named in the address when the page opens", async () => {
    window.history.replaceState(null, "", "/read/martyrologium_romanum_1749/10/02#note-martyrologium_romanum_1749-mr:1002-modestus-sardus");
    render1749();
    const note = await screen.findByText("A curator's note on Modestus.");
    await waitFor(() => expect(note.closest("li")).toHaveAttribute("data-found"));
    expect(screen.getByRole("switch", { name: "IDs" })).toBeChecked();
    window.history.replaceState(null, "", "/");
  });

  it("finds the note when only the address changes to it, on the same day", async () => {
    window.history.replaceState(null, "", "/read/martyrologium_romanum_1749/10/02");
    render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    expect(screen.queryByText("A curator's note on Modestus.")).toBeNull();
    window.history.replaceState(null, "", "/read/martyrologium_romanum_1749/10/02#note-martyrologium_romanum_1749-mr:1002-modestus-sardus");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    const note = await screen.findByText("A curator's note on Modestus.");
    await waitFor(() => expect(note.closest("li")).toHaveAttribute("data-found"));
    window.history.replaceState(null, "", "/");
  });
});

describe("Reader, the Names & places switch", () => {
  const MENTION = { kind: "place", where: "text", start: 0, end: 5, form: "Romae", name: null, qid: "Q220" } as const;
  const named = (day: typeof DAY, edition: string) => ({
    ...day, metadata: { ...day.metadata, edition }, elogia: [{ ...day.elogia[0], mentions: [MENTION] }],
  });

  it("shows when the day on screen names someone or somewhere", async () => {
    vi.mocked(getDay).mockResolvedValue(named(DAY, "martyrologium_romanum_1749"));
    render1749();
    expect(await screen.findByRole("switch", { name: "Names & places" })).toBeInTheDocument();
  });

  it("is not rendered on a day without mentions, and the stored choice is left alone", async () => {
    window.localStorage.setItem("reader.markup", "1");
    render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    expect(screen.queryByRole("switch", { name: "Names & places" })).toBeNull();
    expect(window.localStorage.getItem("reader.markup")).toBe("1");
  });

  it("marks the day's mentions while it is on, and leaves no popup open on the next day", async () => {
    window.localStorage.setItem("reader.markup", "1");
    vi.mocked(getDay).mockResolvedValue(named(DAY, "martyrologium_romanum_1749"));
    const { rerender } = render1749();
    fireEvent.click(await screen.findByRole("button", { name: "Romae" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    rerender(<Reader edition="martyrologium_romanum_1749" mm={10} dd={3} signedIn={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByRole("button", { name: "Romae" })).toHaveAttribute("aria-expanded", "false");
  });

  it("leaves no popup open on the next day of the compare view", async () => {
    window.localStorage.setItem("reader.markup", "1");
    vi.mocked(getDay).mockImplementation(async (edition: string) => named(DAY, edition));
    const { rerender } = renderPair();
    const [first] = await screen.findAllByRole("button", { name: "Romae" });
    fireEvent.click(first);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    rerender(<Reader edition="martyrologium_romanum_1749" mm={10} dd={3} signedIn={false} withEdition={EN} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findAllByRole("button", { name: "Romae" })).toHaveLength(2);
  });

  it("shows in the compare view when either column has a mention", async () => {
    vi.mocked(getDay).mockImplementation(async (edition: string) =>
      edition === EN ? named(DAY, EN) : DAY);
    renderPair();
    expect(await screen.findByRole("switch", { name: "Names & places" })).toBeInTheDocument();
  });
});
