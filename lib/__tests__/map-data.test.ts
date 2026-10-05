import { describe, it, expect } from "vitest";
import { facetCounts, filterEntries, mapEntries, matchesQuery, typologyLabel, type MapFilters } from "@/lib/map-data";
import type { PlacesSnapshot } from "@/lib/places";
import type { CatalogEntryOut } from "@/lib/types";

const snap: PlacesSnapshot = {
  places: {
    Q220: { label: "Rome", country: "IT", coords: [41.9, 12.5] },
    Q84: { label: "London", country: "GB", coords: [51.5, -0.1] },
    Q1: { label: "Caesarea", country: "TR", coords: [38.7, 35.5] },
  },
  eulogies: {
    "mr:0101-almachius": { place: "Q220", la: "Romæ", typology: "dies_natalis" },
    "mr:0102-caecilia": { place: "Q220", la: "Romæ", typology: "depositio" },
    "mr:0103-thomas": { place: "Q84", la: "Londínii", typology: "dies_natalis" },
    "mr:0104-basilius": { place: "Q1", la: "Cæsaréæ in Cappadócia", typology: null },
  },
};

const cat = (id: string, subject: string, day: string, entry: number | null = 1, present = true): CatalogEntryOut => ({
  id, subject, anchor_day: day, deprecated: false, present, day_printed: day, entry,
});

const catalog: CatalogEntryOut[] = [
  cat("mr:0103-thomas", "Sanctus Thomas", "01-03"),
  cat("mr:0101-almachius", "Sanctus Almachius", "01-01", 4),
  cat("mr:0102-caecilia", "Sancta Cæcilia", "01-02"),
  cat("mr:0104-basilius", "Sanctus Basilius", "01-04"),
  cat("mr:0105-absent", "Sanctus Absens", "01-05", 1, false),
  cat("mr:0106-martina", "Sancta Martina", "01-06"), // printed, but no place (deprecated ID)
];

const all: MapFilters = { query: "", hiddenTypologies: new Set(), countries: new Set() };

describe("mapEntries", () => {
  it("keeps the eulogies the edition prints that have a place, in printed order, and counts the rest", () => {
    const { entries, unmapped } = mapEntries(catalog, snap);
    expect(entries.map((e) => e.id)).toEqual(["mr:0101-almachius", "mr:0102-caecilia", "mr:0103-thomas", "mr:0104-basilius"]);
    expect(unmapped).toBe(1); // mr:0106-martina; mr:0105-absent is not printed at all
    expect(entries[0]).toEqual({
      id: "mr:0101-almachius", subject: "Sanctus Almachius", day: { mm: 1, dd: 1 }, entry: 4,
      qid: "Q220", la: "Romæ", label: "Rome", country: "IT", coords: [41.9, 12.5], typology: "dies_natalis",
    });
  });

  it("a catalog entry without subject falls back to its ID", () => {
    const { entries } = mapEntries([{ ...catalog[0], subject: null }], snap);
    expect(entries[0].subject).toBe("mr:0103-thomas");
  });
});

describe("matchesQuery", () => {
  const { entries } = mapEntries(catalog, snap);
  const byId = (id: string) => entries.find((e) => e.id === id)!;

  it("matches subject and ID, ignoring case, accents and the æ/œ ligatures", () => {
    expect(matchesQuery(byId("mr:0102-caecilia"), "caecilia")).toBe(true);
    expect(matchesQuery(byId("mr:0102-caecilia"), "CÆCILIA")).toBe(true);
    expect(matchesQuery(byId("mr:0103-thomas"), "0103-tho")).toBe(true);
    expect(matchesQuery(byId("mr:0103-thomas"), "caecilia")).toBe(false);
  });

  it("matches the place as printed and its Wikidata label", () => {
    expect(matchesQuery(byId("mr:0104-basilius"), "cesarea")).toBe(false); // e ≠ ae
    expect(matchesQuery(byId("mr:0104-basilius"), "caesarea")).toBe(true);
    expect(matchesQuery(byId("mr:0103-thomas"), "london")).toBe(true);
  });

  it("finds a place printed with an accented ligature (ǽ)", () => {
    const nicaea = { ...byId("mr:0104-basilius"), la: "Nicǽæ in Bithýnia" };
    expect(matchesQuery(nicaea, "nicaeae")).toBe(true);
  });

  it("an empty or blank query matches everything", () => {
    expect(matchesQuery(byId("mr:0103-thomas"), "  ")).toBe(true);
  });
});

describe("filterEntries and facetCounts", () => {
  const { entries } = mapEntries(catalog, snap);

  it("hides unchecked typologies (null typology is 'none') and keeps only the chosen countries", () => {
    expect(filterEntries(entries, { ...all, hiddenTypologies: new Set(["dies_natalis"]) }).map((e) => e.id))
      .toEqual(["mr:0102-caecilia", "mr:0104-basilius"]);
    expect(filterEntries(entries, { ...all, hiddenTypologies: new Set(["none"]) }).map((e) => e.id))
      .not.toContain("mr:0104-basilius");
    expect(filterEntries(entries, { ...all, countries: new Set(["IT", "GB"]) }).map((e) => e.id))
      .toEqual(["mr:0101-almachius", "mr:0102-caecilia", "mr:0103-thomas"]);
  });

  it("counts each facet under the other filters, not its own", () => {
    const f: MapFilters = { query: "", hiddenTypologies: new Set(["depositio"]), countries: new Set(["IT"]) };
    const { typologies, countries } = facetCounts(entries, f);
    // typologies: filtered by country IT only → almachius (dies_natalis), caecilia (depositio)
    expect(typologies).toEqual([["dies_natalis", 1], ["depositio", 1]]);
    // countries: filtered by typology (depositio hidden) only → almachius IT, thomas GB, basilius TR
    expect(countries).toEqual([["GB", 1], ["IT", 1], ["TR", 1]]);
  });

  it("typologies are listed in the crmedr order, with 'none' last", () => {
    const { typologies } = facetCounts(entries, all);
    expect(typologies.map(([t]) => t)).toEqual(["dies_natalis", "depositio", "none"]);
  });
});

describe("typologyLabel", () => {
  it("reads the value as words", () => {
    expect(typologyLabel("dies_natalis")).toBe("Dies natalis");
    expect(typologyLabel(null)).toBe("Not classified");
  });
});
