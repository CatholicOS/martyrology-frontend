import { describe, it, expect } from "vitest";
import { render, screen, within } from "@/test/intl";
import PlacesIndex from "@/components/PlacesIndex";
import type { PlacesIndexData } from "@/lib/places-index";

const index: PlacesIndexData = {
  placed: 3,
  printed: 5,
  letters: [
    { letter: "L", places: [{ qid: "Q84", label: "London", country: "GB", lines: [
      { id: "mr:0103-thomas", day: { mm: 1, dd: 3 }, entry: 1, subject: "Sanctus Thomas", printed: "Londínii", typology: "dies_natalis" },
    ] }] },
    { letter: "R", places: [{ qid: "Q220", label: "Rome", country: "IT", lines: [
      { id: "mr:0101-almachius", day: { mm: 1, dd: 1 }, entry: 2, subject: "Sanctus Almachius", printed: null, typology: "dies_natalis" },
      { id: "mr:0102-caecilia", day: { mm: 1, dd: 2 }, entry: 3, subject: "Sancta Cæcilia", printed: null, typology: "depositio" },
      { id: "mr:0104-novus", day: { mm: 1, dd: 4 }, entry: 1, subject: "Sanctus Novus", printed: null, typology: "nova_typologia" },
    ] }] },
  ],
};

const renderIndex = (i: PlacesIndexData | null = index) =>
  render(<PlacesIndex edition="martyrologium_romanum_2004" title="MARTYROLOGIUM ROMANUM 2004" index={i} />);

describe("PlacesIndex", () => {
  it("titles the page and links back to the edition and its notes", () => {
    renderIndex();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("MARTYROLOGIUM ROMANUM 2004: index of places");
    expect(screen.getByRole("link", { name: "⟵ Read the edition" })).toHaveAttribute("href", "/en/read/martyrologium_romanum_2004");
    expect(screen.getByRole("link", { name: "Notes & errata" })).toHaveAttribute("href", "/en/read/martyrologium_romanum_2004/notes");
  });

  it("links each letter to its section", () => {
    renderIndex();
    const bar = screen.getByRole("navigation", { name: "Letters" });
    expect(within(bar).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["L", "#letter-L"], ["R", "#letter-R"],
    ]);
    expect(document.getElementById("letter-R")).toHaveTextContent("Rome");
  });

  it("heads a place with its name and country, and lists its eulogies with day links to the eulogy", () => {
    renderIndex();
    const rome = screen.getByRole("heading", { level: 3, name: /Rome/ });
    expect(rome).toHaveTextContent("Rome (Italy)");
    const day = screen.getByRole("link", { name: "1 January · Sanctus Almachius" });
    expect(day).toHaveAttribute("href", "/en/read/martyrologium_romanum_2004/01/01#mr:0101-almachius");
    expect(day.closest("li")).toHaveTextContent("Sanctus Almachius");
  });

  it("names each day link with its eulogy, so a list of links tells them apart", () => {
    renderIndex();
    const days = screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.includes("#mr:"));
    expect(days.map((a) => a.getAttribute("aria-label"))).toEqual([
      "3 January · Sanctus Thomas", "1 January · Sanctus Almachius", "2 January · Sancta Cæcilia", "4 January · Sanctus Novus",
    ]);
  });

  it("shows the printed form where there is one, and the typology unless dies natalis", () => {
    renderIndex();
    expect(screen.getByText("Londínii").tagName).toBe("I");
    const thomas = screen.getByRole("link", { name: "3 January · Sanctus Thomas" }).closest("li")!;
    expect(thomas).not.toHaveTextContent("Dies natalis");
    const caecilia = screen.getByRole("link", { name: "2 January · Sancta Cæcilia" }).closest("li")!;
    expect(caecilia).toHaveTextContent("Depositio");
  });

  it("shows no label for a typology the messages don't know", () => {
    renderIndex();
    const novus = screen.getByRole("link", { name: "4 January · Sanctus Novus" }).closest("li")!;
    expect(novus).toHaveTextContent("Sanctus Novus");
    expect(novus).not.toHaveTextContent("nova_typologia");
  });

  it("says how many eulogies are placed when not all are, and nothing when all are", () => {
    const { unmount } = renderIndex();
    expect(screen.getByText("3 of the 5 eulogies of this edition are placed so far.")).toBeInTheDocument();
    unmount();
    renderIndex({ ...index, printed: 3 });
    expect(screen.queryByText(/are placed so far/)).toBeNull();
  });

  it("says so when no eulogy is placed", () => {
    renderIndex({ letters: [], placed: 0, printed: 0 });
    expect(screen.getByText("No eulogies of this edition are placed yet.")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Letters" })).toBeNull();
  });

  it("offers to try again when the index could not be loaded", () => {
    renderIndex(null);
    expect(screen.getByText("The index could not be loaded.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/en/read/martyrologium_romanum_2004/places");
  });

  it("names places and countries in the interface language", () => {
    render(<PlacesIndex edition="martyrologium_romanum_2004" title="X" index={index} />, { locale: "it" });
    expect(screen.getByRole("heading", { level: 3, name: /Rome/ })).toHaveTextContent("Rome (Italia)");
  });
});
