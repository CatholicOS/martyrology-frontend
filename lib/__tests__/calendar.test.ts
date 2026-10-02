import { describe, it, expect } from "vitest";
import {
  daysInMonth, parseDay, nextDay, prevDay, todayLocal, pad2, dayPath, monthName, dateHeading,
} from "@/lib/calendar";

describe("calendar", () => {
  it("gives February 29 days and the other months their usual lengths", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(daysInMonth))
      .toEqual([31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
  });

  it("parses two-digit URL parts and rejects anything else", () => {
    expect(parseDay("02", "29")).toEqual({ mm: 2, dd: 29 });
    expect(parseDay("10", "02")).toEqual({ mm: 10, dd: 2 });
    for (const [mm, dd] of [["2", "02"], ["13", "01"], ["00", "10"], ["04", "31"], ["02", "30"], ["ab", "01"], ["01", "00"]]) {
      expect(parseDay(mm, dd)).toBeNull();
    }
  });

  it("turns the page across months and wraps the year both ways", () => {
    expect(nextDay({ mm: 1, dd: 31 })).toEqual({ mm: 2, dd: 1 });
    expect(nextDay({ mm: 2, dd: 28 })).toEqual({ mm: 2, dd: 29 });
    expect(nextDay({ mm: 2, dd: 29 })).toEqual({ mm: 3, dd: 1 });
    expect(nextDay({ mm: 12, dd: 31 })).toEqual({ mm: 1, dd: 1 });
    expect(prevDay({ mm: 3, dd: 1 })).toEqual({ mm: 2, dd: 29 });
    expect(prevDay({ mm: 1, dd: 1 })).toEqual({ mm: 12, dd: 31 });
  });

  it("reads today from the local date", () => {
    expect(todayLocal(new Date(2026, 9, 2, 23, 59))).toEqual({ mm: 10, dd: 2 });
  });

  it("builds reader paths with zero-padded parts", () => {
    expect(pad2(3)).toBe("03");
    expect(dayPath("martyrologium_romanum_1749", { mm: 1, dd: 2 }))
      .toBe("/read/martyrologium_romanum_1749/01/02");
  });

  it("names months and writes date headings in the edition's language", () => {
    expect(monthName(10, "en")).toBe("October");
    expect(dateHeading({ mm: 1, dd: 2 }, "la")).toBe("2 Ianuarii");
    expect(dateHeading({ mm: 10, dd: 2 }, "it")).toBe("2 ottobre");
    expect(dateHeading({ mm: 12, dd: 25 }, "en")).toBe("25 December");
  });
});

describe("dayPath with a second edition", () => {
  it("carries ?with= when given, and nothing otherwise", () => {
    expect(dayPath("martyrologium_romanum_2004", { mm: 10, dd: 4 })).toBe("/read/martyrologium_romanum_2004/10/04");
    expect(dayPath("martyrologium_romanum_2004", { mm: 10, dd: 4 }, null)).toBe("/read/martyrologium_romanum_2004/10/04");
    expect(dayPath("martyrologium_romanum_2004", { mm: 10, dd: 4 }, "martyrologium_romanum_1749")).toBe(
      "/read/martyrologium_romanum_2004/10/04?with=martyrologium_romanum_1749",
    );
  });
});
