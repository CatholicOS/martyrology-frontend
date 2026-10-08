# Documentation section — design

## Purpose

A documentation section on romanmartyrology.com, in English and Italian, in two parts:

- **The Roman Martyrology** — for clergy, religious and interested readers: what the book is,
  where it comes from, how it is meant to be used, how to read a day's page (the asterisks, the
  lunar announcement) and how this site presents the editions and their apparatus.
- **The project** — for scholars, students and developers: the canonical eulogy IDs, the data
  behind the site, and how to contribute corrections.

Success: a reader who opens a day in the reader can find, in a page or two, what every mark on it
means and why the book is laid out as it is; a scholar can find the ID rules and the kinds of
corrections the project needs.

## Sources and copyright

- The authority for Part I is the *Praenotanda* of the *Martyrologium Romanum*, editio typica
  altera 2004, with the decrees (Prot. N. 551/00/L of 29 June 2001; Prot. N. 1140/04/L of 29 June
  2004), the section on the lunar day, and the *Ordo lectionis Martyrologii*. Read from the private
  PDFs (Latin and CEI Italian); the paragraph numbering is the same in both and is checked against
  the Latin before a page cites it.
- The 2004 texts are copyrighted. The English pages **paraphrase** and cite by number
  ("Praenotanda, n. 29"; "Ordo, n. 11"). The Italian pages may quote the CEI text in **short
  phrases** with a citation, never whole paragraphs. Facts of the method (the letters, the epact
  arithmetic, the worked examples such as 2005 → golden number 11 → epact XIX → letter *u* → moon
  20 on 1 January) are not expression and may be stated. **No eulogy text of the 2004 editions
  appears anywhere in the section.**
- The history page also draws on Baronius's *Tractatio de Martyrologio Romano* (1630, public
  domain; `~/baronius-tei-work/corrected.tei.xml`) for the early martyrologies, and may quote it.
- The IDs page is adapted from the reviewer reference "CRMEDR eulogy ID rules" (Claude Docs) and
  `crmedr/docs/canonicalization-report.md`.

## Pages

Slugs are the same in both languages; titles are translated.

### Part I — The Roman Martyrology

1. **`history` — History of the Roman Martyrology.** The early martyrologies (the Hieronymian, from
   the Roman, African and Syriac calendars; Bede, Ado, Usuard); Gregory XIII's edition of 1584 and
   Baronius's annotated edition; Urban VIII (1630); Benedict XIV (1748–49); revisions to 1960;
   *Sacrosanctum Concilium* 92c and the post-conciliar revision; the editio typica of 2001 and the
   editio altera of 2004 (decrees); the vernacular editions (CEI 2006 and the English versions on
   this site). Praenotanda nn. 20–23.
2. **`using` — Using the Martyrology.** Its liturgical nature (nn. 20–21, 24–26); what it lists and
   what it does not (nn. 27–28); the eulogies of a day are read on the day before (n. 35), in choir
   or outside it (n. 36); the *Ordo*: at Lauds after the concluding prayer, or at a minor Hour;
   outside the Office in choir, chapter room or refectory; the order (announcement of the next day,
   the eulogies, *Pretiosa in conspectu Domini*, optional short reading, prayer, blessing,
   dismissal); movable celebrations announced first; Easter Sunday; omission from Holy Thursday to
   Holy Saturday; the Christmas proclamation sung; the formulas for a transferred or relocated
   memorial (Ordo nn. 1–17).
3. **`particular-calendars` — The Martyrology and the particular calendars.** A saint inscribed
   on a day may be celebrated on that day where an optional memorial is allowed (nn. 26, 30); the
   beati are reserved to those granted the cult (n. 31); proper calendars of dioceses, religious
   families and conferences must agree with the Martyrology (n. 32); an impeded *dies natalis*
   (n. 33); titulars of churches (n. 34); the *Propria* and Appendices of the Martyrology, their
   approval, the ~40-word limit for eulogies (nn. 38–39); the conferences' editions, the order of
   national eulogies, translations versus partial collections (nn. 40–42); the Instruction
   *Calendaria particularia* (1970) the Praenotanda cite throughout.
