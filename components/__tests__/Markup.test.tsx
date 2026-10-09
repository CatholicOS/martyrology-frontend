import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, fireEvent, act } from "@/test/intl";
import type { EntityState } from "@/lib/entities-client";

vi.mock("@/lib/entities-client", () => ({
  useEntity: (): EntityState => ({ status: "ready", entity: null }),
  requestEntities: vi.fn(),
  usePrefetchEntities: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children }: { href: string; children?: ReactNode }) => <a href={href}>{children}</a> }));

import { CLOSE_MS, MarkupProvider, OPEN_MS } from "@/components/markup/Markup";
import { MentionRun, MentionText } from "@/components/markup/MentionPiece";
import { mentionsIn } from "@/lib/mentions";
import type { Mention } from "@/lib/types";
import styles from "@/components/page.module.css";

const TEXT = "Cæsaréæ in Cappadócia, sepultúra sancti Basilíi, magístri.";
const MENTIONS: Mention[] = [
  { kind: "place", where: "text", start: 0, end: 21, form: "Cæsaréæ in Cappadócia", name: null, qid: "Q48338" },
  { kind: "person", where: "text", start: 40, end: 47, form: "Basilíi", name: "Basilius", qid: null },
];

function Page({ on = true }: { on?: boolean }) {
  return (
    <MarkupProvider on={on} langs={{ ed: "la" }}>
      <p>
        <MentionText text={TEXT} mentions={MENTIONS} where="text" eulogy="mr:0101-basilius" edition="ed" />
      </p>
      <button>elsewhere</button>
    </MarkupProvider>
  );
}
const person = () => screen.getByRole("button", { name: "Basilíi" });
const place = () => screen.getByRole("button", { name: "Cæsaréæ in Cappadócia" });

