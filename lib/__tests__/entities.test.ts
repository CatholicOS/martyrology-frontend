import { describe, it, expect } from "vitest";
import { entitiesFor, MAX_IDS, parseIds } from "@/lib/entities";
import type { PersonDetails } from "@/lib/entities";
import type { PersonsSnapshot } from "@/lib/persons";
import type { PlacesSnapshot } from "@/lib/places";
import type { RegistrySnapshot } from "@/lib/snapshot";

const persons: PersonsSnapshot = { editions: {}, labels: { Q19546: { en: "Basil of Caesarea", it: "Basilio di Cesarea" }, Q7: { en: "Seven" } } };
const places: PlacesSnapshot = {
  places: { Q220: { label: "Rome", country: "IT", coords: [41.9, 12.5], labels: { en: "Rome", it: "Roma" } } },
  eulogies: {},
};
const basil: PersonDetails = {
  description: { en: "Greek bishop" },
  born: { year: 329, precision: "year", circa: false },
  died: { year: 379, precision: "year", circa: false },
  image: null,
  wikipedia: {},
};
const details: Record<string, PersonDetails> = { Q19546: basil };
const registry: RegistrySnapshot = {};

describe("parseIds", () => {
  it("keeps well-formed QIDs, each once", () => {
    expect(parseIds("Q220, Q19546,Q220,x,Q0,q5,")).toEqual(["Q220", "Q19546"]);
    expect(parseIds(null)).toEqual([]);
  });

  it(`refuses more than ${MAX_IDS}`, () => {
    const many = Array.from({ length: MAX_IDS + 1 }, (_, i) => `Q${i + 1}`).join(",");
    expect(parseIds(many)).toBeNull();
    expect(parseIds(Array.from({ length: MAX_IDS }, (_, i) => `Q${i + 1}`).join(","))).toHaveLength(MAX_IDS);
  });
});

describe("entitiesFor", () => {
  it("gives a place its labels and position, a person their labels and details, and leaves out the unknown", () => {
    expect(entitiesFor(["Q220", "Q19546", "Q7", "Q404"], persons, details, places, registry)).toEqual({
      Q220: { kind: "place", labels: { en: "Rome", it: "Roma" }, label: "Rome", country: "IT", coords: [41.9, 12.5] },
      Q19546: { kind: "person", labels: { en: "Basil of Caesarea", it: "Basilio di Cesarea" }, details: basil, eulogies: [] },
      Q7: { kind: "person", labels: { en: "Seven" }, details: null, eulogies: [] },
    });
  });

  it("gives a person whose item has neither labels nor details the eulogies that name them", () => {
    const reg: RegistrySnapshot = {
      "mr:0101-basilius": { deprecated: false, month: 1, day: 1, entry: 1, asterisk: false, unnumbered: false, country: null, subject: { la: "Sanctus Basilius", it: "", en: "" } },
    };
    const ps: PersonsSnapshot = { editions: { martyrologium_romanum_2004: { "mr:0101-basilius": [{ name: "Basilius", where: "text", wikidata: "Q9" }] } }, labels: {} };
    expect(entitiesFor(["Q9"], ps, {}, places, reg).Q9).toEqual({
      kind: "person", labels: {}, details: null,
      eulogies: [{ id: "mr:0101-basilius", month: 1, day: 1, subject: reg["mr:0101-basilius"].subject, own: true }],
    });
  });

  it("gives a person every eulogy that names their item: their own first (the subject names them), then by day", () => {
    const entry = (month: number, day: number, la: string) =>
      ({ deprecated: false, month, day, entry: 1, asterisk: false, unnumbered: false, country: null, subject: { la, it: `it ${la}`, en: `en ${la}` } });
    const reg: RegistrySnapshot = {
      "mr:0920-andreas-kim-tae-gon-et-socii": entry(9, 20, "Sancti Andreas Kim Tae-gŏn et socii"),
      "mr:0109-agatha-yi-et-teresia-kim": entry(1, 9, "Sanctae Agatha Yi et Teresia Kim"),
      "mr:0131-augustinus-pak-chong-won-et-socii": entry(1, 31, "Sancti Augustinus Pak Chŏng-wŏn et socii"),
      "mr:0101-vetus": { ...entry(1, 1, "Sancta Agatha Yi"), deprecated: true },
    };
    const named = (name: string, wikidata: string) => ({ name, where: "text" as const, wikidata });
    const ps: PersonsSnapshot = {
      editions: { martyrologium_romanum_2004: {
        "mr:0920-andreas-kim-tae-gon-et-socii": [named("Andreas Kim Tae-gŏn", "Q1"), named("Agatha Yi", "Q2")],
        "mr:0131-augustinus-pak-chong-won-et-socii": [named("Agatha Yi", "Q2")],
        "mr:0109-agatha-yi-et-teresia-kim": [named("Agatha Yi", "Q2"), named("Teresia Kim", "Q3")],
        "mr:0101-vetus": [named("Agatha Yi", "Q2")],
      } },
      labels: { Q2: { en: "Agatha Yi" } },
    };
    const link = (id: string, own: boolean) => ({ id, month: reg[id].month, day: reg[id].day, subject: reg[id].subject, own });
    expect(entitiesFor(["Q2"], ps, {}, places, reg).Q2).toEqual({
      kind: "person", labels: { en: "Agatha Yi" }, details: null,
      eulogies: [
        link("mr:0109-agatha-yi-et-teresia-kim", true),
        link("mr:0131-augustinus-pak-chong-won-et-socii", false),
        link("mr:0920-andreas-kim-tae-gon-et-socii", false),
      ],
    });
  });
});
