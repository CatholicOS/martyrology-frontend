import { describe, it, expect } from "vitest";
import {
  DOC_CONTENT_LANGS, DOC_PAGES, DOC_PARTS, REVIEWED_DOC_LANGS, docContentLang, docHref, findPage, headingId, neighbours, slugFromPath,
} from "@/lib/docs";
import en from "@/messages/en.json";

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

  it("holds only each page's slug and part; the text is in the messages", () => {
    for (const p of DOC_PAGES) expect(Object.keys(p).sort()).toEqual(["part", "slug"]);
    expect(new Set(DOC_PAGES.map((p) => p.slug)).size).toBe(DOC_PAGES.length);
    expect(DOC_PARTS).toEqual(["martyrology", "project"]);
  });

  it("has a title and description in the English messages for every page, part and the index", () => {
    const pages = en.Docs.pages as Record<string, { title: string; description: string }>;
    for (const p of DOC_PAGES) {
      expect(pages[p.slug]?.title?.trim()).toBeTruthy();
      expect(pages[p.slug]?.description?.trim()).toBeTruthy();
    }
    const parts = en.Docs.parts as Record<string, string>;
    for (const part of DOC_PARTS) expect(parts[part]?.trim()).toBeTruthy();
    expect(en.Docs.index.title.trim()).toBeTruthy();
  });

  it("finds pages by slug", () => {
    expect(findPage("lunar-table")?.part).toBe("martyrology");
    expect(findPage("nope")).toBeUndefined();
  });

  it("builds locale-less hrefs for the index and a page", () => {
    expect(docHref()).toBe("/docs");
    expect(docHref("lunar-table")).toBe("/docs/lunar-table");
  });

  it("gives neighbours, open at both ends and across the parts", () => {
    expect(neighbours("history")).toEqual({ prev: undefined, next: findPage("using") });
    expect(neighbours("contributing")).toEqual({ prev: findPage("data"), next: undefined });
    expect(neighbours("notes-and-marks").next?.slug).toBe("ids");
    expect(neighbours("nope")).toEqual({});
  });

  it("reads the page from a locale-less pathname", () => {
    expect(slugFromPath("/docs")).toEqual({ slug: undefined });
    expect(slugFromPath("/docs/")).toEqual({ slug: undefined });
    expect(slugFromPath("/docs/ids")).toEqual({ slug: "ids" });
    expect(slugFromPath("/map")).toBeNull();
    expect(slugFromPath("/docs/ids/more")).toBeNull();
  });

  it("serves each locale its own content, and marks the unreviewed ones as drafts", () => {
    expect(DOC_CONTENT_LANGS).toEqual(["en", "it", "fr", "de", "es", "pt"]);
    expect(REVIEWED_DOC_LANGS).toEqual(["en", "it"]);
    for (const l of DOC_CONTENT_LANGS) expect(docContentLang(l)).toBe(l);
  });

  it("makes stable ASCII anchor ids from headings", () => {
    expect(headingId("Asterisks")).toBe("asterisks");
    expect(headingId("Gli asterischi")).toBe("gli-asterischi");
    expect(headingId("Ibidem, Item, Eodem die")).toBe("ibidem-item-eodem-die");
    expect(headingId("Il numero d’oro e l’epatta")).toBe("il-numero-doro-e-lepatta");
    expect(headingId("  Città — 1630  ")).toBe("citta-1630");
  });

  it("spells out the letters that don't decompose instead of dropping them", () => {
    expect(headingId("Cœlum")).toBe("coelum");
    expect(headingId("Œcumenical")).toBe("oecumenical");
    expect(headingId("Cæsarea")).toBe("caesarea");
    expect(headingId("ÆTERNUS")).toBe("aeternus");
    expect(headingId("Straße")).toBe("strasse");
  });
});