describe("the markup", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("marks nothing while off: the text as it is", () => {
    const { container } = render(<Page on={false} />);
    expect(container.querySelector("p")!.innerHTML).toBe(TEXT);
  });

  it("leaves a run of placed mentions plain outside a provider that is on", () => {
    const placed = mentionsIn(MENTIONS, "text", "ed", "mr:0101-basilius", TEXT.length);
    const run = <MentionRun text={TEXT} from={0} to={TEXT.length} mentions={placed} edition="ed" />;
    const outside = render(<p>{run}</p>);
    expect(outside.container.querySelector("p")!.innerHTML).toBe(TEXT);
    outside.unmount();
    const off = render(<MarkupProvider on={false} langs={{ ed: "la" }}><p>{run}</p></MarkupProvider>);
    expect(off.container.querySelector("p")!.innerHTML).toBe(TEXT);
  });

  it("marks each mention, dotted for persons and dashed for places, announced as a person or place", () => {
    render(<Page />);
    expect(person()).toHaveClass(styles.mention, styles.person);
    expect(place()).toHaveClass(styles.mention, styles.place);
    expect(person()).toHaveAttribute("tabindex", "0");
    expect(person()).toHaveAttribute("aria-haspopup", "dialog");
    expect(person()).toHaveAttribute("aria-expanded", "false");
    expect(person()).toHaveAttribute("aria-roledescription", "person");
    expect(place()).toHaveAttribute("aria-roledescription", "place");
  });

  it("makes only a mention's first piece focusable, and tints every piece together", () => {
    // A mention cut in two (as a footnote mark cuts it): both pieces carry it, only the first takes the focus.
    const placed = mentionsIn(MENTIONS, "text", "ed", "mr:0101-basilius", TEXT.length);
    const { container } = render(
      <MarkupProvider on langs={{ ed: "la" }}>
        <p>
          <MentionRun text={TEXT} from={0} to={43} mentions={placed} edition="ed" />
          <sup>1</sup>
          <MentionRun text={TEXT} from={43} to={TEXT.length} mentions={placed} edition="ed" />
        </p>
      </MarkupProvider>,
    );
    const pieces = [...container.querySelectorAll<HTMLElement>("[data-mention]")].filter((n) => n.textContent !== place().textContent);
    expect(pieces.map((n) => n.textContent)).toEqual(["Bas", "ilíi"]);
    expect(pieces[0]).toBe(screen.getByRole("button", { name: "Bas" }));
    expect(pieces[1]).not.toHaveAttribute("tabindex");
    expect(pieces[1]).not.toHaveAttribute("role");
    expect(pieces[1].dataset.mention).toBe(pieces[0].dataset.mention);
    expect(pieces[1]).toHaveClass(styles.mention, styles.person);
    fireEvent.mouseEnter(pieces[1]);
    expect(pieces[0]).toHaveAttribute("data-active");
    expect(pieces[1]).toHaveAttribute("data-active");
    fireEvent.click(pieces[1]);
    expect(screen.getByRole("dialog", { name: "Basilius" })).toBeInTheDocument();
    expect(pieces[0]).toHaveAttribute("aria-expanded", "true");
  });

  it("opens on hover after the delay, and closes after the pointer leaves", () => {
    render(<Page />);
    fireEvent.mouseEnter(person());
    expect(person()).toHaveAttribute("data-active");
    act(() => vi.advanceTimersByTime(OPEN_MS - 1));
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("dialog", { name: "Basilius" })).toBeInTheDocument();
    fireEvent.mouseLeave(person());
    act(() => vi.advanceTimersByTime(CLOSE_MS - 1));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(person()).not.toHaveAttribute("data-active");
  });

  it("stays open while the pointer is in the popup", () => {
    render(<Page />);
    fireEvent.mouseEnter(person());
    act(() => vi.advanceTimersByTime(OPEN_MS));
    fireEvent.mouseLeave(person());
    fireEvent.mouseEnter(screen.getByRole("dialog"));
    act(() => vi.advanceTimersByTime(CLOSE_MS * 2));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByRole("dialog"));
    act(() => vi.advanceTimersByTime(CLOSE_MS));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not move the focus into a popup the pointer opened", () => {
    render(<Page />);
    fireEvent.click(person());
    expect(screen.getByRole("dialog")).not.toHaveFocus();
  });

  it("pins on click, one popup at a time; a second click unpins", () => {
    render(<Page />);
    fireEvent.click(person());
    expect(screen.getByRole("dialog", { name: "Basilius" })).toBeInTheDocument();
    expect(person()).toHaveAttribute("aria-expanded", "true");
    fireEvent.mouseLeave(person());
    act(() => vi.advanceTimersByTime(CLOSE_MS * 2));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(place());
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog")).toHaveTextContent("Cæsaréæ in Cappadócia");
    expect(person()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(place());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("pins on Enter and moves focus into the popup; Escape closes it and returns focus", () => {
    render(<Page />);
    act(() => person().focus());
    expect(person()).toHaveAttribute("data-active");
    fireEvent.keyDown(person(), { key: "Enter" });
    const dialog = screen.getByRole("dialog", { name: "Basilius" });
    expect(dialog).not.toHaveAttribute("aria-modal");
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(person()).toHaveFocus();
  });

  it("pins on Space too", () => {
    render(<Page />);
    fireEvent.keyDown(person(), { key: " " });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes on a click outside, leaving the focus where it is when it was not in the popup", () => {
    render(<Page />);
    fireEvent.click(person());
    act(() => screen.getByRole("button", { name: "elsewhere" }).focus());
    fireEvent.mouseDown(screen.getByRole("button", { name: "elsewhere" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "elsewhere" })).toHaveFocus();
  });

  it("closes on a click outside, giving the focus back to the mention when it was in the popup", () => {
    render(<Page />);
    fireEvent.keyDown(person(), { key: "Enter" });
    expect(screen.getByRole("dialog")).toHaveFocus();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(person()).toHaveFocus();
  });

  it("does not close on a click in the popup", () => {
    render(<Page />);
    fireEvent.click(person());
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("places the popup beside its mention, and again when the window scrolls", () => {
    render(<Page />);
    const box = (top: number) => ({ top, bottom: top + 20, left: 100, right: 160, x: 100, y: top, width: 60, height: 20, toJSON: () => ({}) });
    const rect = vi.spyOn(person(), "getBoundingClientRect").mockReturnValue(box(100));
    fireEvent.click(person());
    const dialog = screen.getByRole("dialog");
    expect(dialog.style.top).toBe("126px");
    expect(dialog.style.left).toBe("100px");
    expect(dialog.style.visibility).toBe("visible");
    rect.mockReturnValue(box(50));
    fireEvent.scroll(window);
    expect(dialog.style.top).toBe("76px");
  });

  it("leaves no popup open in a provider remounted for another day", () => {
    const { rerender } = render(<Page key="a" />);
    fireEvent.click(person());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    rerender(<Page key="b" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(person()).toHaveAttribute("aria-expanded", "false");
  });

  it("shows no popup and no marks while switched off, and does not reopen it when switched back on", () => {
    const { rerender } = render(<Page />);
    fireEvent.click(person());
    rerender(<Page on={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Basilíi" })).toBeNull();
    rerender(<Page />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(person()).toHaveAttribute("aria-expanded", "false");
    expect(person()).not.toHaveAttribute("data-active");
  });

  it("does not open a hovered mention's popup once switched off", () => {
    const { rerender } = render(<Page />);
    fireEvent.mouseEnter(person());
    rerender(<Page on={false} />);
    act(() => vi.advanceTimersByTime(OPEN_MS));
    rerender(<Page />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
