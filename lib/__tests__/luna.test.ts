import { describe, expect, it } from "vitest";
import { ageWords, printedRows, splitLuna, validYear } from "@/lib/luna";
import type { LunaColumn } from "@/lib/types";

describe("luna", () => {
  it("splits the heading at its last bare Luna", () => {
    expect(splitLuna("Pridie Nonas Augusti. Luna.")).toEqual({ before: "Pridie Nonas Augusti. ", after: "" });
    expect(splitLuna("Kalendis Ianuarij. Luna")).toEqual({ before: "Kalendis Ianuarij. ", after: "" });
    expect(splitLuna("The Fourth Day of August")).toBeNull();
    expect(splitLuna("Lunae festum. Luna.")?.before).toBe("Lunae festum. ");
  });

  it("drops Luna from the announcement", () => {
    expect(ageWords("Luna vigesima prima")).toBe("vigesima prima");
  });

  it("lays the table out in the print's two rows", () => {
    const tabula: LunaColumn[] = Array.from({ length: 31 }, (_, i) => ({ letter: `x${i}`, epact: "j", age: i + 1, printed: null }));
    const [one, two] = printedRows(tabula);
    expect(one).toHaveLength(17);
    expect(two).toHaveLength(14);
    expect(two[0]).toEqual({ column: 17, cell: tabula[17] });
  });

  it("accepts a year the API takes", () => {
    expect(validYear("2026")).toBe(2026);
    expect(validYear("0")).toBeNull();
    expect(validYear("20.5")).toBeNull();
    expect(validYear("")).toBeNull();
  });
});