4. **`reading-a-day` — Reading a day's page.** The heading: the Roman date (Kalends, Nones, Ides)
   and the moon; the leading celebrations printed without a number; the numbered eulogies and their
   order; **`#asterisks`** — n. 29 (the particular or local standing of the older saints and of all
   the beati from the Middle Ages on) and Ordo n. 11 (read only where the cult is granted), with a
   note that the Latin and CEI prints disagree on 29 entries and the site follows each edition's own
   print; "Item", "Eodem die" and "Ibidem". Illustrated by `<SampleDay />`.
5. **`lunar-table` — The lunar table.** Why the moon is announced (Easter, the bond of the two
   Covenants, the Eastern Churches) and that it is optional (Ordo n. 10); the thirty letters over
   each day and the 30- or 29-day columns; golden number, epact and Martyrology letter; finding a
   day's moon; the golden-number-1 rule (one less until the end of that lunation, except under
   *P*); epact XXV and the double *F* (black for golden numbers 12–19, red for 1–11); how long a
   table of letters is valid, and the arithmetic of the Praenotanda's footnotes; the 1630 and 2004
   layouts of the table (17 + 14 and 19 + 12 rows). Includes `<LunarFinder />`.
6. **`editions` — The editions on this site.** Each edition: year, language, nature (editio typica,
   vernacula, translation), its status on the site, and who can read its text.
7. **`notes-and-marks` — Notes, misprints and errata.** How the site sets apart what an edition
   prints from what the curators add:
   - the edition's own **footnotes and marginalia** (as printed, in the edition's language);
   - the edition's own **errata**, shown after the words they concern as "[Errata: …]", in brown;
   - **misprints the curators verified**, shown as "[sic! expected: …]" — not printed by the
     edition, and distinct from its errata;
   - **curator notes**, marked with a red dagger (†) in the text and given in English at the foot
     of the page (source errors, identity decisions, links to other eulogies);
   - the edition's **notes page** (`/read/<edition>/notes`), which gathers all of these.

### Part II — The project

8. **`ids` — Canonical eulogy IDs.** Why IDs are needed (citing a eulogy across editions and
   languages, linking data); the scheme `mr:MMDD-slug`; the day as part of identity; entry number,
   asterisk and unnumbered status as per-edition attributes; the slug rules (first-named subject,
   Latin nominative, honorific-free; pairs, `-et-socii`, anonymous groups; feasts; prophets and
   apostles; one name form; bare-name discriminators); deprecated IDs, `attested_in` and
   `same_eulogy`; a banner: **all IDs are drafts pending committee review**.
9. **`data` — Data and sources.** CRMEDR (the registry, subjects, typology, places, gazetteer,
   misprints, curator notes) and what is deliberately absent (the copyrighted texts); the API and
   its reference at `/scalar`.
10. **`contributing` — How to contribute.** An invitation to scholars and students. What the
    project needs reviewed:
    - the eulogy texts against the printed originals;
    - misprints not yet detected;
    - the IDs: their conformity to the rules, and whether a eulogy is recognizable from its ID;
    - eulogies that may still be run together and need splitting;
    - subject labels (Latin, Italian, English);
    - places and their identification;
    - and anything else that is wrong.

    How: curation tools for enabled users are **coming soon** to the site; the page says so and
    gives no other channel for now. When the tools ship, the page is updated to link them.

`/docs/<lang>` is the index: an introduction and the two parts with each page's title and
description.

## Architecture

### Content

