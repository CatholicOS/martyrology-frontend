import { LOCALES, type Locale } from "@/i18n/routing";
import { dayPath, daysInMonth } from "@/lib/calendar";
import { DOC_PAGES, docHref } from "@/lib/docs";
import { editionLang } from "@/lib/editions";
import { letterSlug } from "@/lib/letters";
import { namesIndex } from "@/lib/names-index";
import { getPersons } from "@/lib/persons";
import { hasPersons } from "@/lib/persons-editions";
import { getPlaces } from "@/lib/places";
import { placesIndex } from "@/lib/places-index";
import { fetchCatalog, listEditions } from "@/lib/server-editions";
import type { CatalogEntryOut, EditionOut } from "@/lib/types";

/** The site's public origin, which Auth.js already pins (the deploy writes AUTH_URL = SITE_URL). */
export function siteUrl(): string {
  return (process.env.SITE_URL || process.env.AUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/** What the sitemap knows of the data when it is asked: the editions anyone may read, with their catalogs. */
export interface SitemapData {
  editions: EditionOut[];
  /** Each edition's catalog in its own language; absent when the API could not give it. */
  catalogs: Map<string, CatalogEntryOut[]>;
}

type Paths = (locale: Locale, data: SitemapData) => string[];

/** Every day of the Martyrology's year, 29 February included. */
const DAYS = Array.from({ length: 12 }, (_, i) => i + 1).flatMap((mm) =>
  Array.from({ length: daysInMonth(mm) }, (_, i) => ({ mm, dd: i + 1 })));

const read = (edition: string, rest = "") => `/read/${encodeURIComponent(edition)}${rest}`;

/**
 * Every page route under app/[locale], by its path there: the locale-less paths a crawler should
 * find in a language, or why it should not (a string). The sitemap reads this table, and a test
 * fails when a page route is added, moved or removed without its entry here.
 */
export const SITEMAP_ROUTES: Record<string, Paths | string> = {
  "/": () => ["/"],
  "/docs": () => [docHref()],
  "/docs/[page]": () => DOC_PAGES.map((p) => docHref(p.slug)),
  "/map": () => ["/map"],
  "/scalar": () => ["/scalar"],
  "/read/[edition]": "a redirect, in the browser, to today's page",
  "/read/[edition]/[mm]/[dd]": (_, { editions }) =>
    editions.flatMap((e) => DAYS.map((d) => dayPath(e.edition_id, d))),
  "/read/[edition]/notes": (_, { editions }) => editions.map((e) => read(e.edition_id, "/notes")),
  "/read/[edition]/names": (_, { editions }) =>
    editions.filter((e) => hasPersons(e.edition_id)).map((e) => read(e.edition_id, "/names")),
  "/read/[edition]/names/[letter]": (locale, { editions, catalogs }) =>
    editions.flatMap((e) => {
      const catalog = catalogs.get(e.edition_id);
      const index = catalog && hasPersons(e.edition_id) ? namesIndex(catalog, getPersons(), e.edition_id, locale) : null;
      return (index?.letters ?? []).map((l) => read(e.edition_id, `/names/${letterSlug(l.letter)}`));
    }),
  "/read/[edition]/places": (_, { editions }) => editions.map((e) => read(e.edition_id, "/places")),
  "/read/[edition]/places/[letter]": (locale, { editions, catalogs }) =>
    editions.flatMap((e) => {
      const catalog = catalogs.get(e.edition_id);
      const index = catalog ? placesIndex(catalog, getPlaces(), e.edition_id, locale) : null;
      return (index?.letters ?? []).map((l) => read(e.edition_id, `/places/${letterSlug(l.letter)}`));
    }),
  "/compare": "for curators only",
  "/review": "for curators only",
};

/** The editions anyone may read, each with its catalog when the API gives it. */
export async function sitemapData(): Promise<SitemapData> {
  const editions = ((await listEditions()) ?? []).filter((e) => e.availability.status === "public");
  const catalogs = new Map<string, CatalogEntryOut[]>();
  await Promise.all(editions.map(async (e) => {
    try {
      catalogs.set(e.edition_id, await fetchCatalog(e.edition_id, editionLang(e)));
    } catch (err) {
      // The indexes' letter pages are left out until the API gives the catalog again.
      console.error(`sitemap: the catalog of ${e.edition_id} could not be loaded`, err);
    }
  }));
  return { editions, catalogs };
}

/** Each language's locale-less paths, in the table's order. */
export function localePaths(data: SitemapData): Map<Locale, string[]> {
  const routes = Object.values(SITEMAP_ROUTES).filter((r): r is Paths => typeof r === "function");
  return new Map(LOCALES.map((locale) => [locale, routes.flatMap((paths) => paths(locale, data))]));
}

const href = (locale: Locale | null, path: string) =>
  `${siteUrl()}${locale ? `/${locale}` : ""}${path === "/" ? "" : path}`;

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * One language's sitemap: each of its pages, with the same page in every language that has it
 * (hreflang) and, as x-default, the locale-less URL, which goes to the reader's own language. Only
 * a page every language has gets an x-default: the redirect could otherwise land on a 404.
 */
export function localeSitemap(locale: Locale, all: Map<Locale, string[]>): string {
  const has = new Map(LOCALES.map((l) => [l, new Set(all.get(l))]));
  const urls = (all.get(locale) ?? []).map((path) => {
    const langs = LOCALES.filter((l) => has.get(l)!.has(path));
    const links = [
      ...langs.map((l) => [l, href(l, path)]),
      ...(langs.length === LOCALES.length ? [["x-default", href(null, path)]] : []),
    ].map(([lang, url]) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${xml(url)}"/>`);
    return `  <url>\n    <loc>${xml(href(locale, path))}</loc>\n${links.join("\n")}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
}

/** The sitemap index: one sitemap per language (app/sitemap/[file]/route.ts serves them). */
export function sitemapIndex(): string {
  const entries = LOCALES.map((l) => `  <sitemap>\n    <loc>${xml(`${siteUrl()}/sitemap/${l}.xml`)}</loc>\n  </sitemap>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</sitemapindex>\n`;
}
