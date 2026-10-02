import { describe, it, expect } from "vitest";
import { editionLang, editionTitle, languageLabel, isOriginal, sortForShelf, shelfState, titleCase, shortName, yearAndLanguage } from "@/lib/editions";
import type { EditionOut } from "@/lib/types";

function ed(edition_id: string, year: number, locale: string, nature: string, status = "public"): EditionOut {
  return {
    edition_id, year, locale, nature, book: "martyrologium", scope: {}, promulgation: {},
    governance: { governing_body: "", type: "" }, availability: { status },
  };
}

const E = {
  e1584: ed("martyrologium_romanum_1584", 1584, "la", "editio_typica", "unavailable"),
  e1749: ed("martyrologium_romanum_1749", 1749, "la", "editio_typica_recognita"),
  e1914: ed("martyrologium_romanum_1914", 1914, "la", "editio_typica_recognita", "unavailable"),
  e1914en: ed("martyrologium_romanum_1914_en_unofficial", 1914, "en", "translatio"),
  e2001: ed("martyrologium_romanum_2001", 2001, "la", "editio_typica", "unavailable"),
  e2004: ed("martyrologium_romanum_2004", 2004, "la", "editio_typica_altera", "restricted-texts"),
  e2004en: ed("martyrologium_romanum_2004_en_unofficial", 2004, "en", "translatio", "restricted-texts"),
  e2004it: ed("martyrologium_romanum_2004_it_IT", 2004, "it-IT", "editio_vernacula", "restricted-texts"),
};

describe("editions", () => {
  it("orders the shelf newest first, originals before vernacular before translations", () => {
    expect(sortForShelf(Object.values(E)).map((e) => e.edition_id)).toEqual([
      "martyrologium_romanum_2004", "martyrologium_romanum_2004_it_IT", "martyrologium_romanum_2004_en_unofficial",
      "martyrologium_romanum_2001", "martyrologium_romanum_1914", "martyrologium_romanum_1914_en_unofficial",
      "martyrologium_romanum_1749", "martyrologium_romanum_1584",
    ]);
  });

  it("titles and labels editions by language", () => {
    expect([editionLang(E.e2004), editionLang(E.e2004it), editionLang(E.e2004en)]).toEqual(["la", "it", "en"]);
    expect(editionTitle(E.e1749)).toBe("MARTYROLOGIUM ROMANUM");
    expect(editionTitle(E.e2004it)).toBe("MARTIROLOGIO ROMANO");
    expect(editionTitle(E.e1914en)).toBe("ROMAN MARTYROLOGY");
    expect([languageLabel(E.e1749), languageLabel(E.e2004it), languageLabel(E.e2004en)])
      .toEqual(["Latin", "Italiano (CEI)", "English"]);
    expect(editionLang(ed("x", 2000, "de", "translatio"))).toBe("la");
  });

  it("tells originals from vernacular editions and translations", () => {
    expect([isOriginal(E.e1749), isOriginal(E.e2004it), isOriginal(E.e1914en)]).toEqual([true, false, false]);
  });

  it("derives each book's state from availability and access", () => {
    const access = { martyrologium_romanum_2004: { can_read_texts: true }, martyrologium_romanum_2004_it_IT: { can_read_texts: false },
      martyrologium_romanum_1749: { can_read_texts: true }, martyrologium_romanum_1584: { can_read_texts: true } };
    expect(shelfState(E.e1584, access)).toBe("unavailable");
    expect(shelfState(E.e1749, access)).toBe("open");
    expect(shelfState(E.e2004, access)).toBe("open");
    expect(shelfState(E.e2004it, access)).toBe("locked");
    expect(shelfState(E.e2004en, access)).toBe("locked"); // absent from the map
  });

  it("opens every available book when access could not be loaded", () => {
    expect(shelfState(E.e2004it, null)).toBe("open");
    expect(shelfState(E.e2001, null)).toBe("unavailable");
  });

  it("title-cases cover titles", () => {
    expect(titleCase("MARTIROLOGIO ROMANO")).toBe("Martirologio Romano");
    expect(titleCase("ROMAN MARTYROLOGY")).toBe("Roman Martyrology");
  });
});

describe("note names", () => {
  it("names an edition by year, or by year and language when both share it", () => {
    expect(shortName(E.e1749, E.e2004)).toBe("1749");
    expect(shortName(E.e2004it, E.e2004)).toBe("2004 Italian");
    expect(shortName(E.e2004, E.e2004it)).toBe("2004 Latin");
  });

  it("gives year and language for notices", () => {
    expect(yearAndLanguage(E.e1914en)).toBe("1914 English");
  });
});
