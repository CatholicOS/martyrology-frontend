import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/intl";
import { DocsPager } from "@/components/docs/DocsPager";

describe("DocsPager", () => {
  it("links the previous and next pages, in the page's language", () => {
    render(<DocsPager lang="it" slug="using" />);
    expect(screen.getByRole("link", { name: /Storia del Martirologio Romano/ })).toHaveAttribute("href", "/en/docs/it/history");
    expect(screen.getByRole("link", { name: /Il Martirologio e i calendari particolari/ })).toHaveAttribute("href", "/en/docs/it/particular-calendars");
  });

  it("has no previous link on the first page and no next link on the last", () => {
    const { unmount } = render(<DocsPager lang="en" slug="history" />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    unmount();
    render(<DocsPager lang="en" slug="contributing" />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/en/docs/en/data");
  });
});
