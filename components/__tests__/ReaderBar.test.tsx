import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children }: { href: string; children?: React.ReactNode }) => <a href={href}>{children}</a> }));

import ReaderBar from "@/components/ReaderBar";

const props = {
  edition: "martyrologium_romanum_2004", day: { mm: 1, dd: 1 }, books: [], onGo: vi.fn(), onSwitch: vi.fn(),
  compareWith: null, compareBooks: [], onCompare: vi.fn(), onSwap: vi.fn(), subjects: null, onFind: vi.fn(),
  showIds: false, onShowIds: vi.fn(),
};

describe("ReaderBar's Names & places switch", () => {
  it("is a switch beside Show IDs, telling what it does", () => {
    const onMarkup = vi.fn();
    render(<ReaderBar {...props} markupAvailable markup={false} onMarkup={onMarkup} />);
    const sw = screen.getByRole("switch", { name: "Names & places" });
    expect(sw).not.toBeChecked();
    expect(sw.closest("label")).toHaveAttribute("title", "Mark the persons and places each eulogy names");
    fireEvent.click(sw);
    expect(onMarkup).toHaveBeenCalledWith(true);
  });

  it("is named in the interface language", () => {
    render(<ReaderBar {...props} markupAvailable markup onMarkup={vi.fn()} />, { locale: "it" });
    expect(screen.getByRole("switch", { name: "Nomi e luoghi" })).toBeChecked();
  });

  it("is not rendered when the day on screen names no one and nowhere", () => {
    render(<ReaderBar {...props} markupAvailable={false} markup onMarkup={vi.fn()} />);
    expect(screen.queryByRole("switch", { name: "Names & places" })).toBeNull();
    expect(screen.getByRole("switch", { name: "IDs" })).toBeInTheDocument();
  });
});
