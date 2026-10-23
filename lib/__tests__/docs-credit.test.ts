// @vitest-environment node
import fs from "node:fs";
import { describe, it, expect } from "vitest";

// The icon is drawn from a CC BY-SA 2.0 photograph (design/icon/README.md): every language's "Data and sources" credits it.
describe("icon credit", () => {
  it("every language credits the icon photograph", () => {
    for (const lang of ["en", "it", "fr", "de", "es", "pt"]) {
      const page = fs.readFileSync(`content/docs/${lang}/data.mdx`, "utf8");
      for (const needle of ["Carole Raddato", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0/", "flickr.com/photos/carolemage/32143459745"])
        expect([lang, needle, page.includes(needle)]).toEqual([lang, needle, true]);
    }
  });
});
