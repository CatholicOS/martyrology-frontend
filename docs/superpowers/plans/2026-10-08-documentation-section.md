# Documentation Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A bilingual (English/Italian) documentation section at `/docs/<lang>/<page>` explaining the Roman Martyrology (history, use, particular calendars, reading a day, asterisks, lunar table, editions, the site's notes and marks) and the project (canonical IDs, data, contributing).

**Architecture:** MDX content files (`content/docs/{en,it}/<slug>.mdx`) compiled by `@next/mdx` and imported dynamically by two statically generated App Router routes. A pure registry (`lib/docs.ts`) is the single source of the page order, parts, titles and descriptions; the sidebar, index, pager, language switch, metadata and static params all read it. Three small embeddable components (`Cite`, `SampleDay`, `LunarFinder`) are passed to each MDX page with the page's language bound.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind 4, `@next/mdx` + `@mdx-js/loader` + `@mdx-js/react` + `@types/mdx`, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-08-documentation-section-design.md`

**Deviation from the spec (amend it in Task 2):** titles and descriptions live in the registry (`lib/docs.ts`), not in a `metadata` export of each MDX file — one source for the sidebar, index and `<title>`, and testable without compiling MDX.

## Global Constraints

- **No eulogy text of any 2004 edition (Latin, CEI Italian, English unofficial) appears anywhere in the section.** Subjects (from `crmedr/i18n`), IDs, entry numbers and asterisks are structural data and may appear.
- English pages **paraphrase** the 2004 Praenotanda / Ordo lectionis Martyrologii and cite by number. Italian pages may quote the CEI text only in **short phrases** with a citation — never a whole paragraph.
- Citations: English "(Praenotanda, n. 29)", "(Ordo, n. 11)"; Italian "(Premesse, n. 29)", "(Rito, n. 11)". Each number is checked against the Latin editio altera before the page is committed.
- Baronius's 1630 *Tractatio* (public domain) may be quoted.
- All IDs are **drafts pending committee review**; the IDs page says so in a banner.
- The contributing page says the curation tools for enabled users are **coming soon** and gives **no other channel**.
- Rubric typography: red `#a3161b`, `0.85em`, upright (not italic).
- `output: "standalone"` and the existing `outputFileTracingIncludes` in `next.config.ts` stay unchanged.
- Read `node_modules/next/dist/docs/01-app/02-guides/mdx.md` before touching the MDX setup (this Next version differs from training data; see `AGENTS.md`).
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01CnuHJ4WRgN2JcuYrZtyuTL
  ```

## Review Focus

1. **An unknown language or page** (`/docs/fr`, `/docs/en/nope`) must 404, not render an empty layout or throw — `dynamicParams = false` plus `isDocLang`/`findPage` guards; pinned by the smoke check in Task 2 and the guard tests in Task 1.
2. **Switching language on the index or a page with an anchor** must land on the same page in the other language (the index on the index), never a 404 — `docHref(otherLang(lang), slug)` with `slug` undefined on the index; pinned in Task 2's `DocsNav` test.
3. **LunarFinder given an empty, partial or out-of-range date** must ask the API for nothing and show no stale result; a failed request must show "couldn't be loaded" and clear the previous result — pinned in Task 3.
4. **Headings with accents or punctuation** ("Gli asterischi", "Ibidem, Item, Eodem die") must get stable ASCII anchor ids, so deep links survive — `headingId` folds and slugifies; pinned in Task 1 and Task 2.
5. **A new page added to the registry without both language files, or a stray `.mdx` not registered**, must fail the test suite rather than 404 or vanish silently in production — pinned by the content-parity test in Task 2.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/docs.ts` | Registry (pages, parts, index text), `isDocLang`, `findPage`, `docHref`, `neighbours`, `otherLang`, `slugFromPath`, `headingId` |
| `lib/__tests__/docs.test.ts` | Registry unit tests |
| `lib/__tests__/docs-content.test.ts` | Every registered page has an `.mdx` per language; no unregistered `.mdx` |
| `next.config.ts` | Wrap with `createMDX()` |
| `mdx-components.tsx` (root) | Element mapping for all MDX: headings with anchors, internal links via `next/link` |
| `components/docs/docs.module.css` | Article typography (descendant styles) |
| `components/docs/DocsNav.tsx` | Client sidebar: parts, pages, current page, language switch, phone toggle |
| `components/docs/DocsPager.tsx` | Previous/next links |
| `components/docs/Cite.tsx` | Praenotanda/Ordo citation by language |
| `components/docs/SampleDay.tsx` | Schematic 2 January page (structural data only) |
| `components/docs/LunarFinder.tsx` | Client: a date → golden number, epact, letter, moon (from the API) |
| `components/docs/mdx.tsx` | `docsComponents(lang)`: the embeddable components with `lang` bound |
| `components/docs/__tests__/*.test.tsx` | Component tests |
| `app/docs/page.tsx` | Redirect to `/docs/en` |
| `app/docs/[lang]/layout.tsx` | Validates `lang`; sidebar + `<article lang>` |
| `app/docs/[lang]/page.tsx` | Index: intro MDX + the two parts from the registry |
| `app/docs/[lang]/[page]/page.tsx` | A page: MDX + pager |
| `content/docs/{en,it}/*.mdx` | The content (11 files per language) |
| `components/SiteHeader.tsx` | "Docs" link before "Map" |

---

### Task 1: The docs registry

**Files:**
- Create: `lib/docs.ts`
- Test: `lib/__tests__/docs.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type DocLang = "en" | "it";
  export type DocPart = "martyrology" | "project";
  export interface DocText { title: string; description: string }
  export interface DocPage { slug: string; part: DocPart; text: Record<DocLang, DocText> }
  export const DOC_LANGS: readonly DocLang[];                 // ["en", "it"]
  export const DOC_PARTS: readonly { part: DocPart; title: Record<DocLang, string> }[];
  export const DOC_INDEX: Record<DocLang, DocText>;
  export const DOC_PAGES: readonly DocPage[];
  export const LANG_NAMES: Record<DocLang, string>;           // { en: "English", it: "Italiano" }
  export function isDocLang(v: string): v is DocLang;
  export function findPage(slug: string): DocPage | undefined;
  export function docHref(lang: DocLang, slug?: string): string;
  export function neighbours(slug: string): { prev?: DocPage; next?: DocPage };
  export function otherLang(lang: DocLang): DocLang;
  export function slugFromPath(pathname: string): { lang: DocLang; slug?: string } | null;
  export function headingId(text: string): string;
  ```

- [ ] **Step 1: Write the failing tests**

`lib/__tests__/docs.test.ts`:

```ts
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
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run lib/__tests__/docs.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/docs"`.

- [ ] **Step 3: Write the registry**

`lib/docs.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/__tests__/docs.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/docs.ts lib/__tests__/docs.test.ts
git commit -m "The docs registry: pages, parts, links and heading anchors"   # + trailer lines
```

---

### Task 2: MDX, routes, sidebar, pager and header link

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm), `next.config.ts`, `components/SiteHeader.tsx`, `components/__tests__/SiteHeader.test.tsx`, `docs/superpowers/specs/2026-10-08-documentation-section-design.md`
- Create: `mdx-components.tsx`, `components/docs/docs.module.css`, `components/docs/DocsNav.tsx`, `components/docs/DocsPager.tsx`, `components/docs/mdx.tsx`, `app/docs/page.tsx`, `app/docs/[lang]/layout.tsx`, `app/docs/[lang]/page.tsx`, `app/docs/[lang]/[page]/page.tsx`, `content/docs/en/*.mdx` and `content/docs/it/*.mdx` (11 each: `index` + the ten slugs)
- Test: `lib/__tests__/docs-content.test.ts`, `components/docs/__tests__/DocsNav.test.tsx`, `components/docs/__tests__/DocsPager.test.tsx`, `components/docs/__tests__/mdx-components.test.tsx`

