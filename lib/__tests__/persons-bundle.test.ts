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
