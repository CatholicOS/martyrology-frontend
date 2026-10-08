import { describe, it, expect } from "vitest";
import { safeReturnPath } from "@/lib/return-path";

describe("safeReturnPath", () => {
  it("keeps a locale-prefixed path with its query and hash-free", () => {
    expect(safeReturnPath("/it/docs?x=1&y=2", "en")).toBe("/it/docs?x=1&y=2");
    expect(safeReturnPath("/fr", "en")).toBe("/fr");
    expect(safeReturnPath("/de/read/mr:0101-x", "en")).toBe("/de/read/mr:0101-x");
  });
  it.each([
    ["https://evil.example/en/docs"],
    ["//evil.example"],
    ["//en/docs"],
    ["/\\evil.example"],
    ["/map"],
    ["/english/docs"],
    ["/xx/docs"],
    ["en/docs"],
    ["/en/\\evil"],
    ["/en//evil.example"],
    ["javascript:alert(1)"],
    [""],
    [null],
    [undefined],
    [42],
  ])("falls back to /{locale} for %s", (raw) => {
    expect(safeReturnPath(raw, "pt")).toBe("/pt");
  });
});
