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
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    const book = screen.getByLabelText("Martyrologium Romanum 1749, Latin (not yet available)");
    expect(book).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("not yet available")).toBeInTheDocument();
    fireEvent.click(book);
    expect(onClick).not.toHaveBeenCalled();
  });
});
