import { describe, it, expect } from "vitest";
import { letterFromSlug, letterNeighbours, letterSlug, slugLetter } from "@/lib/letters";

describe("letters in URLs", () => {
  it("are lowercase, with # as other", () => {
    expect(letterSlug("A")).toBe("a");
    expect(letterSlug("#")).toBe("other");
    expect(letterSlug("Ω")).toBe(encodeURIComponent("ω"));
  });

  it("are read back among the letters that exist, whatever their case", () => {
    const letters = ["A", "B", "#"];
    expect(letterFromSlug("b", letters)).toBe("B");
    expect(letterFromSlug("B", letters)).toBe("B");
    expect(letterFromSlug("other", letters)).toBe("#");
    expect(letterFromSlug("z", letters)).toBeNull();
    expect(letterFromSlug(encodeURIComponent("ω"), ["Ω"])).toBe("Ω");
  });

  it("have neighbours among the letters that exist", () => {
    expect(letterNeighbours(["A", "C", "D"], "C")).toEqual({ prev: "A", next: "D" });
    expect(letterNeighbours(["A", "C"], "A")).toEqual({ prev: null, next: "C" });
    expect(letterNeighbours(["A", "C"], "C")).toEqual({ prev: "A", next: null });
  });

  it("are turned back into a letter for a title", () => {
    expect(slugLetter("b")).toBe("B");
    expect(slugLetter("other")).toBe("#");
    expect(slugLetter(letterSlug("Ω"))).toBe("Ω");
  });
});
