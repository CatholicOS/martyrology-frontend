import { describe, it, expect } from "vitest";
import { NO_RETURN, parseReturn, readerHref, returnQuery } from "@/lib/reader-return";

const ED = "martyrologium_romanum_1749";
const EN = "martyrologium_romanum_1914_en_unofficial";

describe("the reader's way back from a view", () => {
  it("carries the day and the comparison in the query, after any other parameter", () => {
    expect(returnQuery(NO_RETURN)).toBe("");
    expect(returnQuery({ day: { mm: 1, dd: 5 }, with: null })).toBe("?day=01-05");
    expect(returnQuery({ day: { mm: 10, dd: 2 }, with: EN })).toBe(`?day=10-02&with=${EN}`);
    expect(returnQuery({ day: { mm: 10, dd: 2 }, with: EN }, { role: "birth" })).toBe(`?role=birth&day=10-02&with=${EN}`);
    expect(returnQuery(NO_RETURN, { role: null })).toBe("");
  });

  it("reads back what it carried, and drops what is not a single valid day or another edition", () => {
    expect(parseReturn({ day: "10-02", with: EN }, ED)).toEqual({ day: { mm: 10, dd: 2 }, with: EN });
    expect(parseReturn(undefined, ED)).toEqual(NO_RETURN);
    expect(parseReturn({ day: "02-30" }, ED).day).toBeNull();
    expect(parseReturn({ day: "2-3" }, ED).day).toBeNull();
    expect(parseReturn({ day: ["10-02", "10-03"] }, ED).day).toBeNull();
    expect(parseReturn({ with: ED }, ED).with).toBeNull();
    expect(parseReturn({ with: "" }, ED).with).toBeNull();
    expect(parseReturn({ with: [EN, EN] }, ED).with).toBeNull();
  });

  it("leads back to the day left, with its comparison; with no day, to today's page, keeping the comparison", () => {
    expect(readerHref(ED, { day: { mm: 10, dd: 2 }, with: EN })).toBe(`/read/${ED}/10/02?with=${EN}`);
    expect(readerHref(ED, { day: { mm: 10, dd: 2 }, with: null })).toBe(`/read/${ED}/10/02`);
    expect(readerHref(ED, NO_RETURN)).toBe(`/read/${ED}`);
    expect(readerHref(ED, { day: null, with: EN })).toBe(`/read/${ED}?with=${EN}`);
  });
});
