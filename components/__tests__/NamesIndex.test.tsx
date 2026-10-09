import { describe, it, expect } from "vitest";
import { render, screen, within } from "@/test/intl";
import NamesIndex from "@/components/NamesIndex";
import type { NamesIndexData } from "@/lib/names-index";

const ED = "martyrologium_romanum_2004";
const index: NamesIndexData = {
  printed: 5, naming: 4,
  letters: [
    { letter: "B", persons: [{ key: "Q1", name: "Basilius", qid: "Q1", label: "Basil the Great", lines: [
      { id: "mr:0102-basilius", day: { mm: 1, dd: 2 }, entry: 1, subject: "Sancti Basilius et Gregorius", footnote: null },
    ] }] },
    { letter: "T", persons: [
      { key: "name:Thomas", name: "Thomas", qid: null, label: null, lines: [
        { id: "mr:0206-paulus-miki-et-socii", day: { mm: 2, dd: 6 }, entry: 1, subject: "Sancti Paulus Miki et socii", footnote: 1 },
      ] },
      { key: "Q9", name: "Theodorus", qid: "Q9", label: null, lines: [
        { id: "mr:1109-theodorus", day: { mm: 11, dd: 9 }, entry: 2, subject: "Sanctus Theodorus", footnote: null },
      ] },
    ] },
  ],
};
const renderIndex = (i: NamesIndexData | null = index, error = false, letter?: string) =>
  render(<NamesIndex edition={ED} title="MARTYROLOGIUM ROMANUM 2004" index={i} error={error} letter={letter} lang="la" />);

describe("NamesIndex", () => {
  it("shows one letter, the first by default, with a bar linking every letter's page and the next letter", () => {
    renderIndex();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("B");
    expect(screen.queryByRole("heading", { level: 3, name: /Theodorus/ })).toBeNull();
    const bar = screen.getByRole("navigation", { name: "Letters" });
    expect(within(bar).getByText("B")).toHaveAttribute("aria-current", "page");
    expect(within(bar).getByRole("link", { name: "T" })).toHaveAttribute("href", `/en/read/${ED}/names/t`);
    expect(screen.getByRole("link", { name: "Next letter: T" })).toHaveAttribute("href", `/en/read/${ED}/names/t`);
  });

  it("titles the page and links to the edition, its notes and its places", () => {
    renderIndex();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("MARTYROLOGIUM ROMANUM 2004: index of names");
    expect(screen.getByRole("link", { name: "Index of places" })).toHaveAttribute("href", `/en/read/${ED}/places`);
  });

  it("heads a person with the Latin name and the interface name linked to Wikidata", () => {
    renderIndex();
    const h = screen.getByRole("heading", { level: 3, name: /Basilius/ });
    expect(within(h).getByRole("link", { name: "Basil the Great ↗" })).toHaveAttribute("href", "https://www.wikidata.org/wiki/Q1");
  });

  it("marks the names and subjects as the edition's language, and the interface name as the page's", () => {
    renderIndex();
    expect(screen.getByText("Basilius")).toHaveAttribute("lang", "la");
    expect(screen.getByText("Sancti Basilius et Gregorius")).toHaveAttribute("lang", "la");
    expect(screen.getByRole("link", { name: "Basil the Great ↗" }).closest("[lang]")).toBeNull();
  });

  it("links a person without a label to Wikidata by name, and an unidentified one not at all", () => {
    renderIndex(index, false, "T");
    expect(within(screen.getByRole("heading", { level: 3, name: /Theodorus/ })).getByRole("link", { name: "Wikidata ↗" }))
      .toHaveAttribute("href", "https://www.wikidata.org/wiki/Q9");
    expect(within(screen.getByRole("heading", { level: 3, name: /^Thomas/ })).queryByRole("link")).toBeNull();
  });

  it("links a text mention to the eulogy and a footnote mention to the footnote", () => {
    renderIndex();
    expect(screen.getByRole("link", { name: "2 January · Sancti Basilius et Gregorius" }))
      .toHaveAttribute("href", `/en/read/${ED}/01/02#mr:0102-basilius`);
  });

  it("links a footnote mention to the footnote", () => {
    renderIndex(index, false, "T");
    const fn = screen.getByRole("link", { name: "6 February · Sancti Paulus Miki et socii" });
    expect(fn).toHaveAttribute("href", `/en/read/${ED}/02/06#fn-${ED}-mr:0206-paulus-miki-et-socii-1`);
    expect(fn.closest("li")).toHaveTextContent("in footnote 1");
  });

  it("shows the coverage, the not-indexed note and the error note", () => {
    const { unmount } = renderIndex();
    expect(screen.getByText("4 of the 5 eulogies of this edition name someone.")).toBeInTheDocument();
    unmount();
    const { unmount: u2 } = renderIndex(null);
    expect(screen.getByText("The persons of this edition are not indexed yet.")).toBeInTheDocument();
    u2();
    renderIndex(null, true);
    expect(screen.getByText("The index could not be loaded.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", `/en/read/${ED}/names`);
  });
});
