import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BookCover from "@/components/BookCover";
import type { EditionOut } from "@/lib/types";

const e1749: EditionOut = {
  edition_id: "martyrologium_romanum_1749", year: 1749, locale: "la", nature: "editio_typica_recognita",
  book: "martyrologium", scope: {}, promulgation: {}, governance: { governing_body: "", type: "" },
  availability: { status: "public" },
};
const e2004it: EditionOut = { ...e1749, edition_id: "martyrologium_romanum_2004_it_IT", year: 2004, locale: "it-IT",
  nature: "editio_vernacula", availability: { status: "restricted-texts" } };

describe("BookCover", () => {
  it("is an openable book with title, year and language", () => {
    const onClick = vi.fn();
    render(<BookCover edition={e1749} state="open" onClick={onClick} />);
    const book = screen.getByRole("button", { name: "Martyrologium Romanum 1749, Latin" });
    expect(book).toHaveTextContent("MARTYROLOGIUM");
    expect(book).toHaveTextContent("1749");
    fireEvent.click(book);
    expect(onClick).toHaveBeenCalled();
  });

  it("is a locked book, still clickable to explain why", () => {
    const onClick = vi.fn();
    render(<BookCover edition={e2004it} state="locked" onClick={onClick} />);
    const book = screen.getByRole("button", { name: "Martirologio Romano 2004, Italiano (CEI) (locked)" });
    expect(book).toHaveTextContent("🔒");
    fireEvent.click(book);
    expect(onClick).toHaveBeenCalled();
  });

  it("is not interactive when unavailable", () => {
    const onClick = vi.fn();
    render(<BookCover edition={{ ...e1749, availability: { status: "unavailable" } }} state="unavailable" onClick={onClick} />);
    expect(screen.queryByRole("button", { name: /^Martyrologium/ })).not.toBeInTheDocument();
    const book = screen.getByRole("img", { name: "Martyrologium Romanum 1749, Latin (not yet available)" });
    expect(screen.getByText("not yet available")).toBeInTheDocument();
    fireEvent.click(book);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("BookCover back", () => {
  const withSource: EditionOut = {
    ...e1749,
    source: {
      title: "Martyrologium Romanum … Benedicti XIV … auctum et castigatum",
      imprint: "Eystadii (Eichstätt), 2013",
      year: 2013,
      rights: "Public domain",
      isbn: null,
      note: "A 2013 retyping of the 1913 Mechelen printing.",
    },
  };

  it("turns round to show the colophon, and back again", () => {
    render(<BookCover edition={withSource} state="open" />);
    const about = screen.getByRole("button", { name: "About this edition: Martyrologium Romanum 1749, Latin" });
    const back = screen.getByLabelText("About Martyrologium Romanum 1749, Latin");
    expect(about).toHaveAttribute("aria-expanded", "false");
    expect(back).toHaveAttribute("inert");
    fireEvent.click(about);
    expect(about).toHaveAttribute("aria-expanded", "true");
    expect(back).not.toHaveAttribute("inert");
    expect(back).toHaveTextContent("Editio typica recognita, 1749");
    expect(back).toHaveTextContent("Eystadii (Eichstätt), 2013");
    expect(back).toHaveTextContent("Public domain");
    expect(back).not.toHaveTextContent("ISBN");
    // The front can't be opened while the book is turned.
    expect(screen.getByRole("button", { name: "Martyrologium Romanum 1749, Latin", hidden: true }).closest("[inert]")).not.toBeNull();
    fireEvent.click(about);
    expect(about).toHaveAttribute("aria-expanded", "false");
  });

  it("says so when the edition has no source", () => {
    render(<BookCover edition={{ ...e1749, availability: { status: "unavailable" } }} state="unavailable" />);
    fireEvent.click(screen.getByRole("button", { name: /About this edition/ }));
    expect(screen.getByLabelText(/^About Martyrologium/)).toHaveTextContent("No texts of this edition are attached yet.");
  });

  it("shows only the edition when an available one has no source recorded", () => {
    render(<BookCover edition={e1749} state="open" />);
    const back = screen.getByLabelText(/^About Martyrologium/);
    expect(back).toHaveTextContent("Editio typica recognita, 1749");
    expect(back).not.toHaveTextContent("No texts");
  });
});
