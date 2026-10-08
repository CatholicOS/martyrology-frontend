import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { DOC_CONTENT_LANGS, DOC_PAGES } from "@/lib/docs";

const root = join(process.cwd(), "content", "docs");
const expected = ["index", ...DOC_PAGES.map((p) => p.slug)].sort();

describe("the docs content", () => {
  for (const lang of DOC_CONTENT_LANGS)
    it(`has exactly one .mdx per registered page in ${lang}`, () => {
      const files = readdirSync(join(root, lang)).filter((f) => f.endsWith(".mdx")).map((f) => f.slice(0, -4)).sort();
      expect(files).toEqual(expected);
    });
});