**Interfaces:**
- Consumes: everything `lib/docs.ts` exports (Task 1).
- Produces:
  - `export function DocsNav({ lang }: { lang: DocLang }): JSX.Element` (client)
  - `export function DocsPager({ lang, slug }: { lang: DocLang; slug: string }): JSX.Element | null`
  - `export function docsComponents(lang: DocLang): MDXComponents` in `components/docs/mdx.tsx` — Task 3 adds `Cite`, `SampleDay`, `LunarFinder` to it; in this task it returns `{}`.
  - `useMDXComponents()` in `mdx-components.tsx` and its exported `components` map (`h2`, `h3`, `a`).
  - Article CSS module class `styles.article`.

- [ ] **Step 1: Install MDX**

Run: `npm install @next/mdx@^16 @mdx-js/loader @mdx-js/react @types/mdx`
Expected: added to `dependencies`; `npm ls @next/mdx` shows a 16.x version.

- [ ] **Step 2: Write the failing content-parity test**

`lib/__tests__/docs-content.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { DOC_LANGS, DOC_PAGES } from "@/lib/docs";

const root = join(process.cwd(), "content", "docs");
const expected = ["index", ...DOC_PAGES.map((p) => p.slug)].sort();

describe("the docs content", () => {
  for (const lang of DOC_LANGS)
    it(`has exactly one .mdx per registered page in ${lang}`, () => {
      const files = readdirSync(join(root, lang)).filter((f) => f.endsWith(".mdx")).map((f) => f.slice(0, -4)).sort();
      expect(files).toEqual(expected);
    });
});
```

Run: `npx vitest run lib/__tests__/docs-content.test.ts`
Expected: FAIL — `ENOENT: no such file or directory, scandir '.../content/docs/en'`.

- [ ] **Step 3: Create the content files**

Create `content/docs/en/` and `content/docs/it/` with one file per slug in `["index", "history", "using", "particular-calendars", "reading-a-day", "lunar-table", "editions", "notes-and-marks", "ids", "data", "contributing"]`. Each file starts as its registry title as `#` heading and its registry description as a paragraph, e.g. `content/docs/en/lunar-table.mdx`:

```mdx
# The lunar table

Golden number, epact and the letters of the Martyrology: finding the moon to announce.
```

and `content/docs/it/lunar-table.mdx`:

```mdx
# La tavola lunare

Numero aureo, epatta e lettere del Martirologio: come trovare la luna da enunciare.
```

`index.mdx` uses `DOC_INDEX[lang]`. Tasks 4–8 replace these with the full text.

Run: `npx vitest run lib/__tests__/docs-content.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 4: Configure MDX**

`next.config.ts` — add the import at the top and wrap the export; leave every existing option and comment as is:

```ts
import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const config: NextConfig = {
  // ... unchanged ...
};

// MDX for the documentation section (content/docs). Compiled at build time: nothing is read from
// disk at runtime, so nothing needs tracing into the standalone bundle.
const withMDX = createMDX({});

export default withMDX(config);
```

- [ ] **Step 5: Write the failing MDX-elements test**

`components/docs/__tests__/mdx-components.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { components } from "@/mdx-components";

const H2 = components.h2 as (p: { children?: React.ReactNode }) => React.ReactElement;
const A = components.a as (p: { href?: string; children?: React.ReactNode }) => React.ReactElement;

describe("the docs' MDX elements", () => {
  it("anchor a heading by its text, accents and markup included", () => {
    render(<H2>Gli <em>asterischi</em> è</H2>);
    const h = screen.getByRole("heading", { level: 2 });
    expect(h).toHaveAttribute("id", "gli-asterischi-e");
    expect(screen.getByRole("link")).toHaveAttribute("href", "#gli-asterischi-e");
  });

  it("open external links in place but mark them external", () => {
    render(<A href="https://github.com/CatholicOS/crmedr">crmedr</A>);
    expect(screen.getByRole("link", { name: "crmedr" })).toHaveAttribute("rel", "external");
  });

  it("keep internal links internal", () => {
    render(<A href="/docs/en/ids">IDs</A>);
    expect(screen.getByRole("link", { name: "IDs" })).toHaveAttribute("href", "/docs/en/ids");
    expect(screen.getByRole("link", { name: "IDs" })).not.toHaveAttribute("rel");
  });
});
```

Run: `npx vitest run components/docs/__tests__/mdx-components.test.tsx`
Expected: FAIL — cannot resolve `@/mdx-components`.

- [ ] **Step 6: Write `mdx-components.tsx`**

```tsx
import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { isValidElement, type ReactNode } from "react";
import { headingId } from "@/lib/docs";

/** A node's plain text, through any markup inside it. */
function textOf(n: ReactNode): string {
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(n)) return textOf(n.props.children);
  return "";
}

/** A section heading that links to itself, so any section can be linked: /docs/en/reading-a-day#asterisks. */
function heading(Tag: "h2" | "h3") {
  return function Heading({ children }: { children?: ReactNode }) {
    const id = headingId(textOf(children));
    return (
      <Tag id={id}>
        <a href={`#${id}`}>{children}</a>
      </Tag>
    );
  };
}

