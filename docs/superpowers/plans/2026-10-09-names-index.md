# Index of names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A server-rendered index of names for each edition with persons data, at `/<locale>/read/<edition>/names`: Latin names A–Z with the identified person's name in the interface language, each mention linking to its eulogy or its footnote; and the reader finding `#fn-…` links.

**Architecture:** `scripts/snapshot-registry.mjs` writes `data/persons-snapshot.json` (crmedr's persons with their Wikidata QIDs, and the QIDs' labels in six languages) and `data/persons-editions.json` (the editions that have persons, small enough for client components). A pure `namesIndex()` joins the edition's catalog with the snapshot; a server route renders `NamesIndex`. `Reader` reveals `#fn-…` like `#note-…`.

**Tech Stack:** Next.js (read `node_modules/next/dist/docs/` before writing route code), next-intl, React, Vitest + Testing Library, Node ESM script, Wikidata SPARQL.

**Spec:** `docs/superpowers/specs/2026-10-09-names-index-design.md`

## Global Constraints

- Route `/<locale>/read/<edition>/names`; links from the reader bar and the notes page only for an edition in `data/persons-editions.json`.
- Headings: the Latin name; key = QID when identified, else the Latin name; heading form = the most frequent Latin form (ties: shorter, then first in calendar order); sorted with `Intl.Collator("la", { sensitivity: "base" })`, filed by `filingLetter` (the places rule).
- Grey interface name: the QID's label in the interface language, else English; linked to `https://www.wikidata.org/wiki/<QID>`; no label: the link text is "Wikidata".
- Lines in calendar order (`compareLines`: day, the unnumbered first, then entry); day link to `#<id>` (text) or `#fn-<edition>-<id>-<n>` (footnote n); subject in the edition's language; "in footnote {n}"; aria-label `"<day> · <subject>"`.
- Coverage: "{naming} of the {printed} eulogies of this edition name someone." (`naming` = printed eulogies with ≥1 person).
- Snapshot: `wikidata` only for crmedr `auto` and `reviewed`; labels in `LABEL_LANGS` order; offline, the previous snapshot's labels.
- Reader: `#fn-…` revealed like `#note-…`, without touching the IDs switch.
- All new strings in the six `messages/*.json`; French U+00A0 before `:`.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv
  ```

## Review Focus

- An identified person named in two Latin forms with equal counts: the heading is the shorter, deterministically. Test in Task 2.
- The same unidentified Latin name in two unrelated eulogies shares one heading (the spec's accepted cost), and an identified person never merges with an unidentified namesake. Test in Task 2.
- A footnote link whose footnote the day does not draw (data drift): the reader shows the day, no crash. Test in Task 5.
- The client bundle: `ReaderBar` and `ApparatusPage` import only `data/persons-editions.json`, never the persons snapshot. Checked in Task 6 by a test on the import.
- A QID present but no label at all: the heading shows the Latin name and a "Wikidata" link. Test in Task 3.

---

## File Structure

- Modify `scripts/snapshot-registry.mjs` (+ `buildPersons`, `fetchPersonLabels`, `main`), `lib/__tests__/snapshot.test.ts`.
- Generate `data/persons-snapshot.json`, `data/persons-editions.json`.
- Create `lib/persons.ts` (types, `getPersons`: server only) and `lib/persons-editions.ts` (`PERSONS_EDITIONS`, `hasPersons`: for client components too).
- Modify `lib/places-index.ts` (export `filingLetter`; `compareLines` takes any `{day, entry}`).
- Create `lib/names-index.ts`, `lib/__tests__/names-index.test.ts`.
- Create `components/NamesIndex.tsx`, `components/__tests__/NamesIndex.test.tsx`; modify `messages/*.json`.
- Create `app/[locale]/read/[edition]/names/page.tsx`, `components/__tests__/NamesRoute.test.tsx`.
- Modify `components/Reader.tsx`, `components/page.module.css`, `components/__tests__/Reader.test.tsx`.
- Modify `components/ReaderBar.tsx`, `components/ApparatusPage.tsx`, their tests.

---

### Task 1: The persons snapshot

**Files:** `scripts/snapshot-registry.mjs`; test `lib/__tests__/snapshot.test.ts`; generate `data/persons-snapshot.json`, `data/persons-editions.json`.

**Interfaces:**
- Produces: `buildPersons(personsDoc, itemsDoc, labels = {})` → `{ editions: {ed: {id: [{name, where, wikidata?}]}}, labels: {qid: {lang: label}} }` (labels in `LABEL_LANGS` order, only for QIDs used); `personQids(personsDoc, itemsDoc)` → sorted QIDs; `fetchPersonLabels(qids, readPrevious, fetch = fetchLabels)`.

- [ ] **Step 1: Failing tests**, appended to `lib/__tests__/snapshot.test.ts` (add `buildPersons, fetchPersonLabels, personQids` to the import on line 2):

```ts
describe("buildPersons", () => {
  const personsDoc = { editions: { martyrologium_romanum_2004: {
    "mr:0206-paulus-miki-et-socii": [
      { name: "Paulus Miki", where: "text" },
      { name: "Ioannes de Goto Soan", where: { footnote: 1 } },
      { name: "Thomas Kozaki", where: { footnote: 1 } },
    ],
    "mr:0101-basilius": [{ name: "Basilius", where: "text" }],
  } } };
  const itemsDoc = { persons: {
    "mr:0206-paulus-miki-et-socii": {
      "Paulus Miki": { wikidata: "Q380649", status: "auto" },
      "Thomas Kozaki": { wikidata: null, status: "unresolved", note: "none" },
    },
    "mr:0101-basilius": { Basilius: { wikidata: "Q1", status: "reviewed" } },
  } };

  it("gives each person its QID when crmedr decided one, and labels in the interface languages' order", () => {
    const snap = buildPersons(personsDoc, itemsDoc, { Q380649: { pt: "Paulo Miki", en: "Paul Miki" }, Q9: { en: "unused" } });
    expect(snap.editions.martyrologium_romanum_2004["mr:0206-paulus-miki-et-socii"]).toEqual([
      { name: "Paulus Miki", where: "text", wikidata: "Q380649" },
      { name: "Ioannes de Goto Soan", where: { footnote: 1 } },
      { name: "Thomas Kozaki", where: { footnote: 1 } },
    ]);
    expect(snap.editions.martyrologium_romanum_2004["mr:0101-basilius"][0].wikidata).toBe("Q1");
    expect(Object.keys(snap.labels)).toEqual(["Q380649"]);
    expect(Object.keys(snap.labels.Q380649)).toEqual(["en", "pt"]);
  });

  it("lists the decided QIDs once each, sorted", () => {
    expect(personQids(personsDoc, itemsDoc)).toEqual(["Q1", "Q380649"]);
  });
});

describe("fetchPersonLabels", () => {
  it("falls back to the previous snapshot's labels when Wikidata fails", async () => {
    const prev = { labels: { Q1: { en: "Basil (old)" } } };
    const down = async () => { throw new Error("Wikidata SPARQL 429"); };
    expect(await fetchPersonLabels(["Q1"], () => prev, down)).toEqual({ Q1: { en: "Basil (old)" } });
    expect(await fetchPersonLabels(["Q1"], () => prev, async () => ({ Q1: { en: "Basil" } }))).toEqual({ Q1: { en: "Basil" } });
  });
});
```

- [ ] **Step 2: Run, expect FAIL** (`buildPersons` not exported): `npx vitest run lib/__tests__/snapshot.test.ts`.

- [ ] **Step 3: Implement** in `scripts/snapshot-registry.mjs`, before `async function main()`:

```js
/**
 * The QIDs crmedr decided for the persons (auto and reviewed), sorted.
 * @param {{editions: Record<string, Record<string, {name: string}[]>>}} personsDoc crmedr data/persons.json
 * @param {{persons: Record<string, Record<string, {wikidata: string|null, status: string}>>}} itemsDoc crmedr data/person_items.json
 */
