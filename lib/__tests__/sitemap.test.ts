import { describe, it, expect, vi, beforeEach } from "vitest";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const { listMock, catalogMock } = vi.hoisted(() => ({ listMock: vi.fn(), catalogMock: vi.fn() }));
vi.mock("@/lib/server-editions", () => ({ listEditions: listMock, fetchCatalog: catalogMock }));
vi.mock("@/lib/persons-editions", () => ({ hasPersons: (e: string) => e === "martyrologium_romanum_2004" }));
vi.mock("@/lib/persons", () => ({
  getPersons: () => ({ editions: { martyrologium_romanum_2004: {
    "mr:0101-basilius": [{ name: "Basilius", where: "text", wikidata: "Q1" }] } }, labels: {} }),
}));
vi.mock("@/lib/places", () => ({
  getPlaces: () => ({
    places: { Q220: { label: "Rome", labels: { it: "Roma", de: "Rom" }, country: "IT", coords: null } },
    eulogies: { "mr:0101-basilius": { place: "Q220", la: "Romae", typology: "death" } },
  }),
}));

import { SITEMAP_ROUTES, localePaths, localeSitemap, sitemapData, sitemapIndex } from "@/lib/sitemap";
import { GET } from "@/app/sitemap/[file]/route";
import { GET as getIndex } from "@/app/sitemap.xml/route";
import robots from "@/app/robots";

const APP = join(process.cwd(), "app", "[locale]");

/** Every page route under app/[locale], as SITEMAP_ROUTES names it: "/", "/docs/[page]", … */
function pageRoutes(dir = APP): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    if (d.isDirectory()) return pageRoutes(join(dir, d.name));
    if (!/^page\.(tsx|ts|jsx|js|mdx)$/.test(d.name)) return [];
    const route = relative(APP, dir).split(sep).filter((s) => !/^\(.*\)$/.test(s)).join("/");
    return [`/${route}`];
  });
}

/** The pages a sitemap lists, by their <loc>. */
const locs = (xml: string) => [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const urlsOf = async (file: string) => locs(await (await GET(new Request("http://x"), { params: Promise.resolve({ file }) })).text());
/** One page's hreflang alternates in a sitemap, language → URL. */
const alternates = (xml: string, loc: string) => {
  const url = xml.split("</url>").find((u) => u.includes(`<loc>${loc}</loc>`)) ?? "";
  return Object.fromEntries([...url.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]));
};

const edition = (id: string, status = "public", locale = "la") => ({ edition_id: id, year: 2004, locale, availability: { status } });
const CATALOG = [{ id: "mr:0101-basilius", subject: "Sanctus Basilius", anchor_day: "01-01", deprecated: false, present: true, day_printed: "01-01", entry: 1 }];

describe("sitemap", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_URL", "https://example.org/");
    vi.stubEnv("SITE_URL", "");
    listMock.mockReset().mockResolvedValue([
      edition("martyrologium_romanum_2004"),
      edition("martyrologium_romanum_1914_en_unofficial", "public", "en"),
      edition("martyrologium_romanum_1584", "unavailable"),
    ]);
    catalogMock.mockReset().mockResolvedValue(CATALOG);
  });

  it("has an entry for every page route under app/[locale], and none for a route that is gone", () => {
    expect(Object.keys(SITEMAP_ROUTES).sort()).toEqual(pageRoutes().sort());
  });

  it("serves an index naming one sitemap per language, and each of them", async () => {
    const index = await getIndex().text();
    expect(index).toBe(sitemapIndex());
    expect(index).toContain("<sitemapindex");
    for (const l of ["en", "it", "fr", "de", "es", "pt"]) {
      expect(index).toContain(`<loc>https://example.org/sitemap/${l}.xml</loc>`);
      expect(await urlsOf(`${l}.xml`)).toContain(`https://example.org/${l}/docs`);
    }
  });

  it("404s a sitemap for a language the site does not have", async () => {
    for (const file of ["la.xml", "en", "en.txt"]) {
      expect((await GET(new Request("http://x"), { params: Promise.resolve({ file }) })).status).toBe(404);
    }
  });

  it("lists the public pages of a language, every day of every readable edition, and the indexes' letters", async () => {
    const urls = await urlsOf("it.xml");
    expect(urls).toContain("https://example.org/it");
    expect(urls).toContain("https://example.org/it/docs");
    expect(urls).toContain("https://example.org/it/docs/lunar-table");
    expect(urls).toContain("https://example.org/it/map");
    expect(urls).toContain("https://example.org/it/read/martyrologium_romanum_2004/02/29");
    expect(urls).toContain("https://example.org/it/read/martyrologium_romanum_1914_en_unofficial/12/31");
    expect(urls).toContain("https://example.org/it/read/martyrologium_romanum_2004/notes");
    expect(urls).toContain("https://example.org/it/read/martyrologium_romanum_2004/names/b");
    expect(urls).toContain("https://example.org/it/read/martyrologium_romanum_2004/places/r");
    // The index of names only for an edition crmedr has persons for.
    expect(urls).not.toContain("https://example.org/it/read/martyrologium_romanum_1914_en_unofficial/names");
    // No unavailable edition, curator page or redirect.
    expect(urls.some((u) => u.includes("1584"))).toBe(false);
    expect(urls.some((u) => /\/(compare|review)$/.test(u))).toBe(false);
    expect(urls).not.toContain("https://example.org/it/read/martyrologium_romanum_2004");
    expect(urls.filter((u) => u.includes("/read/martyrologium_romanum_2004/") && /\/\d{2}\/\d{2}$/.test(u))).toHaveLength(366);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("gives each page its alternates in every language that has it, and the locale-less URL as x-default when all have it", async () => {
    const data = await sitemapData();
    const all = localePaths(data);
    expect(alternates(localeSitemap("en", all), "https://example.org/en")).toEqual({
      en: "https://example.org/en", it: "https://example.org/it", fr: "https://example.org/fr",
      de: "https://example.org/de", es: "https://example.org/es", pt: "https://example.org/pt", "x-default": "https://example.org",
    });
    // A page only some languages have (a letter only their labels file under) names just those, and no
    // x-default: the locale-less URL would send a reader of another language to a 404.
    const de = localeSitemap("de", new Map([...all, ["de", [...all.get("de")!, "/de-fr"]], ["fr", [...all.get("fr")!, "/de-fr"]]]));
    expect(alternates(de, "https://example.org/de/de-fr")).toEqual({ de: "https://example.org/de/de-fr", fr: "https://example.org/fr/de-fr" });
  });

  it("leaves out the letters of an edition whose catalog the API cannot give, but not its other pages", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    catalogMock.mockRejectedValue(new Error("down"));
    const urls = await urlsOf("en.xml");
    expect(urls).toContain("https://example.org/en/read/martyrologium_romanum_2004/places");
    expect(urls.some((u) => /\/places\/[^/]+$/.test(u))).toBe(false);
  });

  it("still lists the site's own pages when the API cannot be asked", async () => {
    listMock.mockResolvedValue(null);
    const urls = await urlsOf("fr.xml");
    expect(urls).toContain("https://example.org/fr/docs");
    expect(urls.some((u) => u.includes("/read/"))).toBe(false);
  });

  it("escapes what XML reserves", () => {
    vi.stubEnv("AUTH_URL", "https://example.org/?a=1&b=2");
    expect(sitemapIndex()).toContain("?a=1&amp;b=2/sitemap/en.xml");
  });

  it("points robots.txt at the index, and keeps crawlers out of the auth endpoints only", () => {
    expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/", disallow: "/api/auth/" }, sitemap: "https://example.org/sitemap.xml" });
  });
});
