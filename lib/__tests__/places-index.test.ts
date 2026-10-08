import { describe, it, expect } from "vitest";
import { compareLines, headingLetter, placeLabel, placesIndex, type PlaceLine } from "@/lib/places-index";
import type { PlacesSnapshot } from "@/lib/places";
import type { CatalogEntryOut } from "@/lib/types";

const snap: PlacesSnapshot = {
  places: {
    Q220: { label: "Rome", country: "IT", coords: [41.9, 12.5], labels: { en: "Rome", it: "Roma", de: "Rom" } },
    Q84: { label: "London", country: "GB", coords: [51.5, -0.1], labels: { en: "London", it: "Londra" } },
    Q1: { label: "Ōtsu", country: "JP", coords: null },
    Q2: { label: "avila", country: "ES", coords: [40.6, -4.7] },
    Q3: { label: "Q3", country: "", coords: null },
  },
  eulogies: {
    "mr:0101-almachius": { place: "Q220", la: "Romæ", it: "A Roma", typology: "dies_natalis" },
    "mr:0102-caecilia": { place: "Q220", la: "Romæ via Appia", typology: "depositio" },
    "mr:0103-thomas": { place: "Q84", la: "Londínii", it: "A Londra", typology: "dies_natalis" },
    "mr:0104-otsu": { place: "Q1", la: "Otsu", typology: null },
    "mr:0105-avila": { place: "Q2", la: "Abulæ", typology: "dies_natalis" },
    "mr:0106-nemo": { place: "Q3", la: "Nusquam", typology: "dies_natalis" },
    "mr:0107-lost": { place: "Q404", la: "Ubique", typology: "dies_natalis" }, // the QID is missing from places
  },
};

const cat = (id: string, subject: string, day: string | null, entry: number | null = 1, present = true): CatalogEntryOut => ({
  id, subject, anchor_day: day ?? "01-01", deprecated: false, present, day_printed: day, entry,
});

const catalog: CatalogEntryOut[] = [
  cat("mr:0102-caecilia", "Sancta Cæcilia", "01-02", 3),
  cat("mr:0101-almachius", "Sanctus Almachius", "01-02", 2),
  cat("mr:0103-thomas", "Sanctus Thomas", "01-03"),
  cat("mr:0104-otsu", "Beati Martyres Otsuenses", "01-04"),
  cat("mr:0105-avila", "Sancta Teresia", "01-05"),
  cat("mr:0106-nemo", "Sanctus Nemo", "01-06"),
  cat("mr:0107-lost", "Sanctus Perditus", "01-07"),
  cat("mr:0108-unplaced", "Sancta Martina", "01-08"),
  cat("mr:0109-absent", "Sanctus Absens", "01-09", 1, false),
  cat("mr:0110-nodate", "Sanctus Sine Die", null),
  cat("mr:0111-lead", "In Nativitate", "01-02", null), // unnumbered: printed first on its day
];
snap.eulogies["mr:0111-lead"] = { place: "Q220", la: "Romæ", typology: "commemoratio" };

const LA = "martyrologium_romanum_2004";
const IT = "martyrologium_romanum_2004_it_IT";
const OLD = "martyrologium_romanum_1749";

