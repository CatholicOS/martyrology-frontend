import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { LOCALES } from "@/i18n/routing";

type Tree = { [k: string]: string | Tree };
const load = (l: string): Tree => JSON.parse(readFileSync(join(process.cwd(), "messages", `${l}.json`), "utf8"));
function flat(t: Tree, p = ""): Record<string, string> {
  return Object.entries(t).reduce<Record<string, string>>((o, [k, v]) =>
    typeof v === "string" ? { ...o, [p + k]: v } : { ...o, ...flat(v, `${p}${k}.`) }, {});
}
/** ICU argument names: "{count, plural, …}", "{year}" → count, year. */
const args = (m: string) => [...new Set([...m.matchAll(/\{\s*(\w+)\s*[,}]/g)].map((x) => x[1]))].sort();

const en = flat(load("en"));

describe("messages", () => {
  for (const l of LOCALES.filter((x) => x !== "en")) {
    const other = flat(load(l));
    it(`${l} has exactly the English keys`, () => expect(Object.keys(other).sort()).toEqual(Object.keys(en).sort()));
    it(`${l} keeps every ICU argument`, () => {
      for (const k of Object.keys(en)) expect([k, args(other[k] ?? "")]).toEqual([k, args(en[k])]);
    });
  }
});

/**
 * Messages that are rightly the same as the English in a language, by key. Keep it short: a term that
 * is the same word (API, ID, ISBN), a Latin term the site keeps in Latin, or a code-like format.
 */
const ALL = ["it", "fr", "de", "es", "pt"] as const;
const SAME_AS_ENGLISH: Record<string, readonly string[]> = {
  // Formats made only of arguments and punctuation, or of names: "{title} — {book}", "API v{version}".
  "Metadata.titleWithBook": ALL, "Bookshelf.editionName": ALL, "Bookshelf.bookName": ALL,
  "Bookshelf.natureYear": ALL, "Bookshelf.yearAndLanguage": ALL, "Footer.apiVersion": ALL, "Footer.crmedrCommit": ALL,
  // "2 gennaio", "2 janvier": the day before the month, as in English.
  "Metadata.dayTitle": ["it", "fr"],
  // Abbreviations and code-like values: API, ISBN, ID, a QID placeholder, field names in aria labels.
  "Header.api": ALL, "Bookshelf.colophonIsbn": ALL, "Compare.columns.id": ALL, "Map.place.qidPlaceholder": ALL,
  "Review.realign.ariaSplitAt": ALL, "Review.realign.ariaId": ALL, "Reader.ids": ["de", "pt"],
  // Latin names of the kinds of edition, kept in Latin in every language.
  "Bookshelf.nature.editio_typica": ALL, "Bookshelf.nature.editio_typica_altera": ALL,
  "Bookshelf.nature.editio_typica_recognita": ALL,
  // The Martyrology's Praenotanda and Ordo, as the docs cite them: Latin except in Italian (Premesse, Rito).
  "Docs.cite.praenotanda": ["fr", "de", "es", "pt"], "Docs.cite.ordo": ["fr", "de", "es", "pt"],
  // Subjects fall back to English in fr/de/es/pt, so the sample search keeps the English "Rome".
  "Map.searchPlaceholder": ["fr", "de", "es", "pt"],
  // "Errata" is the word in French, German and Portuguese too.
  "Reader.errata": ["fr", "de", "pt"], "Reader.erratumTitle": ["fr", "de", "pt"],
  "Reader.erratumLabel": ["de", "pt"], "Notes.erratum": ["de", "pt"],
  // The same word: Italiano (CEI); "n." for numero; French Source, Note, Latin, Date, Documentation,
  // occurrence(s), "p. {page}, l. {line}"; German Status.
  "Bookshelf.language.it": ["it", "es", "pt"], "Reader.gapEntry": ["it"],
  "Bookshelf.colophonSource": ["fr"], "Bookshelf.colophonNote": ["fr"], "Bookshelf.language.la": ["fr"],
  "Bookshelf.languageName.la": ["fr"], "Reader.placePageLine": ["fr"], "Reader.placePage": ["fr"],
  "Map.place.occurrences": ["fr"], "Review.realign.note": ["fr"], "Review.attach.note": ["fr"],
  "Review.margin.kind.note": ["fr"], "Docs.index.title": ["fr"], "Docs.finder.date": ["fr"],
  "Compare.columns.status": ["de", "pt"], // Brazilian Portuguese says "Status"
};

describe("messages are translated", () => {
  for (const l of LOCALES.filter((x) => x !== "en")) {
    it(`${l} translates every message`, () => {
      const other = flat(load(l));
      const same = Object.keys(en).filter((k) => other[k] === en[k] && !(SAME_AS_ENGLISH[k] ?? []).includes(l));
      expect(same).toEqual([]);
    });
  }
});

describe("Scalar's Italian", () => {
  it("uses only key paths of Scalar's English interface", async () => {
    // Not in the package's exports, so imported by its file path.
    const en_js = join(process.cwd(), "node_modules/@scalar/api-reference/dist/features/localization/locales/en.js");
    const m = await import(/* @vite-ignore */ pathToFileURL(en_js).href);
    const scalarEn = Object.values(m)[0] as Tree;
    const it_ = JSON.parse(readFileSync(join(process.cwd(), "messages", "scalar", "it.json"), "utf8")) as Tree;
    const enPaths = flat(scalarEn);
    const unknown = Object.keys(flat(it_)).filter((k) => typeof enPaths[k] !== "string");
    expect(unknown).toEqual([]);
  });
});
