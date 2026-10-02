import { describe, it, expect } from "vitest";
import { isCurator } from "@/lib/roles";

describe("isCurator", () => {
  it("accepts Zitadel's roles object holding admin or martyrology_editor", () => {
    expect(isCurator({ admin: { "1": "martyrology.localhost" } })).toBe(true);
    expect(isCurator({ martyrology_editor: { "1": "x" }, developer: {} })).toBe(true);
  });

  it("rejects other roles and missing or malformed claims", () => {
    for (const claim of [undefined, null, "admin", ["admin"], 42, {}, { developer: {} }]) {
      expect(isCurator(claim)).toBe(false);
    }
  });
});
