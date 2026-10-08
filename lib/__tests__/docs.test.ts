import { describe, it, expect } from "vitest";
import {
  DOC_LANGS, DOC_PAGES, DOC_PARTS, DOC_INDEX, docHref, findPage, headingId, isDocLang, neighbours, otherLang, slugFromPath,
} from "@/lib/docs";

describe("the docs registry", () => {
  it("lists the ten pages in reading order, Part I then Part II", () => {
    expect(DOC_PAGES.map((p) => p.slug)).toEqual([
      "history", "using", "particular-calendars", "reading-a-day", "lunar-table", "editions", "notes-and-marks",
      "ids", "data", "contributing",
    ]);
    expect(DOC_PAGES.map((p) => p.part)).toEqual([
      "martyrology", "martyrology", "martyrology", "martyrology", "martyrology", "martyrology", "martyrology",
      "project", "project", "project",
    ]);
  });

  it("has unique slugs and a title and description in every language", () => {
    expect(new Set(DOC_PAGES.map((p) => p.slug)).size).toBe(DOC_PAGES.length);
    for (const p of DOC_PAGES)
      for (const l of DOC_LANGS) {
        expect(p.text[l].title.trim()).not.toBe("");
        expect(p.text[l].description.trim()).not.toBe("");
      }
    for (const l of DOC_LANGS) expect(DOC_INDEX[l].title.trim()).not.toBe("");
    expect(DOC_PARTS.map((p) => p.part)).toEqual(["martyrology", "project"]);
  });

  it("recognizes only its languages", () => {
    expect(isDocLang("en")).toBe(true);
    expect(isDocLang("it")).toBe(true);
    expect(isDocLang("la")).toBe(false);
    expect(isDocLang("")).toBe(false);
  });

  it("finds pages by slug", () => {
    expect(findPage("lunar-table")?.part).toBe("martyrology");
    expect(findPage("nope")).toBeUndefined();
  });

  it("builds hrefs for the index and a page", () => {
    expect(docHref("en")).toBe("/docs/en");
    expect(docHref("it", "lunar-table")).toBe("/docs/it/lunar-table");
  });

  it("gives neighbours, open at both ends and across the parts", () => {
    expect(neighbours("history")).toEqual({ prev: undefined, next: findPage("using") });
    expect(neighbours("contributing")).toEqual({ prev: findPage("data"), next: undefined });
    expect(neighbours("notes-and-marks").next?.slug).toBe("ids");
    expect(neighbours("nope")).toEqual({});
  });

  it("switches language", () => {
    expect(otherLang("en")).toBe("it");
    expect(otherLang("it")).toBe("en");
  });

  it("reads the language and page from a pathname", () => {
    expect(slugFromPath("/docs/en")).toEqual({ lang: "en", slug: undefined });
    expect(slugFromPath("/docs/it/")).toEqual({ lang: "it", slug: undefined });
    expect(slugFromPath("/docs/it/lunar-table")).toEqual({ lang: "it", slug: "lunar-table" });
    expect(slugFromPath("/docs/fr/history")).toBeNull();
    expect(slugFromPath("/map")).toBeNull();
  });

  it("makes stable ASCII anchor ids from headings", () => {
    expect(headingId("Asterisks")).toBe("asterisks");
    expect(headingId("Gli asterischi")).toBe("gli-asterischi");
    expect(headingId("Ibidem, Item, Eodem die")).toBe("ibidem-item-eodem-die");
    expect(headingId("Il numero d’oro e l’epatta")).toBe("il-numero-doro-e-lepatta");
    expect(headingId("  Città — 1630  ")).toBe("citta-1630");
  });
});
