import { describe, it, expect } from "vitest";
import { entitiesFor, MAX_IDS, parseIds } from "@/lib/entities";
import type { PersonDetails } from "@/lib/entities";
import type { PersonsSnapshot } from "@/lib/persons";
import type { PlacesSnapshot } from "@/lib/places";

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
    expect(entitiesFor(["Q220", "Q19546", "Q7", "Q404"], persons, details, places)).toEqual({
      Q220: { kind: "place", labels: { en: "Rome", it: "Roma" }, label: "Rome", country: "IT", coords: [41.9, 12.5] },
      Q19546: { kind: "person", labels: { en: "Basil of Caesarea", it: "Basilio di Cesarea" }, details: basil },
      Q7: { kind: "person", labels: { en: "Seven" }, details: null },
    });
  });
});
