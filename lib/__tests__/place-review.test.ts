import { describe, it, expect } from "vitest";
import { countryCodes, placeCountryFor, placeDefaultQid, placeJevBlock, placeJevRecord } from "@/lib/place-review";
import type { PlaceCandidate, PlaceJev, ResolvePlaceOp } from "@/lib/changeset";

const cand = (wikidata: string, country: string | null): PlaceCandidate => ({
  wikidata,
  label: wikidata,
  description: "",
  country,
  countries: country ? [country] : [],
  la: [],
  p9314: false,
  coords: [0, 0],
  types: [],
  evidence: [],
});

const jev = (extra: Partial<PlaceJev>): PlaceJev => ({ kind: "place", probability: 0.9, confidence: 0.9, model: "jev", ...extra });

const op = (extra: Partial<ResolvePlaceOp> = {}): ResolvePlaceOp =>
  ({
    op: "resolve_place",
    id: "x",
    la: "x",
    it: [],
    occurrences: [],
    claims: [],
    failed: [],
    candidates: [cand("Q1", "AT"), cand("Q2", "FR"), cand("Q3", null)],
    suggested: { wikidata: "Q1", country: "AT" },
    ...extra,
  }) as ResolvePlaceOp;

describe("placeDefaultQid", () => {
  it("is the suggestion, else the first candidate", () => {
    expect(placeDefaultQid(op())).toBe("Q1");
    expect(placeDefaultQid(op({ suggested: null, candidates: [cand("Q2", "FR")] }))).toBe("Q2");
    expect(placeDefaultQid(op({ suggested: null, candidates: [] }))).toBe("");
  });
});

describe("placeCountryFor and countryCodes", () => {
  it("a candidate in several countries starts with them; one with none starts empty", () => {
    const op = { candidates: [{ ...cand("Q165111", null), countries: ["NL", "DE"] }, cand("Q9", null)] } as unknown as ResolvePlaceOp;
    expect(placeCountryFor(op, "Q165111")).toBe("NL, DE");
    expect(placeCountryFor(op, "Q9")).toBe("");
  });
  it("keeps only ISO codes, once each, from Wikidata's list", () => {
    const op = { candidates: [{ ...cand("Q39760", null), countries: ["PS", "Q42620"] }, { ...cand("Q123559", null), countries: ["Q8575586", "ES", "PT", "ES"] }] } as unknown as ResolvePlaceOp;
    expect(placeCountryFor(op, "Q39760")).toBe("PS");
    expect(placeCountryFor(op, "Q123559")).toBe("ES, PT");
  });
  it("a suggestion in several countries starts with them", () => {
    const op = { suggested: { wikidata: "Q1218", countries: ["IL", "PS"] }, candidates: [cand("Q1218", null)] } as unknown as ResolvePlaceOp;
    expect(placeCountryFor(op, "Q1218")).toBe("IL, PS");
  });
  it("splits the field on commas and spaces, upper-cased", () => {
    expect(countryCodes(" nl, DE  at ")).toEqual(["NL", "DE", "AT"]);
    expect(countryCodes("")).toEqual([]);
  });
});

describe("placeJevRecord", () => {
  it("accepts when the pick is the default and its country is the default's", () => {
    expect(placeJevRecord(op({ jev: jev({ decision: "accept", wikidata: "Q1", country: "AT" }) }))).toEqual({ decision: "accept" });
  });
  it("edits when the default's country differs from Jev's", () => {
    expect(placeJevRecord(op({ jev: jev({ decision: "accept", wikidata: "Q1", country: "DE" }) }))).toEqual({
      decision: "edit",
      edited: { wikidata: "Q1", country: "DE" },
    });
  });
  it("edits to another candidate with its country", () => {
    expect(placeJevRecord(op({ jev: jev({ decision: "edit", wikidata: "Q2", country: "FR" }) }))).toEqual({
      decision: "edit",
      edited: { wikidata: "Q2", country: "FR" },
    });
  });
  it("is null for a pick without a country or outside the candidates", () => {
    expect(placeJevRecord(op({ jev: jev({ decision: "edit", wikidata: "Q3" }) }))).toBeNull();
    expect(placeJevRecord(op({ jev: jev({ decision: "edit", wikidata: "Q9", country: "FR" }) }))).toBeNull();
  });
  it("rejects with its reason, null without one", () => {
    expect(placeJevRecord(op({ jev: jev({ decision: "reject", reason: "Jev: not a place" }) }))).toEqual({
      decision: "reject",
      edited: { reason: "Jev: not a place" },
    });
    expect(placeJevRecord(op({ jev: jev({ decision: "reject" }) }))).toBeNull();
  });
  it("is null without a decision or without jev", () => {
    expect(placeJevRecord(op({ jev: jev({}) }))).toBeNull();
    expect(placeJevRecord(op())).toBeNull();
  });
});

describe("Jev's pick of an item in several countries", () => {
  it("takes the card's countries for it, even when Jev carries one or none", () => {
    const op = {
      suggested: { wikidata: "Q104028", countries: ["IL", "PS"] },
      candidates: [cand("Q104028", "IL")],
      jev: { decision: "accept", wikidata: "Q104028", country: "IL", kind: "place", probability: 0.6, confidence: 0.6, model: "m" },
    } as unknown as ResolvePlaceOp;
    expect(placeJevRecord(op)).toEqual({ decision: "edit", edited: { wikidata: "Q104028", countries: ["IL", "PS"] } });
    const none = { ...op, jev: { ...op.jev!, country: undefined } } as ResolvePlaceOp;
    expect(placeJevBlock(none)).toBeNull();
    expect(placeJevRecord(none)).toEqual({ decision: "edit", edited: { wikidata: "Q104028", countries: ["IL", "PS"] } });
  });
});

describe("placeJevBlock", () => {
  it("names why the suggestion cannot be taken", () => {
    expect(placeJevBlock(op({ jev: jev({ decision: "edit", wikidata: "Q9", country: "FR" }) }))).toBe("not_listed");
    expect(placeJevBlock(op({ jev: jev({ decision: "edit", wikidata: "X1", country: "FR" }) }))).toBe("not_listed");
    expect(placeJevBlock(op({ jev: jev({ decision: "edit", wikidata: "Q3" }) }))).toBe("no_country");
    expect(placeJevBlock(op({ jev: jev({ decision: "reject" }) }))).toBe("no_reason");
  });
  it("is null when it can be taken, or when there is nothing to take", () => {
    expect(placeJevBlock(op({ jev: jev({ decision: "edit", wikidata: "Q2", country: "FR" }) }))).toBeNull();
    expect(placeJevBlock(op({ jev: jev({ decision: "reject", reason: "Jev: not a place" }) }))).toBeNull();
    expect(placeJevBlock(op({ jev: jev({}) }))).toBeNull();
  });
  it("refuses a country that is not an ISO code, as the card's accept does", () => {
    expect(placeJevBlock(op({ jev: jev({ decision: "edit", wikidata: "Q2", country: "France" }) }))).toBe("no_country");
    expect(placeJevRecord(op({ jev: jev({ decision: "edit", wikidata: "Q2", country: "fr" }) }))).toBeNull();
  });
});
