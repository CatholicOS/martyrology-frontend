import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children }: { href: string; children?: React.ReactNode }) => <a href={href}>{children}</a> }));

import ReaderBar from "@/components/ReaderBar";

const props = {
  edition: "martyrologium_romanum_2004", day: { mm: 1, dd: 1 }, books: [], onGo: vi.fn(), onSwitch: vi.fn(),
  compareWith: null, compareBooks: [], onCompare: vi.fn(), onSwap: vi.fn(), subjects: null, onFind: vi.fn(),
  showIds: false, onShowIds: vi.fn(),
};

describe("ReaderBar's subject search", () => {
  const opt = (value: string, id: string) => ({ value, id, day: { mm: 7, dd: 31 } });
  const subjects = [
    opt("Sancta Cæcilia — 22 November", "mr:1122-caecilia"),
    opt("Sant'Emanuele Lê Van Phụng — 31 luglio", "mr:0731-phung"),
    opt("San Tommaso Đinh Viết Dụ — 30 gennaio", "mr:0130-dinh"),
    opt("Santi Martiri vietnamiti — 24 novembre", "mr:1124-vietnamiti"),
  ];
  const setup = (more: Partial<React.ComponentProps<typeof ReaderBar>> = {}) => {
    const onFind = vi.fn();
    render(<ReaderBar {...props} subjects={subjects} onFind={onFind} markupAvailable={false} markup={false} onMarkup={vi.fn()} {...more} />);
    const box = screen.getByRole("combobox", { name: "Find a eulogy by subject" });
    const list = document.getElementById("reader-subjects")!;
    return { box, list, onFind };
  };
  // The listbox's own options: the month and day selects have theirs too.
  const options = () => within(document.getElementById("reader-subjects")!).queryAllByRole("option");
  const shown = () => options().map((o) => o.textContent);

  it("is a combobox controlling a listbox, collapsed until something is typed", () => {
    const { box, list } = setup();
    expect(list).toHaveAttribute("role", "listbox");
    expect(list).toHaveAttribute("aria-label", "Matching subjects");
    expect(box).toHaveAttribute("aria-controls", list.id);
    expect(box).toHaveAttribute("aria-autocomplete", "list");
    expect(box).toHaveAttribute("aria-expanded", "false");
    expect(box).not.toHaveAttribute("aria-activedescendant");
    expect(list).not.toBeVisible();
  });

  it("suggests the subjects holding the typed text, with or without accents and marks", () => {
    const { box } = setup();
    fireEvent.change(box, { target: { value: "le van phung" } });
    expect(box).toHaveAttribute("aria-expanded", "true");
    expect(shown()).toEqual(["Sant'Emanuele Lê Van Phụng — 31 luglio"]);
    fireEvent.change(box, { target: { value: "Lê Văn Phụng" } });
    expect(shown()).toEqual(["Sant'Emanuele Lê Van Phụng — 31 luglio"]);
    fireEvent.change(box, { target: { value: "dinh" } });
    expect(shown()).toEqual(["San Tommaso Đinh Viết Dụ — 30 gennaio"]);
    fireEvent.change(box, { target: { value: "caecilia" } });
    expect(shown()).toEqual(["Sancta Cæcilia — 22 November"]);
    fireEvent.change(box, { target: { value: "viet" } });
    expect(shown()).toEqual(["San Tommaso Đinh Viết Dụ — 30 gennaio", "Santi Martiri vietnamiti — 24 novembre"]);
  });

  it("collapses when nothing matches", () => {
    const { box } = setup();
    fireEvent.change(box, { target: { value: "nobody" } });
    expect(box).toHaveAttribute("aria-expanded", "false");
    expect(shown()).toEqual([]);
  });

  it("lists at most fifty suggestions", () => {
    const many = Array.from({ length: 70 }, (_, i) => opt(`Sanctus ${i}`, `mr:${i}`));
    const { box } = setup({ subjects: many });
    fireEvent.change(box, { target: { value: "sanctus" } });
    expect(shown()).toHaveLength(50);
    expect(shown()[0]).toBe("Sanctus 0");
  });

  it("moves the highlight with the arrow keys, wrapping, and announces it", () => {
    const { box } = setup();
    fireEvent.change(box, { target: { value: "viet" } });
    const [first, second] = options();
    expect(first).toHaveAttribute("aria-selected", "false");
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(box).toHaveAttribute("aria-activedescendant", first.id);
    expect(first).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(box).toHaveAttribute("aria-activedescendant", second.id);
    expect(first).toHaveAttribute("aria-selected", "false");
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(box).toHaveAttribute("aria-activedescendant", first.id);
    fireEvent.keyDown(box, { key: "ArrowUp" });
    expect(box).toHaveAttribute("aria-activedescendant", second.id);
  });

  it("opens the list with the arrow keys", () => {
    const { box } = setup();
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(box).toHaveAttribute("aria-expanded", "true");
    expect(shown()).toHaveLength(4);
    expect(box).toHaveAttribute("aria-activedescendant", options()[0].id);
    fireEvent.keyDown(box, { key: "Escape" });
    fireEvent.keyDown(box, { key: "ArrowUp" });
    expect(box).toHaveAttribute("aria-activedescendant", options()[3].id);
  });

  it("picks the highlighted suggestion on Enter and clears the box", () => {
    const { box, onFind } = setup();
    fireEvent.change(box, { target: { value: "viet" } });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onFind).toHaveBeenCalledWith(subjects[3]);
    expect(box).toHaveValue("");
    expect(box).toHaveAttribute("aria-expanded", "false");
  });

  it("with nothing highlighted, Enter picks the only subject the folded text fits", () => {
    const { box, onFind } = setup();
    fireEvent.change(box, { target: { value: "viet" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onFind).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: "emanuele le van phung" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onFind).toHaveBeenCalledWith(subjects[1]);
  });

  it("picks a suggestion clicked", () => {
    const { box, onFind } = setup();
    fireEvent.change(box, { target: { value: "dinh" } });
    fireEvent.click(within(screen.getByRole("listbox", { name: "Matching subjects" })).getByRole("option", { name:"San Tommaso Đinh Viết Dụ — 30 gennaio" }));
    expect(onFind).toHaveBeenCalledWith(subjects[2]);
    expect(box).toHaveValue("");
  });

  it("closes on Escape keeping the text, and on leaving the box", () => {
    const { box } = setup();
    fireEvent.change(box, { target: { value: "viet" } });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Escape" });
    expect(box).toHaveAttribute("aria-expanded", "false");
    expect(box).not.toHaveAttribute("aria-activedescendant");
    expect(box).toHaveValue("viet");
    fireEvent.change(box, { target: { value: "vie" } });
    expect(box).toHaveAttribute("aria-expanded", "true");
    fireEvent.blur(box);
    expect(box).toHaveAttribute("aria-expanded", "false");
  });

  it("is disabled, saying so, while the subjects load", () => {
    render(<ReaderBar {...props} markupAvailable={false} markup={false} onMarkup={vi.fn()} />);
    const box = screen.getByRole("combobox", { name: "Find a eulogy by subject" });
    expect(box).toBeDisabled();
    expect(box).toHaveAttribute("placeholder", "Loading subjects…");
  });
});

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
