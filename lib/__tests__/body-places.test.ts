import { describe, it, expect } from "vitest";
import { PLACE_ROLES, printings, printingSpan } from "@/lib/body-places";

describe("body places", () => {
  it("lists the thirteen roles", () => {
    expect(PLACE_ROLES).toHaveLength(13);
    expect(PLACE_ROLES[0]).toBe("death");
    expect(PLACE_ROLES).toContain("religious_life");
  });

  it("finds exact, non-overlapping printings", () => {
    expect(printings("Romæ natus, Romæ sepultus", "Romæ")).toEqual([0, 12]);
    expect(printings("aaaa", "aa")).toEqual([0, 2]);
    expect(printings("Romæ", "")).toEqual([]);
  });

  it("gives the nth printing's span", () => {
    expect(printingSpan("Romæ natus, Romæ sepultus", "Romæ", 2)).toEqual({ start: 12, end: 16 });
    expect(printingSpan("Romæ natus", "Romæ")).toEqual({ start: 0, end: 4 });
    expect(printingSpan("Romæ natus", "Romæ", 2)).toBeNull();
    expect(printingSpan("Romæ natus", "Parisiis")).toBeNull();
  });
});
