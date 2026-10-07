import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DayPage from "@/components/DayPage";
import styles from "@/components/page.module.css";

const day = {
  titulus: "2 Octobris Sexto Nonas Octobris. xxj. B",
  elogia: [
    { id: "mr:1002-angeli-custodes", entry: 1, asterisk: false, unnumbered: true, anchor_day: "10-02", text: "Festum sanctorum Angelorum Custodum." },
    { id: "mr:1002-modestus-sardus", entry: 2, asterisk: false, unnumbered: false, anchor_day: "10-02", text: "Romae passio sancti Modesti Sardi." },
    { id: "mr:1002-x", entry: 3, asterisk: true, unnumbered: false, anchor_day: "10-02", text: "Alibi sancti X." },
  ],
  conclusio: "Et alibi aliorum plurimorum sanctorum Martyrum. R. Deo gratias.",
};

describe("DayPage", () => {
  it("marks the article with the edition's language", () => {
    render(<DayPage day={day} heading="2 Octobris" lang="it" />);
    expect(screen.getByRole("article")).toHaveAttribute("lang", "it");
  });


  it("uses the edition's titulus as the heading", () => {
    render(<DayPage day={day} heading="2 Octobris" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("2 Octobris Sexto Nonas Octobris. xxj. B");
  });

  it("falls back to the computed heading when the edition prints no titulus", () => {
    render(<DayPage day={{ ...day, titulus: null }} heading="2 ottobre" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("2 ottobre");
  });

  it("prints numbers and asterisks as rubrics, and headers unnumbered", () => {
    render(<DayPage day={day} heading="" />);
    const header = screen.getByText("Festum sanctorum Angelorum Custodum.");
    expect(header.closest("p")).toHaveAttribute("data-unnumbered", "true");
    expect(header.closest("p")).not.toHaveTextContent(/^1/);
    // As both 2004 prints set them: the number, its asterisk, then a full stop.
    expect(screen.getByText("Romae passio sancti Modesti Sardi.").closest("p")).toHaveTextContent(/^2\.\s*Romae/);
    expect(screen.getByText("Alibi sancti X.").closest("p")).toHaveTextContent(/^3\*\.\s*Alibi/);
  });

  it("closes with the conclusio, setting R. as a rubric, and omits an empty one", () => {
    const { rerender } = render(<DayPage day={day} heading="" />);
    expect(screen.getByText("R.")).toBeInTheDocument();
    rerender(<DayPage day={{ ...day, conclusio: "" }} heading="" />);
    expect(screen.queryByText("R.")).not.toBeInTheDocument();
  });

  it("sets each rubric as a rubric where the print has it: at the head, or after its eulogy", () => {
    const rubricae = [
      { after: null, text: "In anno Bissextili omittitur." },
      { after: "mr:1002-angeli-custodes", text: "Quod sequitur, legitur in tono Lectionis." },
    ];
    render(<DayPage day={{ ...day, rubricae }} heading="" />);
    const head = screen.getByText("In anno Bissextili omittitur.");
    const after = screen.getByText("Quod sequitur, legitur in tono Lectionis.");
    expect(head).toHaveClass(styles.rubrica);
    const order = Array.from(screen.getByRole("article").querySelectorAll("p")).map((p) => p.textContent ?? "");
    const at = (t: string) => order.findIndex((x) => x.includes(t));
    expect(at("In anno Bissextili")).toBeLessThan(at("Festum sanctorum Angelorum"));
    expect(at("Quod sequitur")).toBe(at("Festum sanctorum Angelorum") + 1);
    expect(at("Quod sequitur")).toBeLessThan(at("Romae passio sancti Modesti"));
    expect(after).toHaveClass(styles.rubrica);
  });
});

describe("DayPage misprints", () => {
  const it2004 = {
    titulus: null,
    elogia: [{ id: "mr:0305-phoca", entry: 4, asterisk: false, unnumbered: false, anchor_day: "03-05", text: "Commemorazione nell’odiena Turchia di san Foca." }],
    conclusio: null,
  };

  it("notes a verified misprint after the printed text", () => {
    render(<DayPage day={it2004} heading="" edition="martyrologium_romanum_2004_it_IT" />);
    const sic = screen.getByText("sic!");
    expect(sic.tagName).toBe("I");
    expect(sic.closest("p")).toHaveTextContent("nell’odiena [sic! expected: nell’odierna] Turchia");
  });

  it("adds no note for another edition", () => {
    render(<DayPage day={it2004} heading="" edition="martyrologium_romanum_2004" />);
    expect(screen.queryByText(/sic!/)).not.toBeInTheDocument();
  });
});

describe("DayPage, a print that numbers no eulogies", () => {
  it("prints no number, asterisk or full stop when a eulogy has no entry", () => {
    const unnumberedPrint = {
      titulus: "4 Octobris",
      elogia: [{ id: "mr:1004-petronius", entry: null, asterisk: false, unnumbered: false, anchor_day: "10-04", text: "Bononiae sancti Petronii." }],
      conclusio: null,
    };
    render(<DayPage day={unnumberedPrint} heading="" />);
    const p = screen.getByText("Bononiae sancti Petronii.").closest("p")!;
    expect(p).toHaveTextContent(/^Bononiae/);
    expect(p.querySelector("span")).toBeNull();
  });
});

describe("DayPage, curators' notes", () => {
  const noted = {
    ...day,
    elogia: [
      { id: "mr:0104-ferreolus", entry: 4, asterisk: true, unnumbered: false, anchor_day: "01-04", text: "Sancti Ferreoli." },
      { id: "mr:0104-titus", entry: 5, asterisk: false, unnumbered: false, anchor_day: "01-04", text: "Sancti Titi." },
      { id: "mr:0104-rigomerus", entry: 6, asterisk: true, unnumbered: false, anchor_day: "01-04", text: "Sancti Rigomeri." },
    ],
  };

  it("shows none unless the ids are shown", () => {
    render(<DayPage day={noted} heading="4 Ianuarii" edition="ed" />);
    expect(screen.queryByRole("complementary", { name: "Editorial notes" })).toBeNull();
  });

  it("marks them †, †† in red after the text, linked to the notes at the foot of the page and back", () => {
    render(<DayPage day={noted} heading="4 Ianuarii" edition="ed" showIds />);
    const first = screen.getByRole("link", { name: "Editorial note 1" });
    const second = screen.getByRole("link", { name: "Editorial note 2" });
    expect(first).toHaveTextContent(/^†$/);
    expect(second).toHaveTextContent(/^††$/);
    expect(first.closest("p")).toHaveTextContent("Sancti Ferreoli.†");
    expect(second.closest("p")).toHaveTextContent("Sancti Rigomeri.††");
    const notes = screen.getByRole("complementary", { name: "Editorial notes" });
    expect(notes).toHaveAttribute("lang", "en");
    const items = notes.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(first).toHaveAttribute("href", `#${items[0].id}`);
    expect(items[0]).toHaveTextContent(/^†Asterisked entry \(4\*\)/);
    expect(screen.getByRole("link", { name: "Back to the text of note 2" })).toHaveAttribute("href", `#${second.id}`);
  });

  it("marks only the first of two printings of one noted eulogy, so its mark's id stays unique", () => {
    const twice = { ...noted, elogia: [noted.elogia[0], { ...noted.elogia[0], entry: 9, text: "Iterum sancti Ferreoli." }] };
    const { container } = render(<DayPage day={twice} heading="4 Ianuarii" edition="ed" showIds />);
    expect(screen.getAllByRole("link", { name: "Editorial note 1" })).toHaveLength(1);
    expect(screen.getByText("Iterum sancti Ferreoli.").closest("p")!.querySelector("a")).toBeNull();
    const ids = [...container.querySelectorAll("[id]")].map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("DayPage, printed footnotes", () => {
  const withNotes = {
    ...day,
    elogia: [
      { ...day.elogia[1], footnotes: [{ mark: "3", after: "Modesti", text: "Quorum nomina: Crescentia." }] },
      { ...day.elogia[2], footnotes: [{ mark: "4", after: "nusquam", text: "Inter quos: Vitus." }] },
    ],
  };

  it("shows them without the ids, marks as printed, linked both ways", () => {
    render(<DayPage day={withNotes} heading="2 Octobris" edition="ed" lang="la" />);
    const three = screen.getByRole("link", { name: "Footnote 3" });
    expect(three).toHaveTextContent(/^3$/);
    expect(three.closest("p")).toHaveTextContent("Romae passio sancti Modesti3 Sardi.");
    const list = screen.getByRole("complementary", { name: "Footnotes" });
    expect(list).toHaveAttribute("lang", "la");
    const items = list.querySelectorAll("li");
    expect(three).toHaveAttribute("href", `#${items[0].id}`);
    expect(items[0]).toHaveTextContent(/^3Quorum nomina: Crescentia\.$/);
    expect(screen.getByRole("link", { name: "Back to the text of footnote 3" })).toHaveAttribute("href", `#${three.id}`);
  });

  it("sets an unanchored mark at the end of the eulogy", () => {
    render(<DayPage day={withNotes} heading="2 Octobris" edition="ed" />);
    expect(screen.getByRole("link", { name: "Footnote 4" }).closest("p")).toHaveTextContent("Alibi sancti X.4");
  });

  it("lists printed footnotes before the curators' notes", () => {
    const both = {
      ...withNotes,
      elogia: [...withNotes.elogia, { id: "mr:0104-ferreolus", entry: 4, asterisk: true, unnumbered: false, anchor_day: "01-04", text: "Sancti Ferreoli." }],
    };
    render(<DayPage day={both} heading="2 Octobris" edition="ed" showIds />);
    const asides = screen.getAllByRole("complementary").map((a) => a.getAttribute("aria-label"));
    expect(asides).toEqual(["Footnotes", "Editorial notes"]);
  });

  it("puts the mark right after a misprinted word, before the sic note", () => {
    const sic = {
      ...day,
      elogia: [
        {
          id: "mr:0305-phoca", entry: 1, asterisk: false, unnumbered: false, anchor_day: "03-05",
          text: "Commemorazione nell’odiena memoria.", footnotes: [{ mark: "1", after: "nell’odiena", text: "Nota." }],
        },
      ],
    };
    render(<DayPage day={sic} heading="5 marzo" edition="martyrologium_romanum_2004_it_IT" />);
    expect(screen.getByRole("link", { name: "Footnote 1" }).closest("p")).toHaveTextContent(
      /nell’odiena1 \[sic! expected: nell’odierna\] memoria\./,
    );
  });

  it("still marks a footnote whose eulogy has no text, so the link back has a target", () => {
    const empty = { ...day, elogia: [{ ...day.elogia[1], text: "", footnotes: [{ mark: "2", after: null, text: "Nota." }] }] };
    render(<DayPage day={empty} heading="2 Octobris" edition="ed" />);
    const mark = screen.getByRole("link", { name: "Footnote 2" });
    expect(screen.getByRole("link", { name: "Back to the text of footnote 2" })).toHaveAttribute("href", `#${mark.id}`);
  });

  it("renders a page without the field exactly as before", () => {
    const { container } = render(<DayPage day={day} heading="2 Octobris" edition="ed" />);
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });});

describe("DayPage, margin notes", () => {
  const withMargins = {
    ...day,
    elogia: [
      {
        ...day.elogia[1],
        footnotes: [{ mark: "a", after: "Modesti", text: "Modesti a.] De eodem Beda." }],
        marginalia: [
          { text: "T. 2. A. 254. n. 24.", note: "a" },
          { text: "cir. A. 383.", note: null },
        ],
      },
    ],
  };

  it("sets a margin note beside its footnote, and one beside the eulogy at the eulogy's side", () => {
    render(<DayPage day={withMargins} heading="2 Octobris" edition="ed" />);
    const [atEulogy, atNote] = screen.getAllByRole("note", { name: "In the margin" });
    expect(atNote).toHaveTextContent("T. 2. A. 254. n. 24.");
    expect(atNote.closest("li")).toHaveTextContent(/^aModesti a\.\] De eodem Beda\.T\. 2\. A\. 254\. n\. 24\.$/);
    expect(atEulogy).toHaveTextContent("cir. A. 383.");
    expect(atEulogy.closest("p")).toHaveTextContent("Romae passio sancti Modesti");
  });

  it("adds nothing to a page without margin notes", () => {
    render(<DayPage day={day} heading="2 Octobris" edition="ed" />);
    expect(screen.queryByRole("note")).toBeNull();
  });
});

describe("DayPage, the edition's printed errata", () => {
  const withErrata = {
    ...day,
    elogia: [
      {
        ...day.elogia[1],
        errata: [
          { kind: "replace" as const, printed: "Modesti", corrected: "Modesto", ref: "81.20", entry: "81.20. Modesti, Modesto." },
          { kind: "add" as const, printed: "passio", corrected: "sancti", ref: "81.19", entry: "81.19. post passio, adde, sancti." },
        ],
      },
    ],
  };

  it("keeps the printed text and sets each correction after its words, with the erratum on hover", () => {
    render(<DayPage day={withErrata} heading="2 Octobris" edition="ed" />);
    const p = screen.getByText(/Romae/).closest("p")!;
    expect(p).toHaveTextContent("Romae passio [Errata: adde sancti] sancti Modesti [Errata: Modesto] Sardi.");
    const note = screen.getByRole("note", { name: "Errata: Modesto. p. 81, l. 20: 81.20. Modesti, Modesto." });
    expect(note).toHaveAttribute("tabindex", "0");
    expect(note).toHaveAttribute("title", "Errata (p. 81, l. 20: 81.20. Modesti, Modesto.)");
  });

  it("sets an addition that opens the eulogy before its first words", () => {
    const opens = { ...day, elogia: [{ ...day.elogia[1], errata: [{ kind: "add" as const, printed: "Romae passio", corrected: "Item", ref: "197.12", entry: "197.12. post, sunt, adde, Item.", position: "before" as const }] }] };
    const { container } = render(<DayPage day={opens} heading="2 Octobris" edition="ed" />);
    expect(container.querySelector("p")?.textContent).toMatch(/\[Errata: adde Item\] Romae passio sancti Modesti Sardi\.$/);
  });

  it("strikes through the words of a deletion", () => {
    const dele = { ...day, elogia: [{ ...day.elogia[1], errata: [{ kind: "delete" as const, printed: "Sardi.", corrected: "", ref: "1.1", entry: "1.1. dele Sardi." }] }] };
    const { container } = render(<DayPage day={dele} heading="2 Octobris" edition="ed" />);
    expect(container.querySelector("del")).toHaveTextContent("Sardi.");
    expect(container.querySelector("p")?.textContent).toContain("[Errata: dele]");
  });
});
