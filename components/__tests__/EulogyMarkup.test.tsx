import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen, fireEvent, act, within as within_ } from "@/test/intl";
import type { EntityState } from "@/lib/entities-client";

vi.mock("@/lib/entities-client", () => ({
  useEntity: (): EntityState => ({ status: "ready", entity: null }), requestEntities: vi.fn(), usePrefetchEntities: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children }: { href: string; children?: ReactNode }) => <a href={href}>{children}</a> }));

import { MarkupProvider } from "@/components/markup/Markup";
import EulogyText from "@/components/EulogyText";
import PrintedFootnotes from "@/components/PrintedFootnotes";
import { pageFootnotes } from "@/lib/footnotes";
import type { Erratum, Mention } from "@/lib/types";

const TEXT = "Cæsaréæ in Cappadócia, sepultúra sancti Basilíi, magístri.";
const place: Mention = { kind: "place", where: "text", start: 0, end: 21, form: "Cæsaréæ in Cappadócia", name: null, qid: "Q48338" };
const person: Mention = { kind: "person", where: "text", start: 40, end: 47, form: "Basilíi", name: "Basilius", qid: null };
const inNote: Mention = { kind: "person", where: { footnote: 1 }, start: 5, end: 10, form: "Petri", name: "Petrus", qid: null };
const ID = "mr:0101-basilius";
const NOTE = { mark: "1", after: "Cæsaréæ", text: "Vide Petri vitam." };
const footnotes = pageFootnotes([{ id: ID, footnotes: [NOTE], mentions: [place, person, inNote] }], "ed");
const erratum: Erratum = { kind: "replace", printed: "Basilíi", corrected: "Basilii", ref: "1.2", entry: "Basilíi] Basilii" };

const within = (on: boolean, ui: ReactNode, langs: Record<string, string> = { ed: "la" }) => (
  <MarkupProvider on={on} langs={langs} page={{ edition: "ed", with: null }}>{ui}</MarkupProvider>
);

