/**
 * The documentation section's single table of pages: order, part, and each page's title and
 * description in every language. The sidebar, index, pager, language switch, <title> and the
 * routes' static params all read it; content/docs/<lang>/<slug>.mdx holds each page's text.
 */
export type DocLang = "en" | "it";
export type DocPart = "martyrology" | "project";
export interface DocText { title: string; description: string }
export interface DocPage { slug: string; part: DocPart; text: Record<DocLang, DocText> }

export const DOC_LANGS: readonly DocLang[] = ["en", "it"];

export const LANG_NAMES: Record<DocLang, string> = { en: "English", it: "Italiano" };

export const DOC_PARTS: readonly { part: DocPart; title: Record<DocLang, string> }[] = [
  { part: "martyrology", title: { en: "The Roman Martyrology", it: "Il Martirologio Romano" } },
  { part: "project", title: { en: "The project", it: "Il progetto" } },
];

export const DOC_INDEX: Record<DocLang, DocText> = {
  en: { title: "Documentation", description: "The Roman Martyrology, its use and its editions, and the project behind this site." },
  it: { title: "Documentazione", description: "Il Martirologio Romano, il suo uso e le sue edizioni, e il progetto di questo sito." },
};

export const DOC_PAGES: readonly DocPage[] = [
  { slug: "history", part: "martyrology", text: {
    en: { title: "History of the Roman Martyrology", description: "From the early martyrologies to the editio typica altera of 2004." },
    it: { title: "Storia del Martirologio Romano", description: "Dai primi martirologi all’editio typica altera del 2004." } } },
  { slug: "using", part: "martyrology", text: {
    en: { title: "Using the Martyrology", description: "What the book is for, and how and when it is read." },
    it: { title: "L’uso del Martirologio", description: "A che cosa serve il libro, e come e quando si legge." } } },
  { slug: "particular-calendars", part: "martyrology", text: {
    en: { title: "The Martyrology and the particular calendars", description: "Proper calendars, the Propria of the Martyrology, and the editions of the conferences." },
    it: { title: "Il Martirologio e i calendari particolari", description: "I calendari propri, i Propri del Martirologio e le edizioni delle Conferenze Episcopali." } } },
  { slug: "reading-a-day", part: "martyrology", text: {
    en: { title: "Reading a day’s page", description: "The Roman date, the moon, the order of the eulogies, and the asterisks." },
    it: { title: "Leggere la pagina di un giorno", description: "La data romana, la luna, l’ordine degli elogi e gli asterischi." } } },
  { slug: "lunar-table", part: "martyrology", text: {
    en: { title: "The lunar table", description: "Golden number, epact and the letters of the Martyrology: finding the moon to announce." },
    it: { title: "La tavola lunare", description: "Numero aureo, epatta e lettere del Martirologio: come trovare la luna da enunciare." } } },
  { slug: "editions", part: "martyrology", text: {
    en: { title: "The editions on this site", description: "Each edition, its nature, and who can read it." },
    it: { title: "Le edizioni di questo sito", description: "Ogni edizione, la sua natura e chi può leggerla." } } },
  { slug: "notes-and-marks", part: "martyrology", text: {
    en: { title: "Notes, misprints and errata", description: "What an edition prints, and what the curators add." },
    it: { title: "Note, refusi ed errata", description: "Ciò che un’edizione stampa e ciò che aggiungono i curatori." } } },
  { slug: "ids", part: "project", text: {
    en: { title: "Canonical eulogy IDs", description: "Why every eulogy has an identifier, and the rules that form it." },
    it: { title: "Gli identificatori canonici degli elogi", description: "Perché ogni elogio ha un identificatore, e le regole che lo formano." } } },
  { slug: "data", part: "project", text: {
    en: { title: "Data and sources", description: "The open registry behind the site, and its API." },
    it: { title: "Dati e fonti", description: "Il registro aperto su cui si basa il sito, e la sua API." } } },
  { slug: "contributing", part: "project", text: {
    en: { title: "How to contribute", description: "What scholars and students can help review." },
    it: { title: "Come contribuire", description: "Che cosa studiosi e studenti possono aiutare a rivedere." } } },
];

export function isDocLang(v: string): v is DocLang {
  return (DOC_LANGS as readonly string[]).includes(v);
}

export function findPage(slug: string): DocPage | undefined {
  return DOC_PAGES.find((p) => p.slug === slug);
}

/** "/docs/en" for the index, "/docs/it/lunar-table" for a page. */
export function docHref(lang: DocLang, slug?: string): string {
  return slug ? `/docs/${lang}/${slug}` : `/docs/${lang}`;
}

/** The pages before and after `slug` in reading order; empty for an unknown slug. */
export function neighbours(slug: string): { prev?: DocPage; next?: DocPage } {
  const i = DOC_PAGES.findIndex((p) => p.slug === slug);
  if (i < 0) return {};
  return { prev: DOC_PAGES[i - 1], next: DOC_PAGES[i + 1] };
}

export function otherLang(lang: DocLang): DocLang {
  return lang === "en" ? "it" : "en";
}

/** The docs language and page of a pathname; null outside /docs/<lang>. */
export function slugFromPath(pathname: string): { lang: DocLang; slug?: string } | null {
  const m = /^\/docs\/([^/]+)(?:\/([^/]+))?\/?$/.exec(pathname);
  if (!m || !isDocLang(m[1])) return null;
  return { lang: m[1], slug: m[2] };
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
