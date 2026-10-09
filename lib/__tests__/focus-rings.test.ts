import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("the reader's found targets", () => {
  it("get their focus ring back once the wash is over, wherever the focus outline is removed", () => {
    const css = readFileSync("components/page.module.css", "utf8");
    const hidden = [...css.matchAll(/^(\.[^{\n]+)\[tabindex="-1"\]:focus \{ outline: none; \}/gm)].map((m) => m[1]);
    expect(hidden.length).toBeGreaterThanOrEqual(3);
    for (const sel of hidden) {
      expect(css, sel).toContain(`${sel}[tabindex="-1"]:focus:not([data-found]) { outline:`);
    }
  });
});