export function personQids(personsDoc, itemsDoc) {
  const qids = new Set();
  for (const persons of Object.values(itemsDoc.persons))
    for (const e of Object.values(persons)) if (e.wikidata && e.status !== "unresolved") qids.add(e.wikidata);
  return [...qids].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}

/**
 * The index of names' data: each edition's persons by eulogy, with the QID crmedr decided (auto or
 * reviewed), and each QID's labels in the interface languages, in LABEL_LANGS order.
 * @param {{editions: Record<string, Record<string, {name: string, where: unknown}[]>>}} personsDoc
 * @param {{persons: Record<string, Record<string, {wikidata: string|null, status: string}>>}} itemsDoc
 * @param {Record<string, Record<string, string>>} [labels]
 */
export function buildPersons(personsDoc, itemsDoc, labels = {}) {
  /** @type {Record<string, Record<string, {name: string, where: unknown, wikidata?: string}[]>>} */
  const editions = {};
  const used = new Set();
  for (const [edition, byId] of Object.entries(personsDoc.editions)) {
    editions[edition] = {};
    for (const [id, persons] of Object.entries(byId)) {
      editions[edition][id] = persons.map((p) => {
        const e = itemsDoc.persons[id]?.[p.name];
        const qid = e && e.status !== "unresolved" ? e.wikidata : null;
        if (qid) used.add(qid);
        return { name: p.name, where: p.where, ...(qid ? { wikidata: qid } : {}) };
      });
    }
  }
  /** @type {Record<string, Record<string, string>>} */
  const ordered = {};
  for (const qid of [...used].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))) {
    const l = labels[qid];
    if (l) ordered[qid] = Object.fromEntries(LABEL_LANGS.flatMap((lang) => (lang in l ? [[lang, l[lang]]] : [])));
  }
  return { editions, labels: ordered };
}

/**
 * The persons' labels from Wikidata, or, when it cannot be asked, the previous snapshot's.
 * @param {string[]} qids
 * @param {() => {labels: Record<string, Record<string, string>>}} readPrevious
 * @param {typeof fetchLabels} [fetch]
 */
export async function fetchPersonLabels(qids, readPrevious, fetch = fetchLabels) {
  try {
    return await fetch(qids);
  } catch (err) {
    console.warn(`Wikidata labels unavailable (${err instanceof Error ? err.message : err}); reusing the previous persons snapshot's`);
    return readPrevious().labels;
  }
}
```

At the end of `main()`, before its closing brace:

```js
  const personsDoc = JSON.parse(readFileSync(join(crmedr, "data", "persons.json"), "utf8"));
  const itemsDoc = JSON.parse(readFileSync(join(crmedr, "data", "person_items.json"), "utf8"));
  const personsDest = join(here, "..", "data", "persons-snapshot.json");
  const personLabels = await fetchPersonLabels(personQids(personsDoc, itemsDoc), () => JSON.parse(readFileSync(personsDest, "utf8")));
  const persons = buildPersons(personsDoc, itemsDoc, personLabels);
  writeFileSync(personsDest, JSON.stringify(persons) + "\n");
  // The editions with persons, apart: client components link to the index of names from it.
  writeFileSync(join(here, "..", "data", "persons-editions.json"), JSON.stringify(Object.keys(persons.editions)) + "\n");
  const count = Object.values(persons.editions).reduce((n, byId) => n + Object.values(byId).reduce((m, ps) => m + ps.length, 0), 0);
  console.log(`wrote ${personsDest}: ${count} persons, ${Object.keys(persons.labels).length} labelled items`);