describe("placesIndex", () => {
  it("counts the eulogies the edition prints and those of them that are placed", () => {
    const { placed, printed } = placesIndex(catalog, snap, LA, "en");
    // printed: every present eulogy with a printed day (not 0109-absent, not 0110-nodate)
    expect(printed).toBe(9);
    // placed: those with a place in the snapshot (not 0107-lost, whose QID is missing; not 0108-unplaced)
    expect(placed).toBe(7);
  });

  it("groups the eulogies by place, under letters, headings sorted in the interface language", () => {
    const { letters } = placesIndex(catalog, snap, LA, "en");
    expect(letters.map((l) => [l.letter, l.places.map((p) => p.label)])).toEqual([
      ["A", ["avila"]],
      ["L", ["London"]],
      ["O", ["Ōtsu"]],
      ["Q", ["Q3"]],
      ["R", ["Rome"]],
    ]);
  });

  it("heads each place with its label in the interface language, else English, else the gazetteer's", () => {
    const it_ = placesIndex(catalog, snap, LA, "it").letters.flatMap((l) => l.places.map((p) => p.label));
    expect(it_).toEqual(["avila", "Londra", "Ōtsu", "Q3", "Roma"]);
    const fr = placesIndex(catalog, snap, LA, "fr").letters.flatMap((l) => l.places.map((p) => p.label));
    expect(fr).toEqual(["avila", "London", "Ōtsu", "Q3", "Rome"]);
  });

  it("lists a place's eulogies in calendar order, the unnumbered first on its day", () => {
    const rome = placesIndex(catalog, snap, LA, "en").letters.find((l) => l.letter === "R")!.places[0];
    expect(rome.qid).toBe("Q220");
    expect(rome.country).toBe("IT");
    expect(rome.lines.map((l) => l.id)).toEqual(["mr:0111-lead", "mr:0101-almachius", "mr:0102-caecilia"]);
    expect(rome.lines[1]).toEqual({
      id: "mr:0101-almachius", day: { mm: 1, dd: 2 }, entry: 2, subject: "Sanctus Almachius", printed: "Romæ", typology: "dies_natalis",
    });
  });

  it("shows the printed form only where it is the edition's own: Latin 2004 and Italian 2004", () => {
    const line = (edition: string) =>
      placesIndex(catalog, snap, edition, "en").letters.find((l) => l.letter === "L")!.places[0].lines[0].printed;
    expect(line(LA)).toBe("Londínii");
    expect(line(IT)).toBe("A Londra");
    expect(line(OLD)).toBeNull();
    // An Italian eulogy without an Italian form has none.
    const avila = placesIndex(catalog, snap, IT, "en").letters.find((l) => l.letter === "A")!.places[0].lines[0];
    expect(avila.printed).toBeNull();
  });

  it("files a heading with a stroke letter under the letter the sort puts it with", () => {
    const strokes: PlacesSnapshot = {
      places: {
        Q10: { label: "Dinan", country: "FR", coords: null },
        Q11: { label: "Đồng Hới", country: "VN", coords: null },
        Q12: { label: "Łódź", country: "PL", coords: null },
        Q13: { label: "Ærø", country: "DK", coords: null },
        Q14: { label: "Dire Dawa", country: "ET", coords: null },
      },
      eulogies: {
        "mr:0101-a": { place: "Q10", la: "A", typology: null },
        "mr:0101-b": { place: "Q11", la: "B", typology: null },
        "mr:0101-c": { place: "Q12", la: "C", typology: null },
        "mr:0101-d": { place: "Q13", la: "D", typology: null },
        "mr:0101-e": { place: "Q14", la: "E", typology: null },
      },
    };
    const cats = ["a", "b", "c", "d", "e"].map((x) => cat(`mr:0101-${x}`, x, "01-01"));
    const { letters } = placesIndex(cats, strokes, OLD, "en");
    expect(letters.map((l) => [l.letter, l.places.map((p) => p.label)])).toEqual([
      ["A", ["Ærø"]],
      ["D", ["Dinan", "Dire Dawa", "Đồng Hới"]], // Đ sorts as D: "Dong" after "Dire"
      ["L", ["Łódź"]],
    ]);
  });

  it("is empty for an edition that prints nothing", () => {
    expect(placesIndex([cat("mr:0109-absent", "Sanctus Absens", "01-09", 1, false)], snap, OLD, "en")).toEqual({
      letters: [], placed: 0, printed: 0,
    });
  });
});

describe("placeLabel", () => {
  it("falls back from the interface language to English to the gazetteer's label", () => {
    expect(placeLabel(snap.places.Q220, "Q220", "de")).toBe("Rom");
    expect(placeLabel(snap.places.Q84, "Q84", "de")).toBe("London");
    expect(placeLabel({ label: "", country: "", coords: null }, "Q9", "de")).toBe("Q9");
  });
});

describe("headingLetter", () => {
  it("folds accents and case, and files a heading without a letter under #", () => {
    expect(headingLetter("Ōtsu")).toBe("O");
    expect(headingLetter("ávila")).toBe("A");
    expect(headingLetter("ʼs-Hertogenbosch")).toBe("S");
    expect(headingLetter("123")).toBe("#");
    expect(headingLetter("Łódź")).toBe("Ł");
  });
});

describe("compareLines", () => {
  const line = (mm: number, dd: number, entry: number | null): PlaceLine =>
    ({ id: "x", day: { mm, dd }, entry, subject: "", printed: null, typology: null });

  it("orders by day, then the unnumbered first, then by number", () => {
    expect(compareLines(line(1, 2, 1), line(1, 3, 1))).toBeLessThan(0);
    expect(compareLines(line(1, 2, null), line(1, 2, 1))).toBeLessThan(0);
    expect(compareLines(line(1, 2, 3), line(1, 2, 2))).toBeGreaterThan(0);
  });

  it("is a tie, not NaN, between two unnumbered eulogies of the same day", () => {
    expect(compareLines(line(1, 2, null), line(1, 2, null))).toBe(0);
  });
});