- `content/docs/{en,it}/<slug>.mdx`, one file per page per language, plus `index.mdx`.
- Each file exports `metadata` (`title`, `description`), used by `generateMetadata`.
- MDX via `@next/mdx` (`@mdx-js/loader`, `@mdx-js/react`, `@types/mdx`); `next.config.ts` wraps the
  config with `createMDX()` and keeps `output: "standalone"` and the tracing includes. MDX is
  compiled at build time, so nothing extra is traced into the bundle.

### Registry — `lib/docs.ts`

The single ordered table of pages:

```ts
type DocLang = "en" | "it";
interface DocPage { slug: string; part: "martyrology" | "project"; title: Record<DocLang, string> }
export const DOC_LANGS: DocLang[];
export const DOC_PAGES: DocPage[];
export function docHref(lang: DocLang, slug?: string): string;      // "/docs/it/lunar-table"
export function neighbours(slug: string): { prev?: DocPage; next?: DocPage };
export function otherLang(lang: DocLang): DocLang;
```

The sidebar, the index, previous/next links, the language switch and `generateStaticParams` all
read it.

### Routes

- `app/docs/page.tsx` — redirects to `/docs/en`.
- `app/docs/[lang]/[[...page]]/page.tsx` — imports `@/content/docs/${lang}/${slug ?? "index"}.mdx`;
  `generateStaticParams` from the registry; `dynamicParams = false`, so an unknown language or page
  is a 404.
- `app/docs/[lang]/layout.tsx` — `DocsLayout`.

### Components

- **`DocsLayout`** — sidebar (both parts, current page marked with `aria-current`), the language
  switch (same page, other language) and the page in an `<article lang={lang}>`; on phones the
  sidebar becomes a disclosure above the article. Previous/next links at the foot.
- **`mdx-components.tsx`** — headings with anchor ids and a link to themselves (so
  `/docs/en/reading-a-day#asterisks` works); links through `next/link` for internal paths;
  `blockquote` for quotations in the text face (Junicode, `--font-text`); a `Rubric` component in
  the rubric red (`#a3161b`, 0.85em, upright), as in the reader.
- **`<Cite n="29" />` / `<Cite ordo n="11" />`** — a consistent citation: "(Praenotanda, n. 29)",
  "(Premesse, n. 29)", "(Ordo, n. 11)", "(Rito, n. 11)", by the page's language.
- **`<LunarFinder />`** (client) — a year and a date; asks the API for that day of the Latin 2004
  edition with `?year=` (`getDay`), and shows the golden number, epact and Martyrology letter the
  API returns (`annuntiatio`) and the moon to announce, with a link to that day in the reader. The
  computation stays in the API; the page explains it, it does not reimplement it. Errors show a
  short "couldn't be loaded" line, as in `DayHeading`.
- **`<SampleDay />`** — a schematic day: heading, an unnumbered leading celebration, numbered
  entries, one asterisked; subjects and places only (structural data), no eulogy text.
- **Header** — a "Docs" link before "Map" in `SiteHeader`.

## Testing

- `lib/docs` (written test-first): every registered page has an `.mdx` file in each language; no
  `.mdx` file is unregistered; the slugs are unique; `neighbours` at both ends; `docHref`;
  `otherLang`.
- `DocsLayout`: sidebar marks the current page; the language switch targets the same slug in the
  other language; previous/next.
- `LunarFinder`: with `getDay` mocked, shows golden number, epact, letter and age for 2005-01-01
  (11, XIX, *u*, 20); the loading and error states; an invalid year asks for nothing.
- `mdx-components`: headings get stable anchor ids.
- `npm run lint`, `npm test`, `npm run build` (all docs routes prerendered).
- Content review by the user before merge; each Praenotanda citation checked against the Latin.

## Delivery

One PR in martyrology-frontend: the framework, the ten pages and the index in both languages. The
content is drafted in English first, reviewed, then translated into Italian. The curation tools
named on the contributing page are a separate project.

## Out of scope

- The curation/feedback tools themselves.
- Latin-language docs.
- Search within the docs.
