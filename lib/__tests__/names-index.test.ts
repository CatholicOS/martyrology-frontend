import { describe, it, expect } from "vitest";
import { fnAnchor, namesIndex } from "@/lib/names-index";
import type { PersonsSnapshot } from "@/lib/persons";
import type { CatalogEntryOut } from "@/lib/types";

const ED = "martyrologium_romanum_2004";
const cat = (id: string, subject: string, day: string | null, entry: number | null = 1, present = true): CatalogEntryOut => ({
  id, subject, anchor_day: day ?? "01-01", deprecated: false, present, day_printed: day, entry,
});
const snap: PersonsSnapshot = {
  editions: { [ED]: {
    "mr:0828-augustinus": [{ name: "Aurelius Augustinus", where: "text", wikidata: "Q8018" }],
    "mr:0420-x": [{ name: "Augustinus", where: "text", wikidata: "Q8018" }],
    "mr:0101-y": [{ name: "Augustinus", where: { footnote: 2 }, wikidata: "Q8018" }],
    "mr:0206-paulus-miki-et-socii": [
      { name: "Paulus Miki", where: "text", wikidata: "Q380649" },
      { name: "Thomas", where: { footnote: 1 } },
    ],
    "mr:0310-z": [{ name: "Thomas", where: "text" }, { name: "Đorđe", where: "text" }],
    "mr:0311-w": [{ name: "Thomas", where: "text", wikidata: "Q43669" }],
    "mr:0909-absent": [{ name: "Nemo", where: "text" }],
  } },
  labels: { Q8018: { en: "Augustine of Hippo", it: "Agostino d'Ippona" }, Q380649: { it: "Paolo Miki" } },
};
const catalog = [
  cat("mr:0828-augustinus", "Sanctus Augustinus", "08-28"), cat("mr:0420-x", "Sanctus X", "04-20"),
  cat("mr:0101-y", "Sanctus Y", "01-01", null), cat("mr:0206-paulus-miki-et-socii", "Sancti Paulus Miki et socii", "02-06"),
  cat("mr:0310-z", "Sancti Z", "03-10"), cat("mr:0311-w", "Sanctus W", "03-11"),
  cat("mr:0909-absent", "Nemo", "09-09", 1, false), cat("mr:1225-nativitas-domini", "Nativitas Domini", "12-25"),
];

describe("namesIndex", () => {
  it("is null for an edition without persons", () => {
    expect(namesIndex(catalog, snap, "martyrologium_romanum_1749", "en")).toBeNull();
  });

  it("counts the printed eulogies and those naming someone", () => {
    const r = namesIndex(catalog, snap, ED, "en")!;
    expect(r.printed).toBe(7);  // not the absent one
    expect(r.naming).toBe(6);   // not Nativitas Domini
  });

  it("groups an identified person by QID under the most frequent Latin form", () => {
    const a = namesIndex(catalog, snap, ED, "en")!.letters.find((l) => l.letter === "A")!.persons;
    expect(a.map((p) => [p.name, p.qid, p.label, p.lines.map((l) => l.id)])).toEqual([
      ["Augustinus", "Q8018", "Augustine of Hippo", ["mr:0101-y", "mr:0420-x", "mr:0828-augustinus"]],
    ]);
  });

  it("breaks a tie between forms by the shorter", () => {
    const two = { ...snap, editions: { [ED]: { "mr:0828-augustinus": snap.editions[ED]["mr:0828-augustinus"],
      "mr:0420-x": snap.editions[ED]["mr:0420-x"] } } };
    const p = namesIndex(catalog, two, ED, "en")!.letters[0].persons[0];
    expect(p.name).toBe("Augustinus");
  });

  it("keeps an unidentified name apart from an identified namesake, and merges unidentified namesakes", () => {
    const t = namesIndex(catalog, snap, ED, "en")!.letters.find((l) => l.letter === "T")!.persons;
    expect(t.map((p) => [p.name, p.qid, p.lines.map((l) => l.id)])).toEqual([
      ["Thomas", null, ["mr:0206-paulus-miki-et-socii", "mr:0310-z"]],
      ["Thomas", "Q43669", ["mr:0311-w"]],
    ]);
  });

  it("files a stroke letter with its base letter, and the interface label falls back to English", () => {
    const r = namesIndex(catalog, snap, ED, "it")!;
    expect(r.letters.map((l) => l.letter)).toEqual(["A", "D", "P", "T"]);
    expect(r.letters[0].persons[0].label).toBe("Agostino d'Ippona");
    expect(namesIndex(catalog, snap, ED, "fr")!.letters[0].persons[0].label).toBe("Augustine of Hippo");
    expect(r.letters.find((l) => l.letter === "P")!.persons[0].label).toBe("Paolo Miki");
    expect(namesIndex(catalog, snap, ED, "de")!.letters.find((l) => l.letter === "P")!.persons[0].label).toBeNull();
  });

  it("gives a footnote mention its footnote, in calendar order, the unnumbered first", () => {
    const a = namesIndex(catalog, snap, ED, "en")!.letters[0].persons[0].lines;
    expect(a[0]).toEqual({ id: "mr:0101-y", day: { mm: 1, dd: 1 }, entry: null, subject: "Sanctus Y", footnote: 2 });
    expect(a[1].footnote).toBeNull();
    expect(fnAnchor(ED, "mr:0101-y", 2)).toBe("fn-martyrologium_romanum_2004-mr:0101-y-2");
  });
});

describe("namesIndex, the last tie", () => {
  it("heads equally frequent forms of the same length by the one first in calendar order", () => {
    const s: PersonsSnapshot = { editions: { [ED]: {
      "mr:1201-a": [{ name: "Iohannes", where: "text", wikidata: "Q5" }],
      "mr:0301-b": [{ name: "Ioannes", where: "text", wikidata: "Q5" }],
    } }, labels: {} };
    // "Ioannes" is shorter; equal lengths need another pair:
    const t: PersonsSnapshot = { editions: { [ED]: {
      "mr:1201-a": [{ name: "Ioannis", where: "text", wikidata: "Q5" }],
      "mr:0301-b": [{ name: "Ioannes", where: "text", wikidata: "Q5" }],
    } }, labels: {} };
    const c = [cat("mr:1201-a", "A", "12-01"), cat("mr:0301-b", "B", "03-01")]; // catalog order is not calendar order
    expect(namesIndex(c, s, ED, "en")!.letters[0].persons[0].name).toBe("Ioannes");
    expect(namesIndex(c, t, ED, "en")!.letters[0].persons[0].name).toBe("Ioannes");
  });
});

describe("namesIndex, from the final review", () => {
  it("lists a person once per eulogy and place when two spellings of them are identified there", () => {
    const s: PersonsSnapshot = { editions: { [ED]: {
      "mr:0131-a": [
        { name: "Augustinus Pak Chong Won", where: "text", wikidata: "Q7" },
        { name: "Augustinus Pak Chŏng-wŏn", where: "text", wikidata: "Q7" },
        { name: "Augustinus Pak Chong Won", where: { footnote: 1 }, wikidata: "Q7" },
      ],
    } }, labels: {} };
    const p = namesIndex([cat("mr:0131-a", "Sancti A et socii", "01-31")], s, ED, "en")!.letters[0].persons;
    expect(p).toHaveLength(1);
    expect(p[0].lines.map((l) => l.footnote)).toEqual([null, 1]); // text once, footnote once
    expect(p[0].name).toBe("Augustinus Pak Chong Won");           // still the most frequent form
  });
});
