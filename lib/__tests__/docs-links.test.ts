import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DOC_CONTENT_LANGS, DOC_PAGES, headingId } from "@/lib/docs";

const root = join(process.cwd(), "content", "docs");
const slugs = new Set<string>(DOC_PAGES.map((p) => p.slug));

/** The anchors of a docs file: the headingId of each ## and ### heading. */
function anchors(lang: string, file: string): Set<string> {
  const text = readFileSync(join(root, lang, `${file}.mdx`), "utf8");
  return new Set([...text.matchAll(/^#{2,3}\s+(.+?)\s*$/gm)].map((m) => headingId(m[1].replace(/[*_`]/g, ""))));
}

describe("the docs' internal links", () => {
  for (const lang of DOC_CONTENT_LANGS) {
    const files = readdirSync(join(root, lang)).filter((f) => f.endsWith(".mdx")).map((f) => f.slice(0, -4));
    for (const file of files) {
      const text = readFileSync(join(root, lang, `${file}.mdx`), "utf8");
      it(`${lang}/${file}: every docs link is locale-less and every anchor is a heading of ${lang}`, () => {
        const bad: string[] = [];
        for (const [, path] of text.matchAll(/\]\((\/[^)\s]*)\)/g)) {
          if (/^\/(en|it|fr|de|es|pt)(\/|$)/.test(path)) bad.push(`${path}: carries a locale`);
          const m = /^\/docs(?:\/([^/#]+))?(?:#(.+))?$/.exec(path);
          if (!path.startsWith("/docs")) continue;
          if (!m) { bad.push(`${path}: not a docs page`); continue; }
          const [, slug, hash] = m;
          if (slug && !slugs.has(slug)) { bad.push(`${path}: no such page`); continue; }
          if (hash && !anchors(lang, slug ?? "index").has(hash)) bad.push(`${path}: no such heading`);
        }
        for (const [, hash] of text.matchAll(/\]\(#([^)\s]+)\)/g))
          if (!anchors(lang, file).has(hash)) bad.push(`#${hash}: no such heading`);
        expect(bad).toEqual([]);
      });
    }
  }
});
