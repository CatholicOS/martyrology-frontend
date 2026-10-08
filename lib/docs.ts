import type { Locale } from "@/i18n/routing";

/**
 * The documentation section's single table of pages: their order and part. Titles, descriptions,
 * part names and the index text are in the messages (Docs.index, Docs.parts.*, Docs.pages.<slug>);
 * content/docs/<lang>/<slug>.mdx holds each page's text. The sidebar, index, pager, <title> and the
 * routes' static params all read this table.
 */
export const DOC_PARTS = ["martyrology", "project"] as const;
export type DocPart = (typeof DOC_PARTS)[number];

export const DOC_PAGES = [
  { slug: "history", part: "martyrology" },
  { slug: "using", part: "martyrology" },
  { slug: "particular-calendars", part: "martyrology" },
  { slug: "reading-a-day", part: "martyrology" },
  { slug: "lunar-table", part: "martyrology" },
  { slug: "editions", part: "martyrology" },
  { slug: "notes-and-marks", part: "martyrology" },
  { slug: "ids", part: "project" },
  { slug: "data", part: "project" },
  { slug: "contributing", part: "project" },
] as const satisfies readonly { slug: string; part: DocPart }[];
export type DocPage = (typeof DOC_PAGES)[number];
export type DocSlug = DocPage["slug"];

/** The languages with their own content/docs/<lang> files; any other locale reads the English. */
export const DOC_CONTENT_LANGS: readonly Locale[] = ["en", "it"];

/** The languages whose docs a native speaker has reviewed; the others show the DraftNotice. */
export const REVIEWED_DOC_LANGS: readonly Locale[] = ["en", "it"];

/** The language of the content a locale's docs pages render: its own if written, else English. */
export function docContentLang(locale: Locale): Locale {
  return DOC_CONTENT_LANGS.includes(locale) ? locale : "en";
}

export function findPage(slug: string): DocPage | undefined {
  return DOC_PAGES.find((p) => p.slug === slug);
}

/** Locale-less, for the i18n Link: "/docs" for the index, "/docs/lunar-table" for a page. */
export function docHref(slug?: string): string {
  return slug ? `/docs/${slug}` : "/docs";
}

/** The pages before and after `slug` in reading order; empty for an unknown slug. */
export function neighbours(slug: string): { prev?: DocPage; next?: DocPage } {
  const i = DOC_PAGES.findIndex((p) => p.slug === slug);
  if (i < 0) return {};
  return { prev: DOC_PAGES[i - 1], next: DOC_PAGES[i + 1] };
}

/** The docs page of a locale-less pathname (from the i18n usePathname); null outside /docs. */
export function slugFromPath(pathname: string): { slug?: string } | null {
  const m = /^\/docs(?:\/([^/]+))?\/?$/.exec(pathname);
  return m ? { slug: m[1] } : null;
}

/** A heading's anchor: accents folded, apostrophes dropped, other runs of non-alphanumerics → "-". */
export function headingId(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
