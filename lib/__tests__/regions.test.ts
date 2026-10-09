import { describe, it, expect } from "vitest";
import { regionName } from "@/lib/regions";

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
