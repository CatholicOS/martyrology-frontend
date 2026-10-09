import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("the links to the index of names", () => {
  it("read the small editions list, never the persons snapshot", () => {
    for (const f of ["components/ReaderBar.tsx", "components/ApparatusPage.tsx", "lib/persons-editions.ts"]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/persons-snapshot|@\/lib\/persons"/);
    }
  });
});

describe("the editions list", () => {
  it("names exactly the editions the persons snapshot has", async () => {
    const editions = (await import("@/data/persons-editions.json")).default;
    const snap = (await import("@/data/persons-snapshot.json")).default as { editions: Record<string, unknown> };
    expect([...editions].sort()).toEqual(Object.keys(snap.editions).sort());
  });
});