export const components: MDXComponents = {
  h2: heading("h2"),
  h3: heading("h3"),
  a: ({ href = "", children }) =>
    href.startsWith("/") ? <Link href={href}>{children}</Link> : <a href={href} rel={href.startsWith("#") ? undefined : "external"}>{children}</a>,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
```

Run: `npx vitest run components/docs/__tests__/mdx-components.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 7: Write the failing sidebar and pager tests**

`components/docs/__tests__/DocsNav.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/docs/en/lunar-table" } }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

import { DocsNav } from "@/components/docs/DocsNav";

describe("DocsNav", () => {
  it("lists both parts and marks the current page", () => {
    pathname.current = "/docs/en/lunar-table";
    render(<DocsNav lang="en" />);
    expect(screen.getByText("The Roman Martyrology")).toBeInTheDocument();
    expect(screen.getByText("The project")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "The lunar table" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "History of the Roman Martyrology" })).not.toHaveAttribute("aria-current");
  });

  it("switches language on the same page", () => {
    pathname.current = "/docs/en/lunar-table";
    render(<DocsNav lang="en" />);
    expect(screen.getByRole("link", { name: "Italiano" })).toHaveAttribute("href", "/docs/it/lunar-table");
  });

  it("switches language on the index to the other index", () => {
    pathname.current = "/docs/it";
    render(<DocsNav lang="it" />);
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("href", "/docs/en");
    expect(screen.getByRole("link", { name: "Documentazione" })).toHaveAttribute("aria-current", "page");
  });

  it("opens and closes the contents on phones", () => {
    pathname.current = "/docs/en/history";
    render(<DocsNav lang="en" />);
    const button = screen.getByRole("button", { name: "Contents" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });
});
```

`components/docs/__tests__/DocsPager.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocsPager } from "@/components/docs/DocsPager";

describe("DocsPager", () => {
  it("links the previous and next pages, in the page's language", () => {
    render(<DocsPager lang="it" slug="using" />);
    expect(screen.getByRole("link", { name: /Storia del Martirologio Romano/ })).toHaveAttribute("href", "/docs/it/history");
    expect(screen.getByRole("link", { name: /Il Martirologio e i calendari particolari/ })).toHaveAttribute("href", "/docs/it/particular-calendars");
  });

  it("has no previous link on the first page and no next link on the last", () => {
    const { unmount } = render(<DocsPager lang="en" slug="history" />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    unmount();
    render(<DocsPager lang="en" slug="contributing" />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/docs/en/data");
  });
});
```

Run: `npx vitest run components/docs/__tests__/DocsNav.test.tsx components/docs/__tests__/DocsPager.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 8: Write the CSS module, sidebar and pager**

`components/docs/docs.module.css`:

```css
/* A documentation page: readable measure, serif headings, the editions' text face for quotations. */
.article { max-width: 42rem; line-height: 1.65; }
.article h1 { font-family: var(--font-text), Georgia, serif; font-size: 1.9rem; line-height: 1.25; margin-bottom: 1rem; }
.article h2 { font-family: var(--font-text), Georgia, serif; font-size: 1.4rem; margin: 2rem 0 0.75rem; scroll-margin-top: 1rem; }
.article h3 { font-weight: 600; margin: 1.5rem 0 0.5rem; scroll-margin-top: 1rem; }
.article h2 > a, .article h3 > a { color: inherit; text-decoration: none; }
.article h2 > a:hover, .article h3 > a:hover { text-decoration: underline; }
.article p, .article ul, .article ol, .article table { margin: 0.75rem 0; }
.article ul { list-style: disc; padding-left: 1.5rem; }
.article ol { list-style: decimal; padding-left: 1.5rem; }
.article li + li { margin-top: 0.3rem; }
.article a:not(h2 > a, h3 > a) { text-decoration: underline; }
.article blockquote {
  margin: 1rem 0; padding-left: 1rem; border-left: 3px solid rgba(163, 22, 27, 0.35);
  font-family: var(--font-text), Georgia, serif; font-size: 1.05rem;
}
.article table { border-collapse: collapse; font-size: 0.9rem; }
.article th, .article td { border: 1px solid rgb(203 213 225); padding: 0.25rem 0.5rem; text-align: left; }
.article code { font-size: 0.85em; }
/* A rubric, as the editions print it: red, a size below the text, upright. */
.rubric { color: #a3161b; font-size: 0.85em; font-style: normal; }
.banner { border-left: 3px solid #a3161b; padding: 0.5rem 0.75rem; background: rgba(163, 22, 27, 0.06); }
```

`components/docs/DocsNav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { usePathname } from "next/navigation";
import { DOC_INDEX, DOC_PAGES, DOC_PARTS, LANG_NAMES, docHref, otherLang, slugFromPath, type DocLang } from "@/lib/docs";

const CONTENTS: Record<DocLang, string> = { en: "Contents", it: "Indice" };

/**
 * The docs' sidebar: the index, both parts with their pages (the current one marked), and the
 * same page in the other language. Below `sm` the list folds behind a "Contents" button.
 */
export function DocsNav({ lang }: { lang: DocLang }) {
  const here = slugFromPath(usePathname());
  const slug = here?.slug;
  const [open, setOpen] = useState(false);
  const listId = useId();
  const other = otherLang(lang);
  const current = (s?: string) => (s === slug ? ("page" as const) : undefined);

  return (
    <nav aria-label={DOC_INDEX[lang].title} className="shrink-0 text-sm sm:w-56">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="rounded border border-slate-300 px-2 py-1 sm:hidden dark:border-slate-700"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
        >
          {CONTENTS[lang]}
        </button>
        <Link href={docHref(other, slug)} hrefLang={other} lang={other} className="ml-auto underline">
          {LANG_NAMES[other]}
        </Link>
      </div>
      <div id={listId} className={`${open ? "block" : "hidden"} mt-3 sm:block`}>
        <Link href={docHref(lang)} aria-current={current(undefined)} className="font-semibold aria-[current=page]:text-[#a3161b]">
          {DOC_INDEX[lang].title}
        </Link>
        {DOC_PARTS.map(({ part, title }) => (
          <div key={part} className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title[lang]}</p>
            <ul className="mt-1 space-y-1">
              {DOC_PAGES.filter((p) => p.part === part).map((p) => (
                <li key={p.slug}>
                  <Link href={docHref(lang, p.slug)} aria-current={current(p.slug)} className="hover:underline aria-[current=page]:font-semibold aria-[current=page]:text-[#a3161b]">
                    {p.text[lang].title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
```

`components/docs/DocsPager.tsx`:

```tsx
import Link from "next/link";
import { docHref, neighbours, type DocLang } from "@/lib/docs";

const LABELS: Record<DocLang, { prev: string; next: string }> = {
  en: { prev: "Previous", next: "Next" },
  it: { prev: "Precedente", next: "Successivo" },
};

/** The previous and next pages, at the foot of a docs page. */
export function DocsPager({ lang, slug }: { lang: DocLang; slug: string }) {
  const { prev, next } = neighbours(slug);
  if (!prev && !next) return null;
  return (
    <nav aria-label={`${LABELS[lang].prev} / ${LABELS[lang].next}`} className="mt-12 flex justify-between gap-4 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
      {prev ? (
        <Link href={docHref(lang, prev.slug)} className="hover:underline">← {LABELS[lang].prev}: {prev.text[lang].title}</Link>
      ) : <span />}
      {next && (
        <Link href={docHref(lang, next.slug)} className="text-right hover:underline">{LABELS[lang].next}: {next.text[lang].title} →</Link>
      )}
    </nav>
  );
}
```

`components/docs/mdx.tsx`:

```tsx
import type { MDXComponents } from "mdx/types";
import type { DocLang } from "@/lib/docs";

/** The components a docs page may use, with the page's language bound. */
export function docsComponents(lang: DocLang): MDXComponents {
  void lang;
  return {};
}
```

Run: `npx vitest run components/docs`
Expected: PASS (all tests in DocsNav, DocsPager, mdx-components).

- [ ] **Step 9: Write the routes**

`app/docs/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function Docs() {
  redirect("/docs/en");
}
```

`app/docs/[lang]/layout.tsx`:

```tsx
import { notFound } from "next/navigation";
import { DocsNav } from "@/components/docs/DocsNav";
import styles from "@/components/docs/docs.module.css";
import { DOC_LANGS, isDocLang } from "@/lib/docs";

export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_LANGS.map((lang) => ({ lang }));
}

export default async function DocsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isDocLang(lang)) notFound();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:flex-row sm:gap-10">
      <DocsNav lang={lang} />
      <article lang={lang} className={`${styles.article} min-w-0 flex-1`}>
        {children}
      </article>
    </div>
  );
}
```

`app/docs/[lang]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { docsComponents } from "@/components/docs/mdx";
import { DOC_INDEX, DOC_PAGES, DOC_PARTS, docHref, isDocLang } from "@/lib/docs";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isDocLang(lang)) return {};
  return { title: `${DOC_INDEX[lang].title} — Roman Martyrology`, description: DOC_INDEX[lang].description };
}

export default async function DocsIndex({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isDocLang(lang)) notFound();
  const { default: Intro } = await import(`@/content/docs/${lang}/index.mdx`);
  return (
    <>
      <Intro components={docsComponents(lang)} />
      {DOC_PARTS.map(({ part, title }) => (
        <section key={part}>
          <h2>{title[lang]}</h2>
          <ul>
            {DOC_PAGES.filter((p) => p.part === part).map((p) => (
              <li key={p.slug}>
                <Link href={docHref(lang, p.slug)}>{p.text[lang].title}</Link> — {p.text[lang].description}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
```

`app/docs/[lang]/[page]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { DocsPager } from "@/components/docs/DocsPager";
import { docsComponents } from "@/components/docs/mdx";
import { DOC_LANGS, DOC_PAGES, findPage, isDocLang } from "@/lib/docs";

export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_LANGS.flatMap((lang) => DOC_PAGES.map((p) => ({ lang, page: p.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; page: string }> }) {
  const { lang, page } = await params;
  const p = findPage(page);
  if (!isDocLang(lang) || !p) return {};
  return { title: `${p.text[lang].title} — Roman Martyrology`, description: p.text[lang].description };
}

export default async function DocPage({ params }: { params: Promise<{ lang: string; page: string }> }) {
  const { lang, page } = await params;
  if (!isDocLang(lang) || !findPage(page)) notFound();
  const { default: Content } = await import(`@/content/docs/${lang}/${page}.mdx`);
  return (
    <>
      <Content components={docsComponents(lang)} />
      <DocsPager lang={lang} slug={page} />
    </>
  );
}
```

- [ ] **Step 10: Add the header link (test first)**

Append to `components/__tests__/SiteHeader.test.tsx` inside the `describe`:

```tsx
  it("links the docs for everyone, before the map", async () => {
    viewerMock.mockResolvedValue({ signedIn: false, curator: false });
    render(await SiteHeader());
    const links = screen.getAllByRole("link").map((a) => a.textContent);
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/docs/en");
    expect(links.indexOf("Docs")).toBe(links.indexOf("Map") - 1);
  });
```

Run: `npx vitest run components/__tests__/SiteHeader.test.tsx` → FAIL (no "Docs" link).

In `components/SiteHeader.tsx`, inside `<NavMenu>`, before `<Link href="/map">Map</Link>`:

```tsx
          <Link href="/docs/en">Docs</Link>
```

Run: `npx vitest run components/__tests__/SiteHeader.test.tsx` → PASS.

- [ ] **Step 11: Amend the spec**

In the spec's "Content" section, replace the bullet "Each file exports `metadata` (`title`, `description`), used by `generateMetadata`." with "Titles and descriptions live in the registry (`lib/docs.ts`), which `generateMetadata`, the sidebar and the index read; the MDX files hold only the text." In "Routes", replace the `[[...page]]` bullet with the two routes `app/docs/[lang]/page.tsx` (index) and `app/docs/[lang]/[page]/page.tsx`.

- [ ] **Step 12: Build and smoke-check**

Run: `npm run lint && npm test && npm run build`
Expected: lint clean; all tests pass; the build lists `/docs/[lang]` (2 paths) and `/docs/[lang]/[page]` (20 paths) as prerendered (●/SSG).

Then:
```bash
PORT=3999 node .next/standalone/server.js & sleep 3
for p in /docs /docs/en /docs/it/lunar-table /docs/fr /docs/en/nope; do printf "%s " $p; curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3999$p; done
kill %1
```
Expected: `/docs` → `307 …/docs/en`; `/docs/en` and `/docs/it/lunar-table` → `200`; `/docs/fr` and `/docs/en/nope` → `404`. (If the standalone server lacks static assets, that does not affect these status codes.)

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json next.config.ts mdx-components.tsx components/docs app/docs content/docs lib/__tests__/docs-content.test.ts components/SiteHeader.tsx components/__tests__/SiteHeader.test.tsx docs/superpowers/specs/2026-10-08-documentation-section-design.md
git commit -m "The docs section: MDX pages in English and Italian, sidebar, pager, header link"   # + trailer lines
```

---

### Task 3: Embeddable components — Cite, SampleDay, LunarFinder

**Files:**
- Create: `components/docs/Cite.tsx`, `components/docs/SampleDay.tsx`, `components/docs/LunarFinder.tsx`
- Modify: `components/docs/mdx.tsx`
- Test: `components/docs/__tests__/Cite.test.tsx`, `components/docs/__tests__/SampleDay.test.tsx`, `components/docs/__tests__/LunarFinder.test.tsx`

**Interfaces:**
- Consumes: `DocLang` (Task 1); `getDay(edition, mm, dd, year?)` from `@/lib/api` returning `DayOut` whose `luna?.annuntiatio` is `LunaAnnouncement | null` (`{ year, golden_number, epact, letter, column, age, pronuntiatio }`, `lib/types.ts`); `docsComponents` (Task 2).
- Produces (usable in any MDX page without import):
  - `<Cite n="29" />`, `<Cite ordo n="11" />`, `<Cite n="38-39" />`
  - `<SampleDay />`
  - `<LunarFinder />`
  - `<Rubric>…</Rubric>`

- [ ] **Step 1: Write the failing tests**

`components/docs/__tests__/Cite.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Cite } from "@/components/docs/Cite";

describe("Cite", () => {
  it("names the Praenotanda and the Ordo in English", () => {
    render(<p><Cite lang="en" n="29" /> <Cite lang="en" ordo n="11" /></p>);
    expect(screen.getByText("(Praenotanda, n. 29)")).toBeInTheDocument();
    expect(screen.getByText("(Ordo, n. 11)")).toBeInTheDocument();
  });

  it("names the Premesse and the Rito in Italian, and ranges as nn.", () => {
    render(<p><Cite lang="it" n="38-39" /> <Cite lang="it" ordo n="11" /></p>);
    expect(screen.getByText("(Premesse, nn. 38–39)")).toBeInTheDocument();
    expect(screen.getByText("(Rito, n. 11)")).toBeInTheDocument();
  });
});
```

`components/docs/__tests__/SampleDay.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SampleDay } from "@/components/docs/SampleDay";

describe("SampleDay", () => {
  it("shows an unnumbered lead, numbered entries and asterisked ones, by subject only", () => {
    render(<SampleDay lang="en" />);
    expect(screen.getByText("Saints Basil the Great and Gregory Nazianzen")).toBeInTheDocument();
    expect(screen.getByText("2.")).toBeInTheDocument();
    expect(screen.getByText("4*.")).toBeInTheDocument();
    expect(screen.getByText("Blessed Marcolinus Amanni")).toBeInTheDocument();
  });

  it("names the subjects in Italian on Italian pages", () => {
    render(<SampleDay lang="it" />);
    expect(screen.getByText("San Telesforo")).toBeInTheDocument();
  });
});
```

`components/docs/__tests__/LunarFinder.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { getDay } = vi.hoisted(() => ({ getDay: vi.fn() }));
vi.mock("@/lib/api", () => ({ getDay }));

import { LunarFinder } from "@/components/docs/LunarFinder";

const day2005 = {
  luna: { annuntiatio: { year: 2005, golden_number: 11, epact: "XIX", letter: "u", column: 0, age: 20, pronuntiatio: "Luna vigesima" } },
};

function pick(value: string) {
  fireEvent.change(screen.getByLabelText("Date"), { target: { value } });
}

describe("LunarFinder", () => {
  beforeEach(() => getDay.mockReset());

  it("shows the year's golden number, epact and letter, and the day's moon", async () => {
    getDay.mockResolvedValue(day2005);
    render(<LunarFinder lang="en" />);
    pick("2005-01-01");
    expect(getDay).toHaveBeenCalledWith("martyrologium_romanum_2004", "01", "01", 2005);
    expect(await screen.findByText("11")).toBeInTheDocument();
    expect(screen.getByText("XIX")).toBeInTheDocument();
    expect(screen.getByText("u")).toBeInTheDocument();
    expect(screen.getByText("Luna vigesima")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /reader/i })).toHaveAttribute("href", "/read/martyrologium_romanum_2004/01/01");
  });

  it("asks for nothing while the date is empty or incomplete", () => {
    render(<LunarFinder lang="en" />);
    pick("");
    pick("0000-01-01");
    expect(getDay).not.toHaveBeenCalled();
  });

  it("says when the moon couldn't be loaded, and drops the previous answer", async () => {
    getDay.mockResolvedValueOnce(day2005).mockRejectedValueOnce(new Error("502"));
    render(<LunarFinder lang="en" />);
    pick("2005-01-01");
    expect(await screen.findByText("XIX")).toBeInTheDocument();
    pick("2006-01-01");
    expect(await screen.findByText(/couldn.t be loaded/)).toBeInTheDocument();
    expect(screen.queryByText("XIX")).not.toBeInTheDocument();
  });

  it("ignores an answer that arrives after a newer date was picked", async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    getDay.mockReturnValueOnce(new Promise((r) => (resolveFirst = r))).mockResolvedValueOnce({
      luna: { annuntiatio: { ...day2005.luna.annuntiatio, year: 2006, golden_number: 12, epact: "*", letter: "P" } },
    });
    render(<LunarFinder lang="en" />);
    pick("2005-01-01");
    pick("2006-01-01");
    expect(await screen.findByText("P")).toBeInTheDocument();
    resolveFirst(day2005);
    await waitFor(() => expect(screen.queryByText("XIX")).not.toBeInTheDocument());
  });
});
```

Run: `npx vitest run components/docs/__tests__/Cite.test.tsx components/docs/__tests__/SampleDay.test.tsx components/docs/__tests__/LunarFinder.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 2: Write `Cite`**

`components/docs/Cite.tsx`:

```tsx
import type { DocLang } from "@/lib/docs";

const NAMES: Record<DocLang, { praenotanda: string; ordo: string }> = {
  en: { praenotanda: "Praenotanda", ordo: "Ordo" },
  it: { praenotanda: "Premesse", ordo: "Rito" },
};

/**
 * A citation of the 2004 Praenotanda or of its Ordo lectionis Martyrologii by paragraph:
 * "(Praenotanda, n. 29)", "(Rito, n. 11)"; a range "38-39" reads "nn. 38–39".
 */
export function Cite({ lang, n, ordo = false }: { lang: DocLang; n: string; ordo?: boolean }) {
  const range = n.includes("-");
  const name = NAMES[lang][ordo ? "ordo" : "praenotanda"];
  return <span className="whitespace-nowrap">({name}, {range ? "nn." : "n."} {n.replace("-", "–")})</span>;
}
```

- [ ] **Step 3: Write `SampleDay`**

Before writing it, fetch the 2004 Latin heading for 2 January from the live API and use it verbatim as `TITULUS` (it is a date formula, not eulogy text):

```bash
curl -s https://romanmartyrology.com/api/mr/elogia/edition/martyrologium_romanum_2004/01/02 | python3 -c "import json,sys; print(json.load(sys.stdin).get('titulus'))"
```

If the response nests the day (e.g. under `content`), read `titulus` from there. Expected shape: "Quarto Nonas Ianuarii. Luna …". Then `components/docs/SampleDay.tsx`:

```tsx
import styles from "@/components/page.module.css";
import type { DocLang } from "@/lib/docs";

/** The 2004 Latin heading of 2 January, as the API serves it (a date formula). */
const TITULUS = "Quarto Nonas Ianuarii. Luna"; // replace with the API's exact string (Step 3)

/** 2 January in the editio altera 2004: entry, asterisk, subject (crmedr i18n). No eulogy text. */
const ENTRIES: { entry: number | null; asterisk: boolean; en: string; it: string }[] = [
  { entry: null, asterisk: false, en: "Saints Basil the Great and Gregory Nazianzen", it: "Santi Basilio Magno e Gregorio Nazianzeno" },
  { entry: 2, asterisk: false, en: "Saint Telesphorus", it: "San Telesforo" },
  { entry: 4, asterisk: true, en: "Saint Theodore", it: "San Teodoro" },
  { entry: 5, asterisk: true, en: "Saint Bladulf", it: "San Bladolfo" },
  { entry: 12, asterisk: true, en: "Blessed Marcolinus Amanni", it: "Beato Marcolino Amanni" },
];

const CAPTION: Record<DocLang, string> = {
  en: "2 January in the 2004 Latin edition, in outline: each eulogy is shown by its subject only. Entries 3, 6–11 and 13–15 are left out.",
  it: "Il 2 gennaio nell’edizione latina del 2004, in schema: ogni elogio è indicato solo dal suo soggetto. Sono omessi gli elogi 3, 6–11 e 13–15.",
};

/** A schematic day's page for the docs: heading, the unnumbered lead, numbered and asterisked entries. */
export function SampleDay({ lang }: { lang: DocLang }) {
  return (
    <figure className="my-6">
      <div className={styles.page} style={{ minHeight: 0 }}>
        <p className={styles.heading} lang="la">{TITULUS}</p>
        {ENTRIES.map((e) => (
          <p key={e.en} className={e.entry === null ? `${styles.entry} ${styles.unnumbered}` : styles.entry}>
            {e.entry !== null && <span className={styles.rubric}>{`${e.entry}${e.asterisk ? "*" : ""}.`}</span>}
            <span>{e[lang]}</span>
            {" …"}
          </p>
        ))}
      </div>
      <figcaption className="mt-2 text-sm text-slate-600 dark:text-slate-400">{CAPTION[lang]}</figcaption>
    </figure>
  );
}
```

Remove the `// replace …` comment once `TITULUS` holds the API's string.

- [ ] **Step 4: Write `LunarFinder`**

`components/docs/LunarFinder.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { getDay } from "@/lib/api";
import type { DocLang } from "@/lib/docs";
import type { LunaAnnouncement } from "@/lib/types";

const EDITION = "martyrologium_romanum_2004";

const T: Record<DocLang, Record<"date" | "golden" | "epact" | "letter" | "moon" | "reader" | "failed" | "loading", string>> = {
  en: { date: "Date", golden: "Golden number", epact: "Epact", letter: "Letter of the Martyrology", moon: "Moon to announce",
        reader: "Open this day in the reader", failed: "The moon couldn't be loaded.", loading: "Loading…" },
  it: { date: "Data", golden: "Numero aureo", epact: "Epatta", letter: "Lettera del Martirologio", moon: "Luna da enunciare",
        reader: "Apri questo giorno nel lettore", failed: "Non è stato possibile caricare la luna.", loading: "Caricamento…" },
};

/** "2005-01-01" → { year: 2005, mm: "01", dd: "01" }; null for an empty or partial value or year 0. */
function parseDate(v: string): { year: number; mm: string; dd: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m || Number(m[1]) < 1) return null;
  return { year: Number(m[1]), mm: m[2], dd: m[3] };
}

/**
 * Pick a date: the year's golden number, epact and Martyrology letter, and the moon the 2004 edition
 * announces on that day, as the API computes them (the page explains the method; this does not redo it).
 */
export function LunarFinder({ lang }: { lang: DocLang }) {
  const t = T[lang];
  const inputId = useId();
  const [value, setValue] = useState("");
  const [state, setState] = useState<{ for: string; luna?: LunaAnnouncement | null; failed?: boolean } | null>(null);
  const date = parseDate(value);

  useEffect(() => {
    if (!date) return;
    let live = true;
    getDay(EDITION, date.mm, date.dd, date.year).then(
      (day) => live && setState({ for: value, luna: day.luna?.annuntiatio ?? null }),
      () => live && setState({ for: value, failed: true }),
    );
    return () => {
      live = false;
    };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps -- `date` derives from `value`

  const shown = date && state?.for === value ? state : null;
  return (
    <div className="my-6 rounded border border-slate-200 p-4 dark:border-slate-800">
      <label htmlFor={inputId} className="mr-2">{t.date}</label>
      <input id={inputId} type="date" value={value} onChange={(e) => setValue(e.target.value)}
             className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900" />
      {date && !shown && <p className="mt-3 text-sm">{t.loading}</p>}
      {shown?.failed && <p className="mt-3 text-sm">{t.failed}</p>}
      {shown?.luna && (
        <>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt>{t.golden}</dt><dd>{shown.luna.golden_number}</dd>
            <dt>{t.epact}</dt><dd>{shown.luna.epact}</dd>
            <dt>{t.letter}</dt><dd>{shown.luna.letter}</dd>
            <dt>{t.moon}</dt><dd lang="la" className="italic">{shown.luna.pronuntiatio}</dd>
          </dl>
          <p className="mt-3 text-sm">
            <Link href={`/read/${EDITION}/${date!.mm}/${date!.dd}`} className="underline">{t.reader}</Link>
          </p>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Bind them for MDX**

Replace `components/docs/mdx.tsx`:

```tsx
import type { MDXComponents } from "mdx/types";
import type { ReactNode } from "react";
import { Cite } from "@/components/docs/Cite";
import { LunarFinder } from "@/components/docs/LunarFinder";
import { SampleDay } from "@/components/docs/SampleDay";
import styles from "@/components/docs/docs.module.css";
import type { DocLang } from "@/lib/docs";

/** The components a docs page may use, with the page's language bound: <Cite n="29" />, <SampleDay />, <LunarFinder />, <Rubric>. */
export function docsComponents(lang: DocLang): MDXComponents {
  return {
    Cite: (p: { n: string; ordo?: boolean }) => <Cite lang={lang} {...p} />,
    SampleDay: () => <SampleDay lang={lang} />,
    LunarFinder: () => <LunarFinder lang={lang} />,
    Rubric: ({ children }: { children?: ReactNode }) => <span className={styles.rubric}>{children}</span>,
    Banner: ({ children }: { children?: ReactNode }) => <div className={styles.banner} role="note">{children}</div>,
  };
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run components/docs`
Expected: PASS (Cite 2, SampleDay 2, LunarFinder 4, plus Task 2's tests).

- [ ] **Step 7: Commit**

```bash
git add components/docs
git commit -m "Docs components: Praenotanda citations, a sample day, the lunar finder"   # + trailer lines
```

---

## Content tasks (4–8): shared rules

These apply to every content task. Each content task replaces stub files from Task 2.

**Sources (private; never committed):**
```bash
S=$(mktemp -d)   # or the session scratchpad
D="/mnt/c/Users/johnr/Documents/LitCal/Roman Martyrology"
pdftotext -f 1 -l 60 "$D/Martirologio-Romano.pdf" "$S/it-front.txt"                 # CEI Italian: Decreti, Premesse 1–42, Il giorno lunare, Rito 1–17, Elogi mobili
pdftotext -f 1 -l 60 "$D/Martyrologium Romanum (2004).pdf" "$S/la-front.txt"        # Latin: Praenotanda, Ordo lectionis Martyrologii (OCR: æ/œ may read as "JE"/"re")
```
Baronius: `~/baronius-tei-work/corrected.tei.xml` (*Tractatio de Martyrologio Romano* near the start). IDs: the Claude Docs artifact "CRMEDR eulogy ID rules — reviewer reference" (`https://claude.ai/code/artifact/f627639e-ad7c-48d8-8015-c5880dfc4502`, read with the Claude Docs `read` tool) and `../crmedr/docs/canonicalization-report.md`, `../crmedr/AGENTS.md`.

**Writing rules:**
- Start each file with `# <registry title>`, then a one-paragraph lead.
- Use `##` for sections (they get anchors), `###` sparingly.
- Cite with `<Cite n="29" />` / `<Cite ordo n="11" />` right after the claim. Before committing a page, grep each cited number in `la-front.txt` and confirm the Latin paragraph says the same thing as the Italian one you paraphrased.
- English: paraphrase only; no sentence of the 2004 Praenotanda translated word for word at length.
- No 2004 eulogy text, in any language. Subjects, IDs and numbers only.
- Link between pages with root-relative links (`/docs/en/lunar-table#…`); link the reader as `/read/<edition_id>`.
- Plain, warm register for Part I (readers who are not specialists); precise register for Part II.
- Each page roughly 600–1,200 words; the lunar table may run longer.

---

### Task 4: English — history, using, particular calendars

**Files:** Modify `content/docs/en/history.mdx`, `content/docs/en/using.mdx`, `content/docs/en/particular-calendars.mdx`

- [ ] **Step 1: Write `history.mdx`** with these sections:
  - `## Before the Roman Martyrology` — what a martyrology is (a list of the saints by day, with their place and, increasingly, a short eulogy); the Hieronymian Martyrology from the Roman, African and Syriac calendars, later enlarged, with duplications and errors (2001 decree); the "historical" martyrologies of Bede, Florus, Ado and Usuard; Usuard's as the one most used in Rome (Baronius, *Tractatio*: quote one short Latin sentence with translation).
  - `## Gregory XIII and Baronius (1584–1589)` — the first edition of the Roman Martyrology under Gregory XIII in 1584 (2001 decree); Baronius's corrected edition with his *Notationes* and *Tractatio*; link `/read/martyrologium_romanum_1630` notes (`/read/martyrologium_romanum_1630/notes`).
  - `## Revisions to 1960` — Urban VIII (1630), Benedict XIV (1748–49; the 1749 edition on this site), later popes' additions; "revised, emended and enlarged up to 1960" (2001 decree). The 1914 English translation on this site.
  - `## The Second Vatican Council and the editio typica of 2001` — *Sacrosanctum Concilium* 92c (the passions and lives of the saints restored to historical truth); names and eulogies examined by historical method; saints and beati added (immemorial cult, or proclaimed after 1960); approved by John Paul II, promulgated 29 June 2001, Prot. N. 551/00/L. <Cite n="22" /> for the need of revision.
  - `## The editio typica altera of 2004` — Prot. N. 1140/04/L, 29 June 2004: new beati and saints of John Paul II, changes for saints whose mention had lapsed or was doubtful, Latin and spelling refined; conferences to prepare translations.
  - `## The vernacular editions` — the CEI Italian edition (confirmed 11 July 2006, Prot. N. 739/06/L; obligatory from 1 November 2006); the unofficial English text of 2004 on this site; link `/docs/en/editions`.
- [ ] **Step 2: Write `using.mdx`** with sections:
  - `## A liturgical book` — <Cite n="20-21" />, <Cite n="24-25" />; not an exhaustive catalogue of the saints nor long lives <Cite n="27-28" />.
  - `## Celebrating a saint of the day` — on weekdays that allow an optional memorial, the Mass and Office of a saint inscribed that day <Cite n="26" />, <Cite n="30" />; beati only where granted <Cite n="31" /> (link `/docs/en/particular-calendars`).
  - `## When it is read` — the eulogies of a day are read on the day before <Cite n="35" />; in choir is commendable, outside choir allowed <Cite n="36" />.
  - `## In the Liturgy of the Hours` — at Lauds after the concluding prayer; the reader alone begins with the announcement of the next day; ends *Pretiosa in conspectu Domini / mors sanctorum eius*; optional short reading with "Verbum Domini"; prayer by priest, deacon or lay leader; blessing and dismissal <Cite ordo n="1-4" />; or at a minor Hour, with *Pretiosa* and *Benedicamus Domino* <Cite ordo n="5-6" />.
  - `## Outside the Liturgy of the Hours` — assembled in choir, chapter room or refectory; same order <Cite ordo n="13-17" />.
  - `## Particular days` — movable celebrations announced first (the section "Elogia pro celebrationibus mobilibus" placed before the day's eulogies) <Cite ordo n="7" />; Easter Sunday's memorial before the next day's eulogies; omitted on Holy Thursday, Good Friday and Holy Saturday <Cite ordo n="8" />; Christmas Eve: the solemn proclamation of Christmas sung <Cite ordo n="9" />; the moon is optional <Cite ordo n="10" /> (link `/docs/en/lunar-table`); asterisked eulogies <Cite ordo n="11" /> (link `/docs/en/reading-a-day#asterisks`).
  - `## Transferred memorials` — what is said at the end of the eulogy when a memorial is transferred or relocated <Cite ordo n="12" /> — describe, do not reproduce the formulas.
- [ ] **Step 3: Write `particular-calendars.mdx`** with sections:
  - `## The General Calendar and the particular calendars` — the Martyrology lists those in the General Roman Calendar and many but not all of those of particular Churches and religious families <Cite n="29" />; each diocese and religious family has a proper calendar, conferences prepare national or regional ones; all agree with the Martyrology and are approved by the Apostolic See <Cite n="32" />; the 1970 Instruction *Calendaria particularia* (Sacred Congregation for Divine Worship, AAS 62 (1970) 651–663), cited throughout.
  - `## Saints and beati` — saints may be celebrated on their day where an optional memorial is allowed <Cite n="30" />; beati only in the diocese, nation, region or religious family granted the cult <Cite n="31" />; the asterisk marks this standing (link `/docs/en/reading-a-day#asterisks`).
  - `## When the dies natalis is impeded` — <Cite n="33" />: nearest free day, or a day connected to the saint (finding, elevation, translation; canonization or beatification less fitting); the eulogy then read with the transfer formula (link `/docs/en/using#transferred-memorials`).
  - `## Titulars of churches` — <Cite n="34" />.
  - `## The Propria of the Martyrology` — a diocese, nation or religious family may draw up a Proprium or Appendix: saints of its calendar absent from the Martyrology, on another day, of another rank, or with a fuller eulogy; sent for review and confirmation <Cite n="38" />; how such eulogies are written: the paschal victory of Christ, historical truth, no homiletic matter, about forty words <Cite n="39" />.
  - `## The editions of the conferences` — translations faithful and complete <Cite n="40" />; national eulogies first after those of the General Calendar, in the same type; diocesan ones in an appendix <Cite n="41" />; translations versus partial collections not for liturgical use <Cite n="42" />.
- [ ] **Step 4: Check every citation against `la-front.txt`** (grep the paragraph number; confirm the content). Fix any mismatch.
- [ ] **Step 5: Build** — `npm run build` → succeeds (an MDX syntax error fails here).
- [ ] **Step 6: Commit** — `git add content/docs/en/history.mdx content/docs/en/using.mdx content/docs/en/particular-calendars.mdx && git commit -m "Docs (en): history, use, particular calendars"` (+ trailer lines)

### Task 5: English — reading a day, lunar table

**Files:** Modify `content/docs/en/reading-a-day.mdx`, `content/docs/en/lunar-table.mdx`

- [ ] **Step 1: Write `reading-a-day.mdx`** with sections:
  - lead + `<SampleDay />`
  - `## The heading` — the Roman date: Kalends (1st), Nones (5th, or 7th in March, May, July, October), Ides (13th, or 15th); "pridie" and counting back inclusively ("quarto Nonas Ianuarii" = 2 January); the moon after the date (link `/docs/en/lunar-table`).
  - `## The order of the eulogies` — the celebrations of the General Calendar first, printed without a number in larger type; then the numbered eulogies in their order within the day (Praenotanda n. 29 speaks of "the number that designates the chronological order of the saints and beati within the day" — paraphrase); a eulogy is read the day before (link `/docs/en/using#when-it-is-read`).
  - `## Asterisks` — the asterisk after the number marks the particular or local standing of the older saints and of all the beati from the Middle Ages to modern times <Cite n="29" />; such eulogies are read only in the dioceses or religious families where that cult is granted <Cite ordo n="11" />. On this site: the asterisk is a per-edition mark; the Latin 2004 and the CEI Italian prints differ on 29 eulogies (23 asterisked only in the Latin, 6 only in the Italian), and each edition is shown as printed (link `/docs/en/notes-and-marks`).
  - `## Item, Eodem die, Ibidem` — "Item" and "Eodem die" begin another eulogy of the same day and do not inherit the previous eulogy's place; only "Ibidem" ("in the same place") does.
- [ ] **Step 2: Write `lunar-table.mdx`** with sections:
  - `## Why the moon is announced` — optional in the liturgical reading; Easter, Lent and Eastertide depend on the first full moon of spring; the bond between the people of the Old and the New Covenant; in use in the Eastern Churches and many cultures (section *De die lunari* / *Il giorno lunare*); optional <Cite ordo n="10" />.
  - `## The letters over each day` — thirty letters (the epact cycle) over each day's eulogies, each over a number, the day of the lunar month (series of 30 or 29).
  - `## Golden number, epact and letter` — golden number: a year's place in the 19-year lunar cycle = (year mod 19) + 1; epact: the 11-day difference between lunar and solar year — the moon's age at the start of the year; the letter of the Martyrology tied to the epact. Table of epact → letter: `*`→P; I–XV → a b c d e f g h i k l m n p q; XVI–XIX → r s t u; XX–XXIX → A B C D E F G H M N (XXV: F, printed twice, in black and red).
  - `## Finding the moon` — the 2005 example (golden number 11 → epact XIX → letter u; 1 January → 20; 2 August → 26); `<LunarFinder />`.
  - `## Two exceptions` — golden number 1: from 1 January to the end of that lunation announce one less than the table, except under capital P (example 2204: golden number 1, epact XXVIII, letter M: 1 January table 29 → announce 28; 2 January 30 → 29; 3 January 1); epact XXV: black F for golden numbers 12–19, red F for 1–11 (2011: golden number 17 → black F → 13 April moon 10). The Praenotanda's second example, "2303, golden number 9, epact XXV" (printed so in both the Latin and the CEI), is a source error: by the Praenotanda's own rule 2303 has golden number 5 and epact XI; the year that has golden number 9 and epact XXV is 2307 (red F → 9). Give the example as 2307 and say, in one sentence, that the book prints 2303.
  - `## How long a table lasts` — the printed 2004–2033 table; letters valid to 2199; the arithmetic of the footnotes (golden number; epact for 2004–2099: 11 × golden number, then 13 and 1; for 2100–2199, 14 and 2), and the 2200–2299 table built the same way (example 2248: golden number 7, epact IV, letter d).
  - `## The printed tables on this site` — 1630 sets the 31 columns in rows of 17 + 14, 2004 in 19 + 12; the reader shows a day's table under its heading with the year's column marked (link `/read/martyrologium_romanum_2004`).
- [ ] **Step 3: Verify the arithmetic.** For each example (2004, 2005, 2006, 2011, 2014, 2204, 2248, 2303, 2307) query the API and compare golden number, epact and letter with the text:
  ```bash
  for y in 2004 2005 2006 2011 2014 2204 2248 2303 2307; do curl -s "https://romanmartyrology.com/api/mr/elogia/edition/martyrologium_romanum_2004/01/01?year=$y" | python3 -c "import json,sys; d=json.load(sys.stdin); a=(d.get('luna') or d.get('content',{}).get('luna') or {}).get('annuntiatio'); print($y, a and (a['golden_number'], a['epact'], a['letter'], a['age']))"; done
  ```
  Expected: 2004 (10, VIII, h), 2005 (11, XIX, u, 20), 2006 (12, *, P), 2011 (17, XXV, F), 2014 (1, XXIX, N), 2204 (1, XXVIII, M, 28), 2248 (7, IV, d), 2303 (5, XI, l), 2307 (9, XXV, F). Report any disagreement between the API and the Praenotanda to the user before writing it either way.
- [ ] **Step 4: Check citations against `la-front.txt`.**
- [ ] **Step 5: Build** — `npm run build` → succeeds.
- [ ] **Step 6: Commit** — `git add content/docs/en/reading-a-day.mdx content/docs/en/lunar-table.mdx && git commit -m "Docs (en): reading a day, the lunar table"` (+ trailer lines)

### Task 6: English — editions, notes and marks

**Files:** Modify `content/docs/en/editions.mdx`, `content/docs/en/notes-and-marks.mdx`

- [ ] **Step 1: Write `editions.mdx`.** Get the list from the API and describe each edition in a table (year, title, language, nature via `natureLabel`, availability) and a short paragraph each:
  ```bash
  curl -s https://romanmartyrology.com/api/mr/editions | python3 -m json.tool
  ```
  Explain "editio typica" (the Latin text of reference), "editio vernacula" (an approved translation), unofficial translation; that the 2004 texts are shown under a policy the site can change (currently readable by anyone); that the bookshelf on the home page lists them newest to oldest.
- [ ] **Step 2: Write `notes-and-marks.mdx`** with sections, each with a short illustration in an HTML-like snippet using the same classes the reader uses is **not** needed — describe them in words and link a real day:
  - `## What the edition prints` — footnotes (marks as printed, notes at the foot of the page) and marginalia (Baronius's side-notes referring to his *Annales*), in the edition's own language; find an example day with `curl` on `/api/mr/elogia/edition/martyrologium_romanum_1630/<mm>/<dd>` having non-empty `footnotes` or `marginalia`, and link it.
  - `## The edition's own errata` — corrections the edition itself prints in its errata list, shown after the words they concern as "[Errata: …]" in brown; the erratum as printed and its place show on hover or focus.
  - `## Misprints found by the curators` — verified misprints the edition does **not** correct itself, shown as "[sic! expected: …]" in grey; one word or a phrase of up to three words; recorded in crmedr `data/misprints.json`.
  - `## Curator notes` — a red dagger † in the text, the note in English at the foot of the page: source errors, identity decisions, links to other eulogies (the IDs in a note link to them).
  - `## The notes page of an edition` — `/read/<edition>/notes` gathers the notes, misprints and errata of the whole edition, each with its eulogy as printed and a link to its day; filters by kind.
- [ ] **Step 3: Build; commit** — `npm run build`; `git add content/docs/en/editions.mdx content/docs/en/notes-and-marks.mdx && git commit -m "Docs (en): the editions, notes and marks"` (+ trailer lines)

### Task 7: English — IDs, data, contributing, index

**Files:** Modify `content/docs/en/ids.mdx`, `content/docs/en/data.mdx`, `content/docs/en/contributing.mdx`, `content/docs/en/index.mdx`

- [ ] **Step 1: Read the ID rules reference** with the Claude Docs `read` tool (doc `f627639e-ad7c-48d8-8015-c5880dfc4502`) and `../crmedr/docs/canonicalization-report.md` (identity sections).
- [ ] **Step 2: Write `ids.mdx`**, opening with `<Banner>All IDs are drafts pending review by the committee; the `mr:` prefix and the anchor edition may still change.</Banner>`, then sections:
  - `## Why identifiers` — cite one eulogy across editions and languages; link data (places, subjects, notes); stable when texts are corrected.
  - `## The form mr:MMDD-slug` — MMDD: the day the editio altera 2004 prints it; slug: the first-named subject's Latin nominative, ASCII-folded, lowercase, no honorifics; examples `mr:0102-telesphorus`, `mr:0102-basilius-magnus-et-gregorius-nazianzenus`.
  - `## What is and is not identity` — the day is identity; entry number, asterisk and unnumbered status are per-edition attributes; a eulogy an edition prints on another day has its own ID there, linked by `same_eulogy`.
  - `## Building the slug` — pairs `-et-<second>`; three or more `-et-socii`; anonymous groups `[number-]class-<place in the genitive>` (`mr:0309-quadraginta-milites-sebastes`) or `martyres-` + the group's name (`mr:0717-martyres-scillitani`); feasts (drop sancti/sanctae except church names, Holy Cross, All Saints, beatae-mariae); prophets keep `-propheta`, the Twelve `-apostolus`; one name form (religious name or name + surname); papal ordinals in roman numerals; no bare names: surname → place (genitive) → epithet.
  - `## Deprecated IDs` — IDs for eulogies of older editions not in 2004 (or printed on another day), `deprecated`, `attested_in`, `same_eulogy`; never reused.
  - `## Recognizability` — the aim: a reader recognizes the eulogy from its ID; reviewers judge this (link `/docs/en/contributing`).
- [ ] **Step 3: Write `data.mdx`** — sections `## The registry (CRMEDR)` (the public repository `https://github.com/CatholicOS/crmedr`: IDs, subjects in Latin/Italian/English, typology, places, gazetteer resolving places to Wikidata, misprints, curator notes); `## What is not in it` (the copyrighted eulogy texts; only place designations quoted as facts); `## The API` (link `/scalar`).
- [ ] **Step 4: Write `contributing.mdx`** — lead inviting scholars and students; `## What needs review` with the list: the eulogy texts against the printed originals; misprints not yet detected; the IDs — their conformity to the rules (link `/docs/en/ids`) and whether a eulogy is recognizable from its ID; eulogies that may still be run together and need splitting; subject labels in Latin, Italian and English; places and their identification; anything else that is wrong. `## How` — "Curation tools for enabled users are coming soon to this site. This page will link them when they are ready." No other channel.
- [ ] **Step 5: Write `index.mdx`** — the `# Documentation` heading and a short introduction to the two parts (the parts and page list are rendered by the route after it).
- [ ] **Step 6: Build; commit** — `npm run build`; `git add content/docs/en && git commit -m "Docs (en): IDs, data, contributing, index"` (+ trailer lines)

### Task 8: Checkpoint — the user reviews the English

- [ ] **Step 1:** Run `npm run dev`, open `/docs/en` and every page; check anchors (`/docs/en/reading-a-day#asterisks`), the LunarFinder against the dev API, phone width (375px) with the Contents toggle.
- [ ] **Step 2:** Push the branch and tell the user the English pages are ready for review (list the pages). **Stop until the user has reviewed;** apply their corrections and commit them before Task 9.

### Task 9: Italian translation

**Files:** Modify every `content/docs/it/*.mdx`

- [ ] **Step 1:** Translate each reviewed English page into Italian, keeping the same `##` structure (anchors will differ by language — update internal links to the Italian anchors: e.g. `/docs/it/reading-a-day#asterischi`), `<Cite …/>` calls unchanged (they render "Premesse"/"Rito"), and `/docs/it/...` links. Italian may quote the CEI Premesse in short phrases in quotation marks with a citation (e.g. n. 29's "statuto particolare o locale"); never a whole paragraph.
- [ ] **Step 2:** Use the CEI terms throughout: *elogio/elogi*, *giorno natalizio*, *Calendario Proprio*, *Proprio del Martirologio*, *Appendice*, *numero aureo*, *epatta*, *lettera del Martirologio*, *Preziosa agli occhi del Signore*.
- [ ] **Step 3:** For each Italian heading, check every link to it from other Italian pages resolves (grep `#` links in `content/docs/it` against `headingId` of the target headings).
- [ ] **Step 4: Build; commit** — `npm run build`; `git add content/docs/it && git commit -m "Docs (it): traduzione italiana"` (+ trailer lines)

### Task 10: Final verification and PR

- [ ] **Step 1:** `npm run lint && npm test && npm run build` — all pass; 22 docs paths prerendered.
- [ ] **Step 2:** Rerun Task 2 Step 12's smoke check on the standalone build.
- [ ] **Step 3:** Copyright sweep: for each `content/docs/**/*.mdx`, confirm no run of 8+ consecutive words matches the 2004 Latin, CEI or English texts:
  ```bash
  python3 - <<'EOF'
  import json, pathlib, re
  texts = pathlib.Path("../martyrology-texts/data/editions")
  corpus = " ".join(re.sub(r"\s+", " ", json.dumps(json.load(open(f)), ensure_ascii=False)).lower()
                    for f in texts.glob("martyrologium_romanum_2004*/*.json"))
  for md in pathlib.Path("content/docs").rglob("*.mdx"):
      words = re.findall(r"\w+", md.read_text().lower())
      hits = {" ".join(words[i:i+8]) for i in range(len(words)-7) if " ".join(words[i:i+8]) in corpus}
      if hits: print(md, sorted(hits)[:5])
  EOF
  ```
  Expected: no output. (This checks the eulogy texts; the Praenotanda are checked by the paraphrase rule in review.)
- [ ] **Step 4:** Push and open the PR against `main` with a summary of the pages, the components, the test plan, and the line `🤖 Generated with [Claude Code](https://claude.com/claude-code)` followed by `https://claude.ai/code/session_01CnuHJ4WRgN2JcuYrZtyuTL`.
