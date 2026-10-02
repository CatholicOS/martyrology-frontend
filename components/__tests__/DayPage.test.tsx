import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DayPage from "@/components/DayPage";

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
