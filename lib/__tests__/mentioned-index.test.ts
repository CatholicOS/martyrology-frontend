import { describe, it, expect } from "vitest";
import { mentionedIndex } from "@/lib/mentioned-index";
import type { PersonsSnapshot } from "@/lib/persons";
import type { CatalogEntryOut } from "@/lib/types";

const ED = "martyrologium_romanum_2004";
const cat = (id: string, subject: string, day: string): CatalogEntryOut => ({
  id, subject, anchor_day: day, deprecated: false, present: true, day_printed: day, entry: 1,
});
const snap: PersonsSnapshot = { editions: {
  [ED]: {
    "mr:1107-willibrordus": [{ name: "Willibrordus", where: "text", wikidata: "Q298" }],
    "mr:0320-wulframnus": [{ name: "Willibrordus", where: "text", wikidata: "Q298", role: "mentioned" }],
    "mr:0501-x": [
      { name: "Nero", where: "text", wikidata: "Q8", role: "mentioned" },
      { name: "Gregorius", where: "text", wikidata: "Q7", role: "mentioned" },
      { name: "Diocletianus", where: { footnote: 1 }, role: "mentioned" },
    ],
    "mr:0502-y": [
      { name: "Nero", where: "text", wikidata: "Q8", role: "mentioned" },
      { name: "Diocletianus", where: "text", role: "mentioned" },
      { name: "Thomas", where: "text" },
      { name: "Thomas", n: 2, where: "text", role: "mentioned" },
    ],
    "mr:0503-z": [{ name: "Diocletianus", where: "text" }],
  },
  martyrologium_romanum_2004_it_IT: { "mr:0601-gregorius": [{ name: "Gregorius", where: "text", wikidata: "Q7" }] },
  // An older edition's commemoration does not count: Nero stays not commemorated.
  martyrologium_romanum_1914_en_unofficial: { "mr:0601-nero": [{ name: "Nero", where: "text", wikidata: "Q8" }] },
}, labels: { Q8: { en: "Nero" } } };
const days = [cat("mr:1107-willibrordus", "Sanctus Willibrordus", "11-07"), cat("mr:0320-wulframnus", "Sanctus Wulframnus", "03-20"),
  cat("mr:0501-x", "Sancti X", "05-01"), cat("mr:0502-y", "Sancti Y", "05-02"), cat("mr:0503-z", "Sanctus Z", "05-03")];
const all = () => mentionedIndex(days, snap, ED, "en")!.letters.flatMap((l) => l.persons);

describe("mentionedIndex", () => {
  it("is null for an edition without persons", () => {
    expect(mentionedIndex(days, snap, "martyrologium_romanum_1749", "en")).toBeNull();
  });

  it("lists a person commemorated nowhere, with the eulogies that mention them", () => {
    const n = all().find((p) => p.qid === "Q8")!;
    expect(n).toMatchObject({ key: "Q8", name: "Nero", label: "Nero" });
    expect(n.lines.map((l) => [l.id, l.mentioned])).toEqual([["mr:0501-x", true], ["mr:0502-y", true]]);
  });

  it("keeps a person whom only an older edition commemorates", () => {
    expect(all().some((p) => p.qid === "Q8")).toBe(true);
  });

  it("leaves out persons commemorated somewhere, in this edition or another", () => {
    expect(all().some((p) => p.qid === "Q298" || p.qid === "Q7")).toBe(false);
    expect(all().some((p) => p.key === "name:Thomas" || p.key === "name:Diocletianus")).toBe(false);
  });

  it("gives each eulogy's unidentified person a heading of their own, never merged with a namesake", () => {
    expect(all().filter((p) => p.name === "Diocletianus").map((p) => p.key))
      .toEqual(["name:Diocletianus#1@mr:0501-x", "name:Diocletianus#1@mr:0502-y"]);
    expect(all().find((p) => p.name === "Thomas")!.key).toBe("name:Thomas#2@mr:0502-y");
  });

  it("files its persons by letter", () => {
    expect(mentionedIndex(days, snap, ED, "en")!.letters.map((l) => l.letter)).toEqual(["D", "N", "T"]);
  });
});