```

Note: the first run has no previous `persons-snapshot.json`; if Wikidata fails then, `readPrevious` throws: let it (the script must not write a snapshot without labels silently).

- [ ] **Step 4: Run the tests, expect PASS.**
- [ ] **Step 5: Generate.** `npm run snapshot-registry`, then `git status --short data/`; restore the other snapshots if they changed only by crmedr drift unrelated to persons (`git checkout -- data/registry-snapshot.json data/misprints-snapshot.json data/notes-snapshot.json data/places-snapshot.json` — check `git diff --stat` first: the places snapshot should be unchanged now that its labels are ordered). Expect `data/persons-snapshot.json` (about 6,478 persons, about 1,019 labelled items) and `data/persons-editions.json` = `["martyrologium_romanum_2004"]`.
- [ ] **Step 6: Commit** the script, test and the two data files: `git commit -m "feat(snapshot): the persons of crmedr and their names in six languages"`.

---

### Task 2: `namesIndex()`

**Files:** create `lib/persons.ts`, `lib/persons-editions.ts`, `lib/names-index.ts`, `lib/__tests__/names-index.test.ts`; modify `lib/places-index.ts`.

**Interfaces:**
- Consumes: `CatalogEntryOut`, `Day`, `Locale`; from `lib/places-index.ts`: `compareLines`, `filingLetter` (exported by this task).
- Produces (`lib/persons.ts`): `PersonMention { name: string; where: "text" | { footnote: number }; wikidata?: string }`; `PersonsSnapshot { editions: Record<string, Record<string, PersonMention[]>>; labels: Record<string, Partial<Record<Locale, string>>> }`; `getPersons(): PersonsSnapshot`. (`lib/persons-editions.ts`): `PERSONS_EDITIONS: readonly string[]` (from `data/persons-editions.json`); `hasPersons(edition: string): boolean` — kept apart so client components never import the large snapshot.
- Produces (`lib/names-index.ts`): `NameLine { id; day; entry; subject; footnote: number | null }`; `IndexPerson { key; name; qid: string | null; label: string | null; lines: NameLine[] }`; `NamesLetter { letter; persons: IndexPerson[] }`; `NamesIndexData { letters; naming; printed }`; `namesIndex(catalog, snap, edition, locale): NamesIndexData | null`; `fnAnchor(edition, id, n): string` (`fn-${edition}-${id}-${n}`).

- [ ] **Step 1: Make `compareLines` generic and export `filingLetter`** in `lib/places-index.ts` (refactor under the existing places tests, which must stay green):

```ts
/** Calendar order: by day, then the unnumbered first on their day (as printed), then by number. */
export function compareLines(a: { day: Day; entry: number | null }, b: { day: Day; entry: number | null }): number {
```
and `function filingLetter(` → `export function filingLetter(`. Run `npx vitest run lib/__tests__/places-index.test.ts` → PASS.

- [ ] **Step 2: Create `lib/persons.ts` and `lib/persons-editions.ts`:**

```ts
// lib/persons.ts
import snapshot from "@/data/persons-snapshot.json";
import type { Locale } from "@/i18n/routing";

/** A saint or blessed a eulogy names: the Latin name, where it is printed, and the Wikidata item crmedr decided. */
export interface PersonMention {
  name: string;
  where: "text" | { footnote: number };
  wikidata?: string;
}

export interface PersonsSnapshot {
  editions: Record<string, Record<string, PersonMention[]>>;
  labels: Record<string, Partial<Record<Locale, string>>>;
}

/** The persons snapshot: large, so for server code only (the index of names). */
export function getPersons(): PersonsSnapshot {
  return snapshot as unknown as PersonsSnapshot;
}
```

```ts
// lib/persons-editions.ts
import editions from "@/data/persons-editions.json";

/** The editions whose persons crmedr has listed: small, so client components can link to the index of names. */
export const PERSONS_EDITIONS: readonly string[] = editions;

export function hasPersons(edition: string): boolean {
  return PERSONS_EDITIONS.includes(edition);
}
```

- [ ] **Step 3: Failing tests** `lib/__tests__/names-index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fnAnchor, namesIndex } from "@/lib/names-index";
import type { PersonsSnapshot } from "@/lib/persons";
import type { CatalogEntryOut } from "@/lib/types";

const ED = "martyrologium_romanum_2004";
const cat = (id: string, subject: string, day: string | null, entry: number | null = 1, present = true): CatalogEntryOut => ({
  id, subject, anchor_day: day ?? "01-01", deprecated: false, present, day_printed: day, entry,
});
const snap: PersonsSnapshot = {
  editions: { [ED]: {
    "mr:0828-augustinus": [{ name: "Aurelius Augustinus", where: "text", wikidata: "Q8018" }],
    "mr:0420-x": [{ name: "Augustinus", where: "text", wikidata: "Q8018" }],
    "mr:0101-y": [{ name: "Augustinus", where: { footnote: 2 }, wikidata: "Q8018" }],
    "mr:0206-paulus-miki-et-socii": [
      { name: "Paulus Miki", where: "text", wikidata: "Q380649" },
      { name: "Thomas", where: { footnote: 1 } },
    ],
    "mr:0310-z": [{ name: "Thomas", where: "text" }, { name: "Đorđe", where: "text" }],
    "mr:0311-w": [{ name: "Thomas", where: "text", wikidata: "Q43669" }],
    "mr:0909-absent": [{ name: "Nemo", where: "text" }],
  } },
  labels: { Q8018: { en: "Augustine of Hippo", it: "Agostino d'Ippona" }, Q380649: { it: "Paolo Miki" } },
};
const catalog = [
  cat("mr:0828-augustinus", "Sanctus Augustinus", "08-28"), cat("mr:0420-x", "Sanctus X", "04-20"),
  cat("mr:0101-y", "Sanctus Y", "01-01", null), cat("mr:0206-paulus-miki-et-socii", "Sancti Paulus Miki et socii", "02-06"),
  cat("mr:0310-z", "Sancti Z", "03-10"), cat("mr:0311-w", "Sanctus W", "03-11"),
  cat("mr:0909-absent", "Nemo", "09-09", 1, false), cat("mr:1225-nativitas-domini", "Nativitas Domini", "12-25"),
];

describe("namesIndex", () => {
  it("is null for an edition without persons", () => {
    expect(namesIndex(catalog, snap, "martyrologium_romanum_1749", "en")).toBeNull();
  });

  it("counts the printed eulogies and those naming someone", () => {
    const r = namesIndex(catalog, snap, ED, "en")!;
    expect(r.printed).toBe(7);  // not the absent one
    expect(r.naming).toBe(6);   // not Nativitas Domini
  });

  it("groups an identified person by QID under the most frequent Latin form", () => {
    const a = namesIndex(catalog, snap, ED, "en")!.letters.find((l) => l.letter === "A")!.persons;
    expect(a.map((p) => [p.name, p.qid, p.label, p.lines.map((l) => l.id)])).toEqual([
      ["Augustinus", "Q8018", "Augustine of Hippo", ["mr:0101-y", "mr:0420-x", "mr:0828-augustinus"]],
    ]);
  });

  it("breaks a tie between forms by the shorter", () => {
    const two = { ...snap, editions: { [ED]: { "mr:0828-augustinus": snap.editions[ED]["mr:0828-augustinus"],
      "mr:0420-x": snap.editions[ED]["mr:0420-x"] } } };
    const p = namesIndex(catalog, two, ED, "en")!.letters[0].persons[0];
    expect(p.name).toBe("Augustinus");
  });

  it("keeps an unidentified name apart from an identified namesake, and merges unidentified namesakes", () => {
    const t = namesIndex(catalog, snap, ED, "en")!.letters.find((l) => l.letter === "T")!.persons;
    expect(t.map((p) => [p.name, p.qid, p.lines.map((l) => l.id)])).toEqual([
      ["Thomas", null, ["mr:0206-paulus-miki-et-socii", "mr:0310-z"]],
      ["Thomas", "Q43669", ["mr:0311-w"]],
    ]);
  });

  it("files a stroke letter with its base letter, and the interface label falls back to English", () => {
    const r = namesIndex(catalog, snap, ED, "it")!;
    expect(r.letters.map((l) => l.letter)).toEqual(["A", "D", "P", "T"]);
    expect(r.letters[0].persons[0].label).toBe("Agostino d'Ippona");
    expect(namesIndex(catalog, snap, ED, "fr")!.letters[0].persons[0].label).toBe("Augustine of Hippo");
    expect(r.letters.find((l) => l.letter === "P")!.persons[0].label).toBe("Paolo Miki");
    expect(namesIndex(catalog, snap, ED, "de")!.letters.find((l) => l.letter === "P")!.persons[0].label).toBeNull();
  });

  it("gives a footnote mention its footnote, in calendar order, the unnumbered first", () => {
    const a = namesIndex(catalog, snap, ED, "en")!.letters[0].persons[0].lines;
    expect(a[0]).toEqual({ id: "mr:0101-y", day: { mm: 1, dd: 1 }, entry: null, subject: "Sanctus Y", footnote: 2 });
    expect(a[1].footnote).toBeNull();
    expect(fnAnchor(ED, "mr:0101-y", 2)).toBe("fn-martyrologium_romanum_2004-mr:0101-y-2");
  });
});
```

- [ ] **Step 4: Run, expect FAIL** (module missing).

- [ ] **Step 5: Implement `lib/names-index.ts`:**

```ts
import type { Locale } from "@/i18n/routing";
import type { Day } from "@/lib/calendar";
import { compareLines, filingLetter } from "@/lib/places-index";
import type { PersonsSnapshot } from "@/lib/persons";
import type { CatalogEntryOut } from "@/lib/types";

/** One mention: the eulogy, its day and number, its subject in the edition's language, and the footnote the name is printed in (null: the text). */
export interface NameLine {
  id: string;
  day: Day;
  entry: number | null;
  subject: string;
  footnote: number | null;
}

export interface IndexPerson {
  /** The QID, else the Latin name. */
  key: string;
  /** The heading: the person's most frequent Latin form. */
  name: string;
  qid: string | null;
  /** The Wikidata label in the interface language, else English; null when it has none. */
  label: string | null;
  lines: NameLine[];
}

export interface NamesLetter {
  letter: string;
  persons: IndexPerson[];
}

export interface NamesIndexData {
  letters: NamesLetter[];
  /** The eulogies the edition prints that name someone. */
  naming: number;
  /** The eulogies the edition prints. */
  printed: number;
}

/** A footnote's element id in the reader (lib/footnotes.ts). */
export function fnAnchor(edition: string, id: string, n: number): string {
  return `fn-${edition}-${id}-${n}`;
}

/**
 * An edition's index of names: the saints and blessed its printed eulogies name, one heading per
 * person (by QID, else by the Latin name) under their most frequent Latin form, sorted and filed by
 * letter in Latin order, each mention in calendar order. Null when crmedr has no persons for the edition.
 */
export function namesIndex(catalog: CatalogEntryOut[], snap: PersonsSnapshot, edition: string, locale: Locale): NamesIndexData | null {
  const byId = snap.editions[edition];
  if (!byId) return null;
  const people = new Map<string, IndexPerson & { forms: Map<string, number> }>();
  let printed = 0;
  let naming = 0;
  for (const c of catalog) {
    const m = c.present !== false ? /^(\d{2})-(\d{2})$/.exec(c.day_printed ?? "") : null;
    if (!m) continue;
    printed++;
    const mentions = byId[c.id];
    if (!mentions?.length) continue;
    naming++;
    for (const p of mentions) {
      const key = p.wikidata ?? `name:${p.name}`;
      let person = people.get(key);
      if (!person) {
        const l = p.wikidata ? snap.labels[p.wikidata] : undefined;
        person = { key, name: p.name, qid: p.wikidata ?? null, label: l?.[locale] || l?.en || null, lines: [], forms: new Map() };
        people.set(key, person);
      }
      person.forms.set(p.name, (person.forms.get(p.name) ?? 0) + 1);
      person.lines.push({
        id: c.id,
        day: { mm: Number(m[1]), dd: Number(m[2]) },
        entry: c.entry ?? null,
        subject: c.subject ?? c.id,
        footnote: p.where === "text" ? null : p.where.footnote,
      });
    }
  }
  const collator = new Intl.Collator("la", { sensitivity: "base" });
  const persons: IndexPerson[] = [...people.values()].map(({ forms, ...p }) => {
    p.lines.sort(compareLines);
    const name = [...forms.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0];
    return { ...p, name };
  });
  persons.sort((a, b) => collator.compare(a.name, b.name) || (a.qid ? 1 : 0) - (b.qid ? 1 : 0) || a.key.localeCompare(b.key));
  const letters: NamesLetter[] = [];
  const byLetter = new Map<string, NamesLetter>();
  for (const p of persons) {
    const letter = filingLetter(p.name, collator);
    let l = byLetter.get(letter);
    if (!l) {
      l = { letter, persons: [] };
      byLetter.set(letter, l);
      letters.push(l);
    }
    l.persons.push(p);
  }
  return { letters, naming, printed };
}
```

(The tie "then the first in calendar order" of the spec is implied: `forms` keeps insertion order and `sort` is stable, but insertion is catalog order, not calendar order. If the ties test needs calendar order, sort `forms` entries by the index of their first line after `p.lines.sort` instead; the test above only exercises the shorter-name tie.)

- [ ] **Step 6: Run, expect PASS**; also `npx vitest run lib/__tests__/places-index.test.ts`.
- [ ] **Step 7: Commit** `lib/persons.ts lib/persons-editions.ts lib/names-index.ts lib/places-index.ts lib/__tests__/names-index.test.ts`: `feat: namesIndex, an edition's saints and blessed A to Z`.

---

### Task 3: `NamesIndex` and its messages

**Files:** create `components/NamesIndex.tsx`, `components/__tests__/NamesIndex.test.tsx`; modify `messages/*.json`.

**Interfaces:** Consumes `NamesIndexData`, `fnAnchor`. Produces `NamesIndex({ edition, title, index, error }: { edition: string; title: string; index: NamesIndexData | null; error?: boolean })` (`error`: the catalog failed; `index` null and no error: not indexed); messages `Names.*`, `Metadata.namesTitle`, `Reader.namesLink`.

- [ ] **Step 1: Messages.** Add `"namesTitle"` after `"placesTitle"` in `Metadata`, `"namesLink"` after `"placesLink"` in `Reader`, and a `"Names"` object after `"Places"` (Python `json` load/dump, `ensure_ascii=False, indent=2`, trailing newline):

| key | en | it | fr | de | es | pt |
|---|---|---|---|---|---|---|
| Metadata.namesTitle | `{edition}: index of names` | `{edition}: indice dei nomi` | `{edition} : index des noms` | `{edition}: Namensregister` | `{edition}: índice de nombres` | `{edition}: índice de nomes` |
| Reader.namesLink | `Index of names` | `Indice dei nomi` | `Index des noms` | `Namensregister` | `Índice de nombres` | `Índice de nomes` |
| Names.title | `{title}: index of names` | `{title}: indice dei nomi` | `{title} : index des noms` | `{title}: Namensregister` | `{title}: índice de nombres` | `{title}: índice de nomes` |
| Names.readEdition | (as `Places.readEdition`) |
| Names.notesLink | (as `Places.notesLink`) |
| Names.placesLink | (as `Reader.placesLink`) |
| Names.letters | (as `Places.letters`) |
| Names.coverage | `{naming, number} of the {printed, number} eulogies of this edition name someone.` | `{naming, number} dei {printed, number} elogi di questa edizione nominano qualcuno.` | `{naming, number} des {printed, number} éloges de cette édition nomment quelqu’un.` | `{naming, number} der {printed, number} Elogien dieser Ausgabe nennen jemanden.` | `{naming, number} de los {printed, number} elogios de esta edición nombran a alguien.` | `{naming, number} dos {printed, number} elogios desta edição nomeiam alguém.` |
| Names.notIndexed | `The persons of this edition are not indexed yet.` | `Le persone di questa edizione non sono ancora indicizzate.` | `Les personnes de cette édition ne sont pas encore indexées.` | `Die Personen dieser Ausgabe sind noch nicht erfasst.` | `Las personas de esta edición aún no están indexadas.` | `As pessoas desta edição ainda não estão indexadas.` |
| Names.loadError | (as `Places.loadError`) |
| Names.retry | (as `Places.retry`) |
| Names.inFootnote | `in footnote {n}` | `nella nota {n}` | `dans la note {n}` | `in Fußnote {n}` | `en la nota {n}` | `na nota {n}` |
| Names.wikidata | `Wikidata` (all six; add `"Names.wikidata": ALL` to `SAME_AS_ENGLISH` in `lib/__tests__/messages.test.ts` if it flags it) |

- [ ] **Step 2: Failing tests** `components/__tests__/NamesIndex.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@/test/intl";
import NamesIndex from "@/components/NamesIndex";
import type { NamesIndexData } from "@/lib/names-index";

const ED = "martyrologium_romanum_2004";
const index: NamesIndexData = {
  printed: 5, naming: 4,
  letters: [
    { letter: "B", persons: [{ key: "Q1", name: "Basilius", qid: "Q1", label: "Basil the Great", lines: [
      { id: "mr:0102-basilius", day: { mm: 1, dd: 2 }, entry: 1, subject: "Sancti Basilius et Gregorius", footnote: null },
    ] }] },
    { letter: "T", persons: [
      { key: "name:Thomas", name: "Thomas", qid: null, label: null, lines: [
        { id: "mr:0206-paulus-miki-et-socii", day: { mm: 2, dd: 6 }, entry: 1, subject: "Sancti Paulus Miki et socii", footnote: 1 },
      ] },
      { key: "Q9", name: "Theodorus", qid: "Q9", label: null, lines: [
        { id: "mr:1109-theodorus", day: { mm: 11, dd: 9 }, entry: 2, subject: "Sanctus Theodorus", footnote: null },
      ] },
    ] },
  ],
};
const renderIndex = (i: NamesIndexData | null = index, error = false) =>
  render(<NamesIndex edition={ED} title="MARTYROLOGIUM ROMANUM 2004" index={i} error={error} />);

describe("NamesIndex", () => {
  it("titles the page and links to the edition, its notes and its places", () => {
    renderIndex();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("MARTYROLOGIUM ROMANUM 2004: index of names");
    expect(screen.getByRole("link", { name: "Index of places" })).toHaveAttribute("href", `/en/read/${ED}/places`);
  });

  it("heads a person with the Latin name and the interface name linked to Wikidata", () => {
    renderIndex();
    const h = screen.getByRole("heading", { level: 3, name: /Basilius/ });
    expect(within(h).getByRole("link", { name: "Basil the Great ↗" })).toHaveAttribute("href", "https://www.wikidata.org/wiki/Q1");
  });

  it("links a person without a label to Wikidata by name, and an unidentified one not at all", () => {
    renderIndex();
    expect(within(screen.getByRole("heading", { level: 3, name: /Theodorus/ })).getByRole("link", { name: "Wikidata ↗" }))
      .toHaveAttribute("href", "https://www.wikidata.org/wiki/Q9");
    expect(within(screen.getByRole("heading", { level: 3, name: /^Thomas/ })).queryByRole("link")).toBeNull();
  });

  it("links a text mention to the eulogy and a footnote mention to the footnote", () => {
    renderIndex();
    expect(screen.getByRole("link", { name: "2 January · Sancti Basilius et Gregorius" }))
      .toHaveAttribute("href", `/en/read/${ED}/01/02#mr:0102-basilius`);
    const fn = screen.getByRole("link", { name: "6 February · Sancti Paulus Miki et socii" });
    expect(fn).toHaveAttribute("href", `/en/read/${ED}/02/06#fn-${ED}-mr:0206-paulus-miki-et-socii-1`);
    expect(fn.closest("li")).toHaveTextContent("in footnote 1");
  });

  it("shows the coverage, the not-indexed note and the error note", () => {
    const { unmount } = renderIndex();
    expect(screen.getByText("4 of the 5 eulogies of this edition name someone.")).toBeInTheDocument();
    unmount();
    const { unmount: u2 } = renderIndex(null);
    expect(screen.getByText("The persons of this edition are not indexed yet.")).toBeInTheDocument();
    u2();
    renderIndex(null, true);
    expect(screen.getByText("The index could not be loaded.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", `/en/read/${ED}/names`);
  });
});
```

- [ ] **Step 3: Run, expect FAIL.**

- [ ] **Step 4: Implement `components/NamesIndex.tsx`** (server component, no `"use client"`), on `PlacesIndex`'s structure:

```tsx
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import styles from "@/components/page.module.css";
import { dayPath, interfaceMonth } from "@/lib/calendar";
import { fnAnchor, type NamesIndexData } from "@/lib/names-index";

