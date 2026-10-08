import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/intl";
import { DocsPager } from "@/components/docs/DocsPager";

describe("DocsPager", () => {
  it("links the previous and next pages, in the interface language", () => {
    render(<DocsPager slug="using" />, { locale: "it" });
    expect(screen.getByRole("link", { name: /Precedente: Storia del Martirologio Romano/ })).toHaveAttribute("href", "/it/docs/history");
    expect(screen.getByRole("link", { name: /Successivo: Il Martirologio e i calendari particolari/ })).toHaveAttribute("href", "/it/docs/particular-calendars");
  });

  it("has no previous link on the first page and no next link on the last", () => {
    const { unmount } = render(<DocsPager slug="history" />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    unmount();
    render(<DocsPager slug="contributing" />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/en/docs/data");
  });
});