describe("mentions in the reader's text", () => {
  it("leaves the eulogy exactly as it is while the markup is off", () => {
    const eulogy = (mentions?: Mention[]) => (
      <p><EulogyText text={TEXT} id={ID} edition="ed" footnotes={footnotes} errata={[erratum]} mentions={mentions} /></p>
    );
    const plain = render(eulogy());
    const html = plain.container.innerHTML;
    plain.unmount();
    const off = render(within(false, eulogy([place, person])));
    expect(off.container.innerHTML).toBe(html);
    off.unmount();
    const outside = render(eulogy([place, person]));
    expect(outside.container.innerHTML).toBe(html);
  });

  it("leaves a eulogy without apparatus as plain text while the markup is off", () => {
    const { container } = render(within(false, <p><EulogyText text={TEXT} id={ID} edition="ed" mentions={[place, person]} /></p>));
    expect(container.querySelector("p")!.innerHTML).toBe(TEXT);
  });

  it("leaves the footnotes exactly as they are while the markup is off", () => {
    const bare = pageFootnotes([{ id: ID, footnotes: [NOTE] }], "ed");
    const plain = render(<PrintedFootnotes notes={bare} lang="la" />);
    const html = plain.container.innerHTML;
    plain.unmount();
    const off = render(within(false, <PrintedFootnotes notes={footnotes} edition="ed" lang="la" />));
    expect(off.container.innerHTML).toBe(html);
  });

  it("marks a eulogy without apparatus too", () => {
    render(within(true, <p><EulogyText text={TEXT} id={ID} edition="ed" mentions={[place, person]} /></p>));
    expect(screen.getByRole("button", { name: "Basilíi" })).toBeInTheDocument();
  });

  it("cuts a mention at a footnote mark into pieces of one mention, the first focusable, all tinted together", () => {
    const { container } = render(within(true, <p><EulogyText text={TEXT} id={ID} edition="ed" footnotes={footnotes} mentions={[place, person]} /></p>));
    const pieces = [...container.querySelectorAll<HTMLElement>(`[data-mention="ed|${ID}|text|0"]`)];
    expect(pieces.map((p) => p.textContent)).toEqual(["Cæsaréæ", " in Cappadócia"]);
    expect(pieces[0]).toHaveAttribute("tabindex", "0");
    expect(pieces[1]).not.toHaveAttribute("tabindex");
    expect(pieces[0].nextElementSibling?.tagName).toBe("A"); // the footnote mark between them
    fireEvent.mouseEnter(pieces[1]);
    expect(pieces[0]).toHaveAttribute("data-active");
    expect(pieces[1]).toHaveAttribute("data-active");
  });

  it("cuts a mention at the edge of an erratum, keeping every piece marked", () => {
    const long: Mention = { ...person, start: 33, end: 47, form: "sancti Basilíi" };
    const { container } = render(within(true, <p><EulogyText text={TEXT} id={ID} edition="ed" errata={[erratum]} mentions={[long]} /></p>));
    const pieces = [...container.querySelectorAll<HTMLElement>(`[data-mention="ed|${ID}|text|33"]`)];
    expect(pieces.map((p) => p.textContent)).toEqual(["sancti ", "Basilíi"]);
    expect(pieces[0]).toHaveAttribute("tabindex", "0");
  });

  it("marks the mentions printed in a footnote, counted from the footnote's text", () => {
    render(within(true, <PrintedFootnotes notes={footnotes} edition="ed" lang="la" />));
    expect(screen.getByRole("button", { name: "Petri" })).toHaveAttribute("data-mention", `ed|${ID}|fn1|5`);
  });

  it("tints a person in both columns of a spread, but opens the popup of the mark hovered only", () => {
    const column = (edition: string) => (
      <div data-side={edition}>
        <p><EulogyText text={TEXT} id={ID} edition={edition} mentions={[place, person]} /></p>
      </div>
    );
    const { container } = render(within(true, <>{column("a")}{column("b")}</>, { a: "la", b: "la" }));
    const pieces = (side: string) => [...container.querySelectorAll<HTMLElement>(`[data-side="${side}"] [data-mention]`)];
    const basilius = (side: string) => pieces(side).find((p) => p.textContent === "Basilíi")!;
    fireEvent.mouseEnter(basilius("b"));
    // The same person (name and n) in the other column is tinted too; the place beside it is not.
    expect(pieces("b").filter((p) => p.hasAttribute("data-active"))).toEqual([basilius("b")]);
    expect(pieces("a").filter((p) => p.hasAttribute("data-active"))).toEqual([basilius("a")]);
    fireEvent.mouseLeave(basilius("b"));
    // From the keyboard in column b: the focus goes into the popup, and back to column b's mention.
    act(() => basilius("b").focus());
    fireEvent.keyDown(basilius("b"), { key: "Enter" });
    expect(screen.getByRole("dialog", { name: "Basilius" })).toHaveFocus();
    expect(basilius("a")).toHaveAttribute("aria-expanded", "false");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(basilius("b")).toHaveFocus();
  });

  it("tints with a mark that names two persons the marks of each, and shows both in its popup", () => {
    const la = "Fruméntii et alteríus Fruméntii.";
    const it = "due mercanti entrambi di nome Frumenzio.";
    const first: Mention = { kind: "person", where: "text", start: 0, end: 9, form: "Fruméntii", name: "Frumentius", qid: null };
    const second: Mention = { ...first, start: 22, end: 31, n: 2 };
    const both: Mention = { kind: "person", where: "text", start: 30, end: 39, form: "Frumenzio", name: "Frumentius", qid: null,
      others: [{ name: "Frumentius", n: 2, qid: null }] };
    const { container } = render(within(true, <>
      <div data-side="a"><p><EulogyText text={la} id="mr:0323-x" edition="a" mentions={[first, second]} /></p></div>
      <div data-side="b"><p><EulogyText text={it} id="mr:0323-x" edition="b" mentions={[both]} /></p></div>
    </>, { a: "la", b: "it" }));
    const marks = (side: string) => [...container.querySelectorAll<HTMLElement>(`[data-side="${side}"] [data-mention]`)];
    const active = (side: string) => marks(side).filter((p) => p.hasAttribute("data-active")).map((p) => p.dataset.mention);
    fireEvent.mouseEnter(marks("b")[0]);
    expect(active("a")).toEqual(["a|mr:0323-x|text|0", "a|mr:0323-x|text|22"]);
    fireEvent.mouseLeave(marks("b")[0]);
    fireEvent.mouseEnter(marks("a")[1]); // the second Frumentius alone
    expect(active("a")).toEqual(["a|mr:0323-x|text|22"]);
    expect(active("b")).toEqual(["b|mr:0323-x|text|30"]);
    fireEvent.mouseLeave(marks("a")[1]);
    fireEvent.click(marks("b")[0]);
    const dialog = screen.getByRole("dialog");
    expect(within_(dialog).getAllByRole("heading").map((h) => h.textContent)).toEqual(["Frumentius", "Frumentius"]);
    expect(dialog).toHaveAccessibleName("Frumentius Frumentius");
  });
});
