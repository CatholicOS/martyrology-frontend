import { describe, it, expect } from "vitest";
import { placeCountries, regionName, regionNames } from "@/lib/regions";

describe("regionName", () => {
  it("names a country in the locale", () => {
    expect(regionName("it", "TR")).toBe("Turchia");
    expect(regionName("en", "TR")).toBe("Türkiye");
  });
  it("is undefined for an empty code", () => {
    expect(regionName("en", "")).toBeUndefined();
  });
  it("is undefined, not thrown, for an invalid code", () => {
    expect(regionName("en", "not a region")).toBeUndefined();
  });
});

describe("regionNames and placeCountries", () => {
  it("lists several countries in the locale", () => {
    expect(regionNames("en", ["NL", "DE"])).toBe("Netherlands and Germany");
    expect(regionNames("it", ["NL", "DE"])).toBe("Paesi Bassi e Germania");
    expect(regionNames("en", [])).toBeUndefined();
  });
  it("a place's countries: one, several, or none", () => {
    expect(placeCountries({ country: "IT" })).toEqual(["IT"]);
    expect(placeCountries({ country: "", countries: ["NL", "DE"] })).toEqual(["NL", "DE"]);
    expect(placeCountries({ country: "" })).toEqual([]);
  });
});