/**
 * An edition's index of names, as a Latin martyrology's Index nominum: the saints and blessed its
 * eulogies name, A–Z by their Latin names, the identified ones with their name in the interface
 * language linked to Wikidata; each mention links to its eulogy, or to the footnote that names it.
 * `index` null: crmedr has no persons for the edition yet (or, with `error`, the catalog failed).
 */
export default function NamesIndex({ edition, title, index, error = false }: {
  edition: string; title: string; index: NamesIndexData | null; error?: boolean;
}) {
  const t = useTranslations("Names");
  const format = useFormatter();
  const ed = encodeURIComponent(edition);

  return (
    <article className={styles.page} aria-labelledby="names-title">
      <h1 id="names-title" className={styles.heading}>{t("title", { title })}</h1>
      <p className="mb-3 text-center text-sm text-slate-600">
        <Link href={`/read/${ed}`} className="underline">{t("readEdition")}</Link>
        {" · "}
        <Link href={`/read/${ed}/notes`} className="underline">{t("notesLink")}</Link>
        {" · "}
        <Link href={`/read/${ed}/places`} className="underline">{t("placesLink")}</Link>
      </p>
      {error ? (
        <p className="text-center text-red-700">
          {t("loadError")}{" "}
          <Link href={`/read/${ed}/names`} className="underline">{t("retry")}</Link>
        </p>
      ) : !index ? (
        <p className="text-center text-slate-600">{t("notIndexed")}</p>
      ) : (
        <>
          {index.naming < index.printed && (
            <p className="mb-3 text-center text-sm text-slate-600">{t("coverage", { naming: index.naming, printed: index.printed })}</p>
          )}
          <nav aria-label={t("letters")} className="mb-4 flex flex-wrap justify-center gap-x-2 gap-y-1">
            {index.letters.map((l) => (
              <a key={l.letter} href={`#letter-${l.letter}`} className="underline">{l.letter}</a>
            ))}
          </nav>
          {index.letters.map((l) => (
            <section key={l.letter} id={`letter-${l.letter}`} aria-labelledby={`letter-${l.letter}-h`}>
              <h2 id={`letter-${l.letter}-h`} className={`${styles.heading} mt-6`}>{l.letter}</h2>
              {l.persons.map((p) => (
                <div key={p.key} className="mb-4">
                  <h3 className="font-semibold">
                    {p.name}
                    {p.qid && (
                      <>
                        {" "}
                        <a href={`https://www.wikidata.org/wiki/${p.qid}`} className="font-normal text-slate-600 underline" target="_blank" rel="noreferrer">
                          {`${p.label ?? t("wikidata")} ↗`}
                        </a>
                      </>
                    )}
                  </h3>
                  <ul className="ml-4 text-sm">
                    {p.lines.map((line) => {
                      const day = `${line.day.dd} ${interfaceMonth(format, line.day.mm)}`;
                      const hash = line.footnote ? fnAnchor(edition, line.id, line.footnote) : line.id;
                      return (
                        <li key={`${line.id}-${line.footnote ?? 0}`}>
                          <Link href={`${dayPath(edition, line.day)}#${hash}`} aria-label={`${day} · ${line.subject}`} className="underline">
                            {day}
                          </Link>
                          {" · "}
                          {line.subject}
                          {line.footnote && <span className="text-slate-600"> · {t("inFootnote", { n: line.footnote })}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </>
      )}
    </article>
  );
}
```

- [ ] **Step 5: Run** `npx vitest run components/__tests__/NamesIndex.test.tsx lib/__tests__/messages.test.ts` → PASS.
- [ ] **Step 6: Commit** the component, test and messages: `feat: the index of names, with its messages in six languages`.

---

### Task 4: The route

**Files:** create `app/[locale]/read/[edition]/names/page.tsx`, `components/__tests__/NamesRoute.test.tsx`.

- [ ] **Step 1: Failing tests**, on `components/__tests__/PlacesRoute.test.tsx`'s pattern: mock `@/lib/server-editions` (`editionExists`, `editionInfo`, `fetchCatalog`, `editionMeta`), `next/navigation`'s `notFound`, `@/components/NamesIndex` (record props), and `@/lib/persons`:

```tsx
vi.mock("@/lib/persons", () => ({
  getPersons: () => ({ editions: { martyrologium_romanum_2004: {
    "mr:0101-basilius": [{ name: "Basilius", where: "text", wikidata: "Q1" }] } }, labels: {} }),
}));
vi.mock("@/lib/persons-editions", () => ({ hasPersons: (e: string) => e === "martyrologium_romanum_2004" }));
```

Tests: 404 for an unknown edition; for the 2004 Latin, `fetchCatalog` is called with `("martyrologium_romanum_2004", "la")` and the props carry `index.naming === 1`; for 1749 (`hasPersons` false) the catalog is not fetched and `index` is null without `error`; when `fetchCatalog` rejects, `index` is null, `error` is true and `console.error` is called with a message naming the edition; `generateMetadata` titles "Martyrologium Romanum 2004: index of names" (mock `editionMeta` to `{ title: "Martyrologium Romanum", year: 2004 }`).

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**, on the places route:

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import NamesIndex from "@/components/NamesIndex";
import { editionLang, editionTitle } from "@/lib/editions";
import { namesIndex, type NamesIndexData } from "@/lib/names-index";
import { getPersons } from "@/lib/persons";
import { hasPersons } from "@/lib/persons-editions";
import { editionExists, editionInfo, editionMeta, fetchCatalog } from "@/lib/server-editions";

type Params = Promise<{ locale: string; edition: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, edition } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Metadata" });
  const meta = await editionMeta(edition);
  return { title: t("namesTitle", { edition: meta ? `${meta.title} ${meta.year}` : edition }) };
}

/** One edition's index of names, rendered on the server from its catalog and the persons snapshot. */
export default async function NamesRoute({ params }: { params: Params }) {
  const { locale, edition } = await params;
  setRequestLocale(locale as Locale);
  if (!(await editionExists(edition))) notFound();
  const e = await editionInfo(edition);
  let index: NamesIndexData | null = null;
  let error = false;
  if (hasPersons(edition)) {
    if (!e) {
      error = true;
    } else {
      try {
        index = namesIndex(await fetchCatalog(edition, editionLang(e)), getPersons(), edition, locale as Locale);
      } catch (err) {
        console.error(`index of names: the catalog of ${edition} could not be loaded`, err);
        error = true;
      }
    }
  }
  return (
    <main className="mx-auto max-w-5xl py-4 sm:p-4">
      <NamesIndex edition={edition} title={e ? `${editionTitle(e)} ${e.year}` : edition} index={index} error={error} />
    </main>
  );
}
```

- [ ] **Step 4: Run, expect PASS.** **Step 5: Commit**: `feat: /read/<edition>/names, the index of names rendered on the server`.

---

### Task 5: The reader finds footnotes

**Files:** modify `components/Reader.tsx`, `components/page.module.css`, `components/__tests__/Reader.test.tsx`.

- [ ] **Step 1: Failing tests**, inside `describe("Reader, a link to a eulogy", …)`:

```tsx
  const DAY_FN = {
    ...DAY,
    elogia: [{ ...DAY.elogia[0], footnotes: [{ mark: "1", after: "Sardi.", text: "A printed footnote on Modestus." }], marginalia: [] }],
  };

  it("finds the footnote named in the address when the page opens, without showing the IDs", async () => {
    vi.mocked(getDay).mockResolvedValue(DAY_FN);
    window.history.replaceState(null, "", "/read/martyrologium_romanum_1749/10/02#fn-martyrologium_romanum_1749-mr:1002-modestus-sardus-1");
    render1749();
    const note = await screen.findByText("A printed footnote on Modestus.");
    await waitFor(() => expect(note.closest("li")).toHaveAttribute("data-found"));
    expect(screen.getByRole("switch", { name: "IDs" })).not.toBeChecked();
    window.history.replaceState(null, "", "/");
  });

  it("shows the day when the footnote in the address is not there", async () => {
    window.history.replaceState(null, "", "/read/martyrologium_romanum_1749/10/02#fn-martyrologium_romanum_1749-mr:1002-modestus-sardus-9");
    render1749();
    expect(await screen.findByText("Romae passio sancti Modesti Sardi.")).toBeInTheDocument();
    window.history.replaceState(null, "", "/");
  });
```

(Check the field names `PrintedFootnotes` reads for a footnote's text and the `DayOut` elogium type; adjust `DAY_FN` to them, not the assertion.)

- [ ] **Step 2: Run, expect FAIL** (the footnote is never marked).
- [ ] **Step 3: Implement** in `components/Reader.tsx`:

```ts
/** The eulogy (`#mr:…`), curator's note (`#note-…`) or printed footnote (`#fn-…`) a link names in the address, if any. */
function hashId(): string | null {
  if (typeof window === "undefined") return null;
  const id = decodeURIComponent(window.location.hash.slice(1));
  return id.startsWith("mr:") || isNoteId(id) || isFootnoteId(id) ? id : null;
}

/** A printed footnote's element id: always drawn, so nothing needs switching on. */
function isFootnoteId(id: string): boolean {
  return id.startsWith("fn-");
}
```

and in `reveal`, find by element id for both: `const el = isNoteId(id) || isFootnoteId(id) ? … : …`. In `components/page.module.css`, after `.footnotes li:target`: `.footnotes li[data-found] { animation: found 2.4s ease-out; }` and add `.footnotes li[data-found]` to the reduced-motion rule beside `.notes li[data-found]`.

- [ ] **Step 4: Run** `npx vitest run components/__tests__/Reader.test.tsx` → PASS. **Step 5: Commit**: `feat(reader): a link to a printed footnote finds it`.

---

### Task 6: Links, only where there are persons

**Files:** modify `components/ReaderBar.tsx`, `components/ApparatusPage.tsx`, `components/__tests__/Reader.test.tsx`, `components/__tests__/ApparatusPage.test.tsx`; create `lib/__tests__/persons-bundle.test.ts`.

- [ ] **Step 1: Failing tests.** In `Reader.test.tsx` (`describe("Reader")`): the 1749 reader shows no link named "Index of names". In `ApparatusPage.test.tsx`: the 2004 notes page links "Index of names" to `/en/read/martyrologium_romanum_2004/names`, and a 1749 one shows none. In `lib/__tests__/persons-bundle.test.ts`, guard the client bundle:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("the links to the index of names", () => {
  it("read the small editions list, never the persons snapshot", () => {
    for (const f of ["components/ReaderBar.tsx", "components/ApparatusPage.tsx", "lib/persons-editions.ts"]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/persons-snapshot|@\/lib\/persons"/);
    }
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Import `hasPersons` from `@/lib/persons-editions` in both. In `ReaderBar.tsx`, after the places link: `{hasPersons(edition) && (<Link href={`/read/${encodeURIComponent(edition)}/names`} className="text-sm underline">{t("namesLink")}</Link>)}`; in `ApparatusPage.tsx`, after the places link: `{hasPersons(edition) && (<>{" · "}<Link href={`/read/${encodeURIComponent(edition)}/names`} className="underline">{tReader("namesLink")}</Link></>)}`.
- [ ] **Step 4: Run** the four test files → PASS; `npx tsc --noEmit`. **Step 5: Commit**: `feat: link the index of names where an edition has persons`.

---

### Task 7: Verify

- [ ] `npx vitest run && npx tsc --noEmit && npx eslint . && npm run build` (the build lists `/[locale]/read/[edition]/names`).
- [ ] Local server against the live API (`API_BASE` to a relay of `https://romanmartyrology.com/api/mr`, as for the index of places): `/en/read/martyrologium_romanum_2004/names` lists headings with grey Wikidata names and shows the coverage note; `/en/read/martyrologium_romanum_1749/names` shows the not-indexed note; a footnote link from the index (e.g. a companion of Paul Miki) opens the day at the footnote, marked. Stop the servers by port afterwards.
- [ ] Neither push nor PR: the user decides.
