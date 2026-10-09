# Eulogy markup, part 3 of 4: the reader — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the reader, a "Names & places" switch underlines the persons (dotted) and places (dashed) each eulogy names, tints them on hover, and opens a popup with the name in the website language plus a person's dates, description, portrait and links, or a place's country, printed form and small map.

**Architecture:** The API (plan 2) serves `mentions` on each eulogy. Pure helpers place them in the text (`lib/mentions.ts`). `EulogyText` and `PrintedFootnotes` cut the text at mention edges as they already cut it at misprints, errata and footnote marks. A `MarkupProvider` in the reader holds the switch state, the hover/pin state machine and the one popup, rendered in a portal. The popup's details come from `/api/entities`, which reads the persons, person-details and places snapshots on the server; the client keeps them for the session. Leaflet loads only with the first place popup.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, CSS modules, next-intl 4, Leaflet 1.9, Vitest 5 + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-09-eulogy-markup-design.md` (sections "martyrology-frontend", "Testing", "Success criteria").

## Global Constraints

- Editions: the 2004 Latin (`martyrologium_romanum_2004`) and Italian (`martyrologium_romanum_2004_it_IT`) carry mentions; the code is edition-agnostic and marks whatever mentions the API sends.
- Offsets are UTF-16 code units (JavaScript string indices) into the eulogy's text, or into footnote *n*'s text when `where` is `{ footnote: n }`. **Settled with plans 1 and 2:** n counts from 1 in the eulogy's footnote order.
- `Mention.name` is always present: the person's nominative, `null` for a place (plan 2 always serves it).
- `person_details.json` `born`/`died` (plan 1) are `{ "year": int (negative = BCE), "precision": "year" | "decade" | "century", "circa": boolean } | null`; the snapshot passes them through and the popup formats them per locale (circa, decade, century, BCE).
- The "Names & places" switch is rendered only when the day on screen has at least one mention (in either column of the compare view); while hidden, the stored preference is left untouched.
- **Spec amendments (accepted):** (a) a click outside the popup closes it and returns focus to the mention only when the focus was inside the popup; (b) `/api/entities` answers a 400 problem JSON (`application/problem+json`) above 200 IDs, and the client asks in batches of 200; (c) `MarkupProvider` takes a `page` prop naming the day shown, and a new value closes the popup.
- Switch off: `EulogyText`'s output is exactly what it is today.
- `/api/entities?ids=Q1,Q2,…`: at most 200 IDs per request; `Cache-Control: public, max-age=3600`; reads the snapshots on the server, so the reader never downloads them.
- The reader asks for every QID on the day at once, the first time the switch is on for that day, and keeps the answers for the session.
- Hover opens after about 300 ms, closes about 200 ms after the pointer leaves both mention and popup. Click or tap pins; Enter or Space on a focused mention pins; Escape or a click outside closes. One popup at a time.
- Persons: `text-decoration: underline dotted`; places: `underline dashed`; line at about 60% opacity; `text-underline-offset: 0.2em`; `cursor: help`. Hover/focus/pinned tint on every piece of the mention, warm for persons, cool for places, with dark-mode values; `forced-colors`: `Highlight`/`HighlightText`; tint fades in over 150 ms, at once with `prefers-reduced-motion`.
- The first piece of each mention: `tabindex="0"`, `role="button"`, `aria-haspopup="dialog"`, `aria-expanded`, `aria-roledescription` ("person"/"place", translated). The popup: `role="dialog"` without `aria-modal`, labelled by its heading; focus moves into it only when opened from the keyboard.
- Portrait: Commons thumbnail 96 px wide via `Special:FilePath?width=96`, `loading="lazy"`, credited "Author · License" with only the parts present: the author (linked to the Commons file page) when not null, the license name always, linked only when `license_url` is set. `image` is always present in `person_details.json` but may be null (no P18, or license unreadable): then no portrait.
- `person_details.json` (plan 1) has a top-level `$comment` beside the QIDs: `buildPersonDetails` skips every key starting with `$`.
- Place map: about 260 × 160 px, the Esri street tiles the map page uses, one marker, zoom buttons only; Leaflet imported the first time a place popup opens.
- Every new string goes into all six `messages/*.json`, translated (the `messages` test fails on an untranslated string unless it is listed in `SAME_AS_ENGLISH`).
- No client module imports `data/persons-snapshot.json`, `data/places-snapshot.json` or `data/person-details-snapshot.json` (or `@/lib/persons`, `@/lib/places`, `@/lib/person-details` other than `import type`).
- Next.js 16 differs from older versions: read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` before writing the route handler.
- Commits end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv
  ```

## Review Focus

1. **Stale offsets.** A mention whose `end` is past the text (the text corrected after the API's data was built, or an older cached API answer) must be ignored, never sliced into the wrong words. Test: Task 1, "drops a mention that does not fit the text".
2. **Turning the day with a popup open.** The reader keeps the provider mounted across days; a popup pinned on 1 January must close when the page turns to 2 January, not float over the new day anchored to a detached element. Test: Task 9, "closes the popup when the page changes".
3. **Switching the markup off with a popup open.** The popup must close and the marks vanish together. Test: Task 9, "closes the popup when the switch goes off".
4. **More than 200 QIDs on a page.** A side-by-side spread of two long days can name more items than the route accepts; the client must ask in batches of 200, not get a 400. Test: Task 4, "asks in batches of MAX_IDS".
5. **A QID the snapshots don't know.** A mention linked to an item newer than the frontend's snapshot gets no entity; the person popup must still show the Latin name and a Wikidata link, not "Details unavailable" or a blank heading. Test: Task 7, "a QID the snapshots don't know".

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/types.ts` (modify) | `Mention`; `ElogiumOut.mentions` |
| `lib/mentions.ts` (create) | Pure: key a mention, filter/sort/drop overlaps, split a stretch of text into pieces, list a page's QIDs |
| `lib/footnotes.ts` (modify) | `PageFootnote.number` and `.mentions` |
| `scripts/snapshot-registry.mjs` (modify) | `buildPersonDetails`; writes `data/person-details-snapshot.json` |
| `data/person-details-snapshot.json` (create) | Persons' Wikidata details, server only |
| `lib/entities.ts` (create) | Entity types; `parseIds`, `entitiesFor` (pure, no snapshot imports) |
| `lib/person-details.ts` (create) | `getPersonDetails()`: the snapshot, server only |
| `app/api/entities/route.ts` (create) | `GET /api/entities` |
| `lib/entities-client.ts` (create) | Session cache, batched requests, `useEntity`, `usePrefetchEntities` |
| `lib/use-reader-switch.ts` (create) | `useReaderSwitch(key)`, `useMarkupSwitch()`, `__resetReaderSwitches()` |
| `lib/use-show-ids.ts` (modify) | Thin wrapper over `useReaderSwitch("reader.showIds")` |
| `messages/{en,it,fr,de,es,pt}.json` (modify) | `Markup` namespace |
| `lib/__tests__/messages.test.ts` (modify) | `SAME_AS_ENGLISH` entries for Markup |
| `components/ReaderBar.tsx` (modify) | The "Names & places" switch, rendered only on a day with mentions |
| `lib/popup-position.ts` (create) | Pure placement of the popup beside its mention |
| `lib/life-years.ts` (create) | Wikidata dates (year, decade, century; circa; BCE) in the interface language, and the life span |
| `lib/wikimedia.ts` (create) | Commons, Wikipedia and Wikidata URLs |
| `lib/mention-labels.ts` (create) | Text in the website language, else English, else a fallback, with its language |
| `lib/esri-tiles.ts` (create) | The Esri tile URL and attribution, shared by the three maps |
| `components/PlaceMap.tsx`, `components/EulogyMap.tsx` (modify) | Use `lib/esri-tiles.ts` |
| `components/markup/Unavailable.tsx` (create) | "Details unavailable" + retry |
| `components/markup/MentionPersonCard.tsx` (create) | Person popup content |
| `components/markup/MentionPlaceCard.tsx` (create) | Place popup content |
| `components/markup/MentionMap.tsx` (create) | The small Leaflet map, lazily loaded |
| `components/markup/Markup.tsx` (create) | `MarkupProvider`, `useMarkup`, `PrefetchEntities` |
| `components/markup/MentionPopup.tsx` (create) | The popup shell: portal content, position, dialog semantics |
| `components/markup/MentionPiece.tsx` (create) | `MentionPiece`, `MentionRun`, `MentionText` |
| `components/EulogyText.tsx`, `Eulogy.tsx`, `PrintedFootnotes.tsx`, `DayPage.tsx`, `Spread.tsx`, `Reader.tsx` (modify) | Wire the marks in |
| `components/page.module.css` (modify) | Mention underline and tint styles |

---

### Task 1: Mention type and placement helpers

**Files:**
- Modify: `lib/types.ts` (after `Erratum`, and `ElogiumOut`)
- Create: `lib/mentions.ts`
- Modify: `lib/footnotes.ts`
- Test: `lib/__tests__/mentions.test.ts`, `lib/__tests__/footnotes.test.ts`

**Interfaces:**
- Produces: `Mention` (lib/types.ts, `name: string | null`); `ElogiumOut.mentions?: Mention[]`; `PlacedMention extends Mention { key: string; eulogy: string }`; `Piece { start; end; mention: PlacedMention | null; first: boolean }`; `mentionKey(eulogy: string, m: Mention): string`; `mentionsIn(mentions: Mention[] | undefined, where: "text" | number, eulogy: string, length: number): PlacedMention[]`; `splitByMentions(from: number, to: number, mentions: PlacedMention[]): Piece[]`; `mentionQids(elogia: (Pick<ElogiumOut, "mentions"> | null)[]): string[]`; `hasMentions(elogia: (Pick<ElogiumOut, "mentions"> | null)[]): boolean`; `PageFootnote.number?: number`, `PageFootnote.mentions?: Mention[]`.

- [ ] **Step 1: Create the branch**

```bash
cd /home/johnrdorazio/development/CatholicOS_org/martyrology-frontend
git checkout main && git pull && git checkout -b feat/eulogy-markup-reader
```

- [ ] **Step 2: Write the failing tests**

Create `lib/__tests__/mentions.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { hasMentions, mentionKey, mentionQids, mentionsIn, splitByMentions } from "@/lib/mentions";
import type { Mention } from "@/lib/types";

const TEXT = "Cæsaréæ in Cappadócia, sepultúra sancti Basilíi, magístri.";
const place: Mention = { kind: "place", where: "text", start: 0, end: 21, form: "Cæsaréæ in Cappadócia", name: null, qid: "Q48338" };
const person: Mention = { kind: "person", where: "text", start: 40, end: 47, form: "Basilíi", name: "Basilius", qid: null };
const inNote: Mention = { kind: "person", where: { footnote: 2 }, start: 0, end: 5, form: "Petri", name: "Petrus", qid: "Q1" };

describe("mentionKey", () => {
  it("names a mention by its eulogy, where it is and where it starts", () => {
    expect(mentionKey("mr:0101-basilius", place)).toBe("mr:0101-basilius|text|0");
    expect(mentionKey("mr:0101-basilius", inNote)).toBe("mr:0101-basilius|fn2|0");
  });
});

describe("mentionsIn", () => {
  it("keeps the text's mentions, sorted, keyed", () => {
    const ms = mentionsIn([person, inNote, place], "text", "mr:x", TEXT.length);
    expect(ms.map((m) => m.form)).toEqual(["Cæsaréæ in Cappadócia", "Basilíi"]);
    expect(ms[0]).toMatchObject({ key: "mr:x|text|0", eulogy: "mr:x" });
    expect(TEXT.slice(ms[1].start, ms[1].end)).toBe("Basilíi");
  });

  it("keeps a footnote's mentions for that footnote only", () => {
    expect(mentionsIn([place, inNote], 2, "mr:x", 20).map((m) => m.form)).toEqual(["Petri"]);
    expect(mentionsIn([place, inNote], 1, "mr:x", 20)).toEqual([]);
  });

  it("drops a mention that does not fit the text", () => {
    const stale: Mention = { ...person, start: 50, end: 90 };
    const empty: Mention = { ...person, start: 5, end: 5 };
    expect(mentionsIn([stale, empty, place], "text", "mr:x", TEXT.length).map((m) => m.form)).toEqual(["Cæsaréæ in Cappadócia"]);
  });

  it("keeps the first of two overlapping mentions and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const inside: Mention = { kind: "person", where: "text", start: 11, end: 21, form: "Cappadócia", name: null, qid: null };
    expect(mentionsIn([place, inside], "text", "mr:x", TEXT.length).map((m) => m.form)).toEqual(["Cæsaréæ in Cappadócia"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("overlaps"));
    warn.mockRestore();
  });

  it("tolerates a eulogy without mentions (an older API)", () => {
    expect(mentionsIn(undefined, "text", "mr:x", 10)).toEqual([]);
  });
});

describe("splitByMentions", () => {
  const ms = mentionsIn([place, person], "text", "mr:x", TEXT.length);

  it("cuts a stretch at the mentions' edges, marking each mention's first piece", () => {
    expect(splitByMentions(0, TEXT.length, ms).map((p) => [p.start, p.end, p.mention?.form ?? null, p.first])).toEqual([
      [0, 21, "Cæsaréæ in Cappadócia", true],
      [21, 40, null, false],
      [40, 47, "Basilíi", true],
      [47, TEXT.length, null, false],
    ]);
  });

  it("gives the part of a mention after a cut point as a later piece of the same mention", () => {
    const after = splitByMentions(7, 30, ms);
    expect(after[0]).toMatchObject({ start: 7, end: 21, first: false });
    expect(after[0].mention?.key).toBe("mr:x|text|0");
  });

  it("returns nothing for an empty stretch", () => {
    expect(splitByMentions(5, 5, ms)).toEqual([]);
  });
});

describe("mentionQids", () => {
  it("lists the items a page names, text and footnotes, each once", () => {
    expect(mentionQids([{ mentions: [place, person, inNote] }, null, { mentions: [place] }, {}])).toEqual(["Q1", "Q48338"]);
  });
});

describe("hasMentions", () => {
  it("tells whether a page names anyone or anywhere, footnotes included", () => {
    expect(hasMentions([null, {}, { mentions: [] }])).toBe(false);
    expect(hasMentions([{ mentions: [inNote] }])).toBe(true);
  });
});
```

Append to `lib/__tests__/footnotes.test.ts`, inside `describe("pageFootnotes", …)` (before its closing `});`):

```ts
  it("gives each footnote its number in the eulogy and the mentions printed in it", () => {
    const m = { kind: "person" as const, where: { footnote: 2 }, start: 0, end: 5, form: "Petri", name: "Petrus", qid: null };
    const t = { kind: "place" as const, where: "text" as const, start: 0, end: 4, form: "Romæ", name: null, qid: "Q220" };
    const notes = pageFootnotes([{ id: "mr:a", footnotes: [fn("1", "x"), fn("2", "y")], mentions: [m, t] }], "ed");
    expect(notes.map((n) => [n.number, n.mentions])).toEqual([[1, []], [2, [m]]]);
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run lib/__tests__/mentions.test.ts lib/__tests__/footnotes.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/mentions"`, and the footnotes test fails on `number`/`mentions` being undefined.

- [ ] **Step 4: Add the type**

In `lib/types.ts`, after the `Erratum` interface, add:

```ts
/**
 * A person or place a eulogy names (crmedr's mentions, checked by the API against the text): where its words
 * are, `start`/`end` in UTF-16 code units (JavaScript string indices) of the text or of footnote n (counted
 * from 1 in the eulogy's footnotes), and the Wikidata item crmedr decided for it, null while undecided.
 * `name` is a person's nominative, the key crmedr files them by; the API always sends it, null for a place.
 */
export interface Mention {
  kind: "person" | "place";
  where: "text" | { footnote: number };
  start: number;
  end: number;
  form: string;
  qid: string | null;
  name: string | null;
}
```

In `ElogiumOut`, after `errata?: Erratum[];`, add:

```ts
  /** The persons and places it names; absent from APIs before they were served. */
  mentions?: Mention[];
```

- [ ] **Step 5: Write `lib/mentions.ts`**

```ts
import type { ElogiumOut, Mention } from "@/lib/types";

/** A mention placed in one eulogy's text or footnote: `key` names it on the page, across its pieces. */
export interface PlacedMention extends Mention {
  key: string;
  eulogy: string;
}

/** A stretch of text between two cut points, inside a mention or not; `first` marks a mention's first piece. */
export interface Piece {
  start: number;
  end: number;
  mention: PlacedMention | null;
  first: boolean;
}

const whereKey = (w: Mention["where"]) => (w === "text" ? "text" : `fn${w.footnote}`);

/** The mention's name on the page: its eulogy, where it is, and where it starts. */
export function mentionKey(eulogy: string, m: Mention): string {
  return `${eulogy}|${whereKey(m.where)}|${m.start}`;
}

/**
 * The mentions of `where` (the text, or footnote n) that fit a text of `length`, sorted. A mention past the
 * text (the text corrected since) is left out. Two that overlap should not exist (crmedr forbids it): the
 * first in the list is kept, the other dropped with a warning.
 */
export function mentionsIn(
  mentions: Mention[] | undefined, where: "text" | number, eulogy: string, length: number,
): PlacedMention[] {
  const kept: PlacedMention[] = [];
  for (const m of mentions ?? []) {
    const here = where === "text" ? m.where === "text" : m.where !== "text" && m.where.footnote === where;
    if (!here || m.start < 0 || m.end > length || m.end <= m.start) continue;
    const clash = kept.find((k) => m.start < k.end && k.start < m.end);
    if (clash) {
      console.warn(`markup: ${eulogy}: "${m.form}" (${m.start}–${m.end}) overlaps "${clash.form}" and is not marked`);
      continue;
    }
    kept.push({ ...m, eulogy, key: mentionKey(eulogy, m) });
  }
  return kept.sort((a, b) => a.start - b.start);
}

/** [from, to) cut at the mentions' edges: the stretches in no mention, and each mention's part inside it. */
export function splitByMentions(from: number, to: number, mentions: PlacedMention[]): Piece[] {
  const pieces: Piece[] = [];
  let at = from;
  for (const m of mentions) {
    if (m.end <= from || m.start >= to) continue;
    const s = Math.max(m.start, from);
    const e = Math.min(m.end, to);
    if (s > at) pieces.push({ start: at, end: s, mention: null, first: false });
    pieces.push({ start: s, end: e, mention: m, first: s === m.start });
    at = e;
  }
  if (at < to) pieces.push({ start: at, end: to, mention: null, first: false });
  return pieces;
}

/** Whether any of a page's eulogies names a person or place, in its text or its footnotes. */
export function hasMentions(elogia: (Pick<ElogiumOut, "mentions"> | null)[]): boolean {
  return elogia.some((e) => (e?.mentions?.length ?? 0) > 0);
}

/** The Wikidata items a page's eulogies name, text and footnotes, each once, sorted. */
export function mentionQids(elogia: (Pick<ElogiumOut, "mentions"> | null)[]): string[] {
  return [...new Set(elogia.flatMap((e) => (e?.mentions ?? []).flatMap((m) => (m.qid ? [m.qid] : []))))].sort();
}
```

- [ ] **Step 6: Give each page footnote its number and mentions**

In `lib/footnotes.ts`, change the import to `import type { ElogiumOut, Footnote, Mention } from "@/lib/types";`, add to `PageFootnote` after `marginalia: string[];`:

```ts
  /** Its number among its eulogy's footnotes, from 1: the `where` of the mentions printed in it. */
  number?: number;
  /** The persons and places it names. */
  mentions?: Mention[];
```

Change the `elogia` parameter type to `(Pick<ElogiumOut, "id" | "footnotes" | "marginalia" | "mentions"> | null)[]`, and the `out.push(…)` line to:

```ts
      const mentions = (e.mentions ?? []).filter((m) => m.where !== "text" && m.where.footnote === k + 1);
      out.push({ ...f, id, at, anchor, markAnchor: `${anchor}-mark`, marginalia, number: k + 1, mentions });
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run lib/__tests__/mentions.test.ts lib/__tests__/footnotes.test.ts && npx tsc --noEmit -p .`
Expected: PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add lib/types.ts lib/mentions.ts lib/footnotes.ts lib/__tests__/mentions.test.ts lib/__tests__/footnotes.test.ts
git commit -F - <<'EOF'
feat(markup): the Mention type and the helpers that place mentions in a text

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv
EOF
```

---

### Task 2: The person-details snapshot

**Files:**
- Modify: `scripts/snapshot-registry.mjs`
- Create: `lib/entities.ts` (types only in this task), `lib/person-details.ts`, `data/person-details-snapshot.json`
- Test: `lib/__tests__/snapshot.test.ts`

**Interfaces:**
- Consumes: `LABEL_LANGS`, `personQids` (already in `scripts/snapshot-registry.mjs`).
- Produces: `buildPersonDetails(detailsDoc, qids): Record<string, PersonDetails>`; types `Labels`, `CommonsImage`, `WikidataDate`, `PersonDetails`, `Entity` in `lib/entities.ts`; `getPersonDetails(): Record<string, PersonDetails>` (server only).

- [ ] **Step 1: Write the failing test**

In `lib/__tests__/snapshot.test.ts`, add `buildPersonDetails` to the import list from `@/scripts/snapshot-registry.mjs`, and append:

```ts
describe("buildPersonDetails", () => {
  const doc = {
    $comment: "crmedr's note",
    Q19546: {
      description: { en: "Greek bishop", la: "episcopus", it: "vescovo greco" },
      born: { year: 329, precision: "year", circa: true }, died: { year: 379, precision: "year", circa: false },
      image: { file: "Basil of Caesarea.jpg", author: "Anon.", license: "Public domain", license_url: null },
      wikipedia: { it: "Basilio di Cesarea", en: "Basil of Caesarea", ru: "Василий Великий" },
    },
    Q1: { description: {}, born: null, died: null, image: null, wikipedia: {} },
  };

  it("keeps the QIDs the persons snapshot links to, each language-keyed field in the interface languages only", () => {
    expect(buildPersonDetails(doc, ["Q19546", "Q404"])).toEqual({
      Q19546: {
        description: { en: "Greek bishop", it: "vescovo greco" },
        born: { year: 329, precision: "year", circa: true }, died: { year: 379, precision: "year", circa: false },
        image: { file: "Basil of Caesarea.jpg", author: "Anon.", license: "Public domain", license_url: null },
        wikipedia: { en: "Basil of Caesarea", it: "Basilio di Cesarea" },
      },
    });
  });

  it("skips crmedr's \"$\" keys, even when asked for one", () => {
    expect(Object.keys(buildPersonDetails(doc, ["$comment", "Q19546"]))).toEqual(["Q19546"]);
  });

  it("passes the dates through as crmedr writes them", () => {
    const bce = { year: -150, precision: "century", circa: false };
    expect(buildPersonDetails({ Q3: { born: bce, died: null } }, ["Q3"]).Q3.born).toEqual(bce);
  });

  it("fills what crmedr leaves out with nulls and empty maps", () => {
    expect(buildPersonDetails({ Q2: {} }, ["Q2"])).toEqual({
      Q2: { description: {}, born: null, died: null, image: null, wikipedia: {} },
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/__tests__/snapshot.test.ts -t buildPersonDetails`
Expected: FAIL — `buildPersonDetails is not a function`.

- [ ] **Step 3: Implement `buildPersonDetails` and write the file in `main()`**

In `scripts/snapshot-registry.mjs`, change the first import to `import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";`. After `fetchPersonLabels`, add:

```js
/**
 * @typedef {{year: number, precision: "year"|"decade"|"century", circa: boolean}} WikidataDate
 *
 * The popups' details of the persons the eulogies name (crmedr data/person_details.json: descriptions, dates,
 * Commons image with its credit, Wikipedia titles), for the QIDs the persons snapshot links to; descriptions
 * and titles in LABEL_LANGS order, other languages left out; the dates passed through as crmedr writes them;
 * the file's "$" keys ("$comment") skipped.
 * @param {Record<string, {description?: Record<string, string>, born?: WikidataDate|null, died?: WikidataDate|null, image?: object|null, wikipedia?: Record<string, string>}>} detailsDoc
 * @param {string[]} qids
 */
export function buildPersonDetails(detailsDoc, qids) {
  /** @param {Record<string, string> | undefined} o */
  const pick = (o) => Object.fromEntries(LABEL_LANGS.flatMap((l) => (o?.[l] ? [[l, o[l]]] : [])));
  /** @type {Record<string, {description: Record<string, string>, born: WikidataDate|null, died: WikidataDate|null, image: object|null, wikipedia: Record<string, string>}>} */
  const out = {};
  for (const q of qids) {
    // crmedr's file carries a "$comment" (and may carry other "$" keys) beside the QIDs.
    if (q.startsWith("$")) continue;
    const d = detailsDoc[q];
    if (!d) continue;
    out[q] = { description: pick(d.description), born: d.born ?? null, died: d.died ?? null, image: d.image ?? null, wikipedia: pick(d.wikipedia) };
  }
  return out;
}
```

At the end of `main()`, after the `console.log(\`wrote ${personsDest}…\`)` line, add:

```js
  // The person popups' details: crmedr builds them from Wikidata (descriptions, years, portrait, Wikipedia).
  const detailsPath = join(crmedr, "data", "person_details.json");
  const detailsDoc = existsSync(detailsPath) ? JSON.parse(readFileSync(detailsPath, "utf8")) : {};
  if (!existsSync(detailsPath)) console.log(`no ${detailsPath} yet: the person popups show names only`);
  const details = buildPersonDetails(detailsDoc, personQids(personsDoc, itemsDoc));
  const detailsDest = join(here, "..", "data", "person-details-snapshot.json");
  writeFileSync(detailsDest, JSON.stringify(details) + "\n");
  console.log(`wrote ${detailsDest}: ${Object.keys(details).length} persons with details`);
```

- [ ] **Step 4: Add the entity types**

Create `lib/entities.ts` (Task 3 adds its functions):

```ts
import type { Locale } from "@/i18n/routing";

/** A text in some of the interface languages. */
export type Labels = Partial<Record<Locale, string>>;

/** A Commons file and the credit it must be shown with: the license always, the author and license link when Commons gives them. */
export interface CommonsImage {
  file: string;
  author: string | null;
  license: string;
  license_url: string | null;
}

/**
 * A Wikidata date as crmedr keeps it: the year (negative before Christ), how precise Wikidata is about it, and
 * whether it is "circa". For a decade or a century, `year` is any year in it.
 */
export interface WikidataDate {
  year: number;
  precision: "year" | "decade" | "century";
  circa: boolean;
}

/** A person's Wikidata details for the popup (crmedr data/person_details.json). */
export interface PersonDetails {
  description: Labels;
  born: WikidataDate | null;
  died: WikidataDate | null;
  image: CommonsImage | null;
  wikipedia: Labels;
}

/** What a popup shows of one Wikidata item: a person's names and details, or a place's names and position. */
export type Entity =
  | { kind: "person"; labels: Labels; details: PersonDetails | null }
  | { kind: "place"; labels: Labels; label: string; country: string; coords: [number, number] | null };
```

Create `lib/person-details.ts`:

```ts
import snapshot from "@/data/person-details-snapshot.json";
import type { PersonDetails } from "@/lib/entities";

/** The persons' Wikidata details for the popups: for server code only (/api/entities). */
export function getPersonDetails(): Record<string, PersonDetails> {
  return snapshot as unknown as Record<string, PersonDetails>;
}
```

- [ ] **Step 5: Write the snapshot**

If crmedr's part 1 is merged and `../crmedr/data/person_details.json` exists, refresh every snapshot:

```bash
test -f ../crmedr/data/person_details.json && npm run snapshot-registry
```

Otherwise write the empty snapshot (the popups then show names only until the next refresh):

```bash
test -f data/person-details-snapshot.json || echo '{}' > data/person-details-snapshot.json
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run lib/__tests__/snapshot.test.ts && npx tsc --noEmit -p .`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/snapshot-registry.mjs lib/entities.ts lib/person-details.ts data/ lib/__tests__/snapshot.test.ts
git commit -F - <<'EOF'
feat(markup): the person-details snapshot for the popups

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv
EOF
```

---

### Task 3: `/api/entities`

**Files:**
- Modify: `lib/entities.ts`
- Create: `app/api/entities/route.ts`
- Test: `lib/__tests__/entities.test.ts`, `lib/__tests__/entities-route.test.ts`

**Interfaces:**
- Consumes: `Entity`, `PersonDetails` (Task 2); `PersonsSnapshot` (`lib/persons.ts`), `PlacesSnapshot` (`lib/places.ts`), `getPersons`, `getPlaces`, `getPersonDetails`.
- Produces: `MAX_IDS = 200`; `parseIds(param: string | null): string[] | null`; `entitiesFor(ids, persons, details, places): Record<string, Entity>`; `GET /api/entities?ids=…` → `{ entities: Record<string, Entity> }`, 400 problem JSON above 200 IDs.

- [ ] **Step 1: Read the route handler guide**

Run: `sed -n 1,120p node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
Note: the handler receives a `NextRequest`; `request.nextUrl.searchParams` reads the query; reading it makes the route dynamic.

- [ ] **Step 2: Write the failing tests**

Create `lib/__tests__/entities.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { entitiesFor, MAX_IDS, parseIds } from "@/lib/entities";
import type { PersonsSnapshot } from "@/lib/persons";
import type { PlacesSnapshot } from "@/lib/places";

const persons: PersonsSnapshot = { editions: {}, labels: { Q19546: { en: "Basil of Caesarea", it: "Basilio di Cesarea" }, Q7: { en: "Seven" } } };
const places: PlacesSnapshot = {
  places: { Q220: { label: "Rome", country: "IT", coords: [41.9, 12.5], labels: { en: "Rome", it: "Roma" } } },
  eulogies: {},
};
const details = { Q19546: { description: { en: "Greek bishop" }, born: { year: 329, precision: "year", circa: false }, died: { year: 379, precision: "year", circa: false }, image: null, wikipedia: {} } };

describe("parseIds", () => {
  it("keeps well-formed QIDs, each once", () => {
    expect(parseIds("Q220, Q19546,Q220,x,Q0,q5,")).toEqual(["Q220", "Q19546"]);
    expect(parseIds(null)).toEqual([]);
  });

  it(`refuses more than ${MAX_IDS}`, () => {
    const many = Array.from({ length: MAX_IDS + 1 }, (_, i) => `Q${i + 1}`).join(",");
    expect(parseIds(many)).toBeNull();
    expect(parseIds(Array.from({ length: MAX_IDS }, (_, i) => `Q${i + 1}`).join(","))).toHaveLength(MAX_IDS);
  });
});

describe("entitiesFor", () => {
  it("gives a place its labels and position, a person their labels and details, and leaves out the unknown", () => {
    expect(entitiesFor(["Q220", "Q19546", "Q7", "Q404"], persons, details, places)).toEqual({
      Q220: { kind: "place", labels: { en: "Rome", it: "Roma" }, label: "Rome", country: "IT", coords: [41.9, 12.5] },
      Q19546: { kind: "person", labels: { en: "Basil of Caesarea", it: "Basilio di Cesarea" }, details: details.Q19546 },
      Q7: { kind: "person", labels: { en: "Seven" }, details: null },
    });
  });
});
```

Create `lib/__tests__/entities-route.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/persons", () => ({ getPersons: () => ({ editions: {}, labels: { Q19546: { en: "Basil of Caesarea" } } }) }));
vi.mock("@/lib/places", () => ({
  getPlaces: () => ({ places: { Q220: { label: "Rome", country: "IT", coords: [41.9, 12.5] } }, eulogies: {} }),
}));
vi.mock("@/lib/person-details", () => ({ getPersonDetails: () => ({}) }));

import { GET } from "@/app/api/entities/route";

const get = (q: string) => GET(new NextRequest(`https://romanmartyrology.com/api/entities${q}`));

describe("/api/entities", () => {
  it("answers with the items asked for, cacheable for an hour", async () => {
    const res = get("?ids=Q220,Q19546,Q404");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    const body = await res.json();
    expect(Object.keys(body.entities).sort()).toEqual(["Q19546", "Q220"]);
    expect(body.entities.Q220).toMatchObject({ kind: "place", coords: [41.9, 12.5] });
  });

  it("answers an empty question with no items", async () => {
    expect(await get("").json()).toEqual({ entities: {} });
  });

  it("is a 400 above 200 items", async () => {
    const ids = Array.from({ length: 201 }, (_, i) => `Q${i + 1}`).join(",");
    const res = get(`?ids=${ids}`);
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run lib/__tests__/entities.test.ts lib/__tests__/entities-route.test.ts`
Expected: FAIL — `parseIds`/`entitiesFor` not exported; the route module not found.

- [ ] **Step 4: Implement the functions**

Append to `lib/entities.ts` (and add `import type { PersonsSnapshot } from "@/lib/persons";` and `import type { PlacesSnapshot } from "@/lib/places";` under the existing import — type-only, so no snapshot reaches a client bundle):

```ts
/** The most items one request may ask for: a day names a few dozen, a spread of two long days up to ~150. */
export const MAX_IDS = 200;

const QID = /^Q[1-9]\d*$/;

/** The QIDs a request asks for (`ids=Q1,Q2`), well-formed and each once; null when there are more than MAX_IDS. */
export function parseIds(param: string | null): string[] | null {
  const ids = [...new Set((param ?? "").split(",").map((s) => s.trim()).filter((s) => QID.test(s)))];
  return ids.length > MAX_IDS ? null : ids;
}

/**
 * What the popups show of each item asked for that the snapshots know: a place's labels, country and position,
 * else a person's labels and details. An item none of them knows is left out.
 */
export function entitiesFor(
  ids: string[], persons: PersonsSnapshot, details: Record<string, PersonDetails>, places: PlacesSnapshot,
): Record<string, Entity> {
  const out: Record<string, Entity> = {};
  for (const q of ids) {
    const p = places.places[q];
    if (p) out[q] = { kind: "place", labels: p.labels ?? {}, label: p.label, country: p.country, coords: p.coords };
    else if (persons.labels[q] || details[q]) out[q] = { kind: "person", labels: persons.labels[q] ?? {}, details: details[q] ?? null };
  }
  return out;
}
```

- [ ] **Step 5: Write the route**

Create `app/api/entities/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { entitiesFor, MAX_IDS, parseIds } from "@/lib/entities";
import { getPersonDetails } from "@/lib/person-details";
import { getPersons } from "@/lib/persons";
import { getPlaces } from "@/lib/places";

// The same for every reader and fixed between deploys: shared caches may keep it an hour.
const CACHE = { "cache-control": "public, max-age=3600" };

/**
 * The names, details and positions of the persons and places a reader's page marks (/api/entities?ids=Q1,Q2),
 * read from the snapshots here so the reader never downloads them.
 */
export function GET(request: NextRequest) {
  const ids = parseIds(request.nextUrl.searchParams.get("ids"));
  if (ids === null) {
    return Response.json(
      { title: `At most ${MAX_IDS} items per request`, status: 400 },
      { status: 400, headers: { "content-type": "application/problem+json" } },
    );
  }
  return Response.json({ entities: entitiesFor(ids, getPersons(), getPersonDetails(), getPlaces()) }, { headers: CACHE });
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run lib/__tests__/entities.test.ts lib/__tests__/entities-route.test.ts && npx tsc --noEmit -p .`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/entities.ts app/api/entities/route.ts lib/__tests__/entities.test.ts lib/__tests__/entities-route.test.ts
git commit -F - <<'EOF'
feat(markup): /api/entities serves the popups' names, details and positions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv
EOF
```

---

### Task 4: The client's entity cache

**Files:**
- Create: `lib/entities-client.ts`
- Test: `lib/__tests__/entities-client.test.tsx`

**Interfaces:**
- Consumes: `Entity`, `MAX_IDS` (Task 3).
- Produces: `EntityState = { status: "idle" | "loading" | "error" } | { status: "ready"; entity: Entity | null }`; `requestEntities(qids: string[]): Promise<void>`; `useEntity(qid: string | null): EntityState`; `usePrefetchEntities(qids: string[], on: boolean): void`; `__resetEntities(): void`.

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/entities-client.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { __resetEntities, requestEntities, useEntity, usePrefetchEntities } from "@/lib/entities-client";
import { MAX_IDS } from "@/lib/entities";

const ROME = { kind: "place", labels: { it: "Roma" }, label: "Rome", country: "IT", coords: [41.9, 12.5] };
const fetchMock = vi.fn();

function answer(entities: Record<string, unknown>) {
  return Promise.resolve(new Response(JSON.stringify({ entities }), { status: 200 }));
}

function Show({ qid }: { qid: string | null }) {
  const s = useEntity(qid);
  return <p>{s.status === "ready" ? (s.entity ? s.entity.kind : "unknown") : s.status}</p>;
}

describe("entities-client", () => {
  beforeEach(() => {
    __resetEntities();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("asks once for the items not known yet, and keeps them for the session", async () => {
    fetchMock.mockImplementation(() => answer({ Q220: ROME }));
    await requestEntities(["Q220", "Q220"]);
    await requestEntities(["Q220"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/entities?ids=Q220");
    render(<Show qid="Q220" />);
    expect(screen.getByText("place")).toBeInTheDocument();
  });

  it("asks in batches of MAX_IDS", async () => {
    fetchMock.mockImplementation(() => answer({}));
    const ids = Array.from({ length: MAX_IDS + 5 }, (_, i) => `Q${i + 1}`);
    await requestEntities(ids);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0]).split(",")).toHaveLength(MAX_IDS);
    expect(String(fetchMock.mock.calls[1][0]).split(",")).toHaveLength(5);
  });

  it("marks an item the snapshots don't know as ready without an entity", async () => {
    fetchMock.mockImplementation(() => answer({}));
    render(<Show qid="Q404" />);
    await waitFor(() => expect(screen.getByText("unknown")).toBeInTheDocument());
  });

  it("marks a failed request as an error, and asks again on retry", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockImplementationOnce(() => Promise.resolve(new Response("", { status: 502 })));
    render(<Show qid="Q220" />);
    await waitFor(() => expect(screen.getByText("error")).toBeInTheDocument());
    fetchMock.mockImplementation(() => answer({ Q220: ROME }));
    await act(() => requestEntities(["Q220"]));
    expect(screen.getByText("place")).toBeInTheDocument();
    err.mockRestore();
  });

  it("asks for nothing for a mention without an item", () => {
    render(<Show qid={null} />);
    expect(screen.getByText("idle")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prefetches a page's items only while the markup is on", async () => {
    fetchMock.mockImplementation(() => answer({}));
    function Page({ on }: { on: boolean }) {
      usePrefetchEntities(["Q1", "Q2"], on);
      return null;
    }
    const { rerender } = render(<Page on={false} />);
    expect(fetchMock).not.toHaveBeenCalled();
    rerender(<Page on />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/entities?ids=Q1,Q2", expect.anything()));
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run lib/__tests__/entities-client.test.tsx`
Expected: FAIL — module `@/lib/entities-client` not found.

- [ ] **Step 3: Implement**

Create `lib/entities-client.ts`:

```ts
"use client";

import { useEffect, useSyncExternalStore } from "react";
import { MAX_IDS, type Entity } from "@/lib/entities";

/** One item's details in this session: not asked for yet, on their way, failed, or known (null: no snapshot has it). */
export type EntityState = { status: "idle" | "loading" | "error" } | { status: "ready"; entity: Entity | null };

const IDLE: EntityState = { status: "idle" };
const LOADING: EntityState = { status: "loading" };
const ERROR: EntityState = { status: "error" };
// Kept for the session: the snapshots change only with a deploy.
const states = new Map<string, EntityState>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only: forgets every answer. */
export function __resetEntities() {
  states.clear();
}

/** Asks /api/entities for the items not known, nor on their way, MAX_IDS at a time; a failed item is asked again. */
export async function requestEntities(qids: string[]): Promise<void> {
  const wanted = [...new Set(qids)].filter((q) => {
    const s = states.get(q)?.status;
    return s === undefined || s === "idle" || s === "error";
  });
  if (wanted.length === 0) return;
  for (const q of wanted) states.set(q, LOADING);
  emit();
  for (let i = 0; i < wanted.length; i += MAX_IDS) {
    const batch = wanted.slice(i, i + MAX_IDS);
    try {
      const res = await fetch(`/api/entities?ids=${batch.join(",")}`, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { entities } = (await res.json()) as { entities: Record<string, Entity> };
      for (const q of batch) states.set(q, { status: "ready", entity: entities[q] ?? null });
    } catch (err) {
      console.error(`markup: the details of ${batch.length} items could not be loaded`, err);
      for (const q of batch) states.set(q, ERROR);
    }
    emit();
  }
}

/** One item's details; asks for them when nothing has yet (a popup opened before the page's prefetch). */
export function useEntity(qid: string | null): EntityState {
  const state = useSyncExternalStore(subscribe, () => (qid ? states.get(qid) ?? IDLE : IDLE), () => IDLE);
  useEffect(() => {
    if (qid && state.status === "idle") void requestEntities([qid]);
  }, [qid, state.status]);
  return state;
}

/** While the markup is on, asks at once for every item a page names, so its popups open without waiting. */
export function usePrefetchEntities(qids: string[], on: boolean): void {
  const key = qids.join(",");
  useEffect(() => {
    if (on && key) void requestEntities(key.split(","));
  }, [on, key]);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/__tests__/entities-client.test.tsx && npx tsc --noEmit -p .`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/entities-client.ts lib/__tests__/entities-client.test.tsx
git commit -F - <<'EOF'
feat(markup): the reader keeps the popups' details for the session, asked in batches

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv
EOF
```

---

### Task 5: The switch and the Markup messages

**Files:**
- Create: `lib/use-reader-switch.ts`
- Modify: `lib/use-show-ids.ts`, `components/ReaderBar.tsx`, `components/Reader.tsx` (and its `DayView`), `components/Spread.tsx`, `messages/{en,it,fr,de,es,pt}.json`, `lib/__tests__/messages.test.ts`
- Test: `lib/__tests__/use-reader-switch.test.tsx`, `components/__tests__/ReaderBar.test.tsx` (create if absent; if it exists, append the `describe` block), `components/__tests__/Reader.test.tsx`

**Interfaces:**
- Consumes: `hasMentions` (Task 1).
- Produces: ReaderBar prop `markupAvailable: boolean` (the switch is rendered only when true); `DayView` prop `onMentions: (has: boolean) => void`; `Spread` prop `onMentions?: (has: boolean) => void`; `useReaderSwitch(key: string): [boolean, (on: boolean) => void]`; `useMarkupSwitch(): [boolean, (on: boolean) => void]` (key `"reader.markup"`); `__resetReaderSwitches()`; `useShowIds` and `__resetShowIds` unchanged for their callers; ReaderBar props `markup: boolean; onMarkup: (on: boolean) => void`; the `Markup` message namespace with keys `switch, switchTitle, person, place, notLinked, seeOnMap, wikidata, wikipedia, unavailable, retry, loading, lifeBoth, lifeBorn, lifeDied, bc, circa, decade, century, portrait, mapLabel`.

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/use-reader-switch.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { __resetReaderSwitches, useMarkupSwitch, useReaderSwitch } from "@/lib/use-reader-switch";
import { useShowIds } from "@/lib/use-show-ids";

function Both() {
  const [ids, setIds] = useShowIds();
  const [markup, setMarkup] = useMarkupSwitch();
  return (
    <>
      <button onClick={() => setIds(!ids)}>ids {String(ids)}</button>
      <button onClick={() => setMarkup(!markup)}>markup {String(markup)}</button>
    </>
  );
}

describe("useReaderSwitch", () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetReaderSwitches();
  });

  it("starts off, and each switch keeps its own state in its own key", () => {
    render(<Both />);
    fireEvent.click(screen.getByText("markup false"));
    expect(screen.getByText("markup true")).toBeInTheDocument();
    expect(screen.getByText("ids false")).toBeInTheDocument();
    expect(window.localStorage.getItem("reader.markup")).toBe("1");
    expect(window.localStorage.getItem("reader.showIds")).toBeNull();
  });

  it("remembers a switch across visits", () => {
    window.localStorage.setItem("reader.showIds", "1");
    render(<Both />);
    expect(screen.getByText("ids true")).toBeInTheDocument();
  });

  it("follows another tab flipping it", () => {
    function One() {
      const [on] = useReaderSwitch("reader.markup");
      return <p>{String(on)}</p>;
    }
    render(<One />);
    act(() => {
      window.localStorage.setItem("reader.markup", "1");
      window.dispatchEvent(new StorageEvent("storage", { key: "reader.markup" }));
    });
    expect(screen.getByText("true")).toBeInTheDocument();
  });
});
```

If `components/__tests__/ReaderBar.test.tsx` does not exist, create it with this content; otherwise add the `describe` block and the imports it needs:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children }: { href: string; children?: React.ReactNode }) => <a href={href}>{children}</a> }));

import ReaderBar from "@/components/ReaderBar";

const props = {
  edition: "martyrologium_romanum_2004", day: { mm: 1, dd: 1 }, books: [], onGo: vi.fn(), onSwitch: vi.fn(),
  compareWith: null, compareBooks: [], onCompare: vi.fn(), onSwap: vi.fn(), subjects: null, onFind: vi.fn(),
  showIds: false, onShowIds: vi.fn(),
};

describe("ReaderBar's Names & places switch", () => {
  it("is a switch beside Show IDs, telling what it does", () => {
    const onMarkup = vi.fn();
    render(<ReaderBar {...props} markupAvailable markup={false} onMarkup={onMarkup} />);
    const sw = screen.getByRole("switch", { name: "Names & places" });
    expect(sw).not.toBeChecked();
    expect(sw.closest("label")).toHaveAttribute("title", "Mark the persons and places each eulogy names");
    fireEvent.click(sw);
    expect(onMarkup).toHaveBeenCalledWith(true);
  });

  it("is named in the interface language", () => {
    render(<ReaderBar {...props} markupAvailable markup onMarkup={vi.fn()} />, { locale: "it" });
    expect(screen.getByRole("switch", { name: "Nomi e luoghi" })).toBeChecked();
  });

  it("is not rendered when the day on screen names no one and nowhere", () => {
    render(<ReaderBar {...props} markupAvailable={false} markup onMarkup={vi.fn()} />);
    expect(screen.queryByRole("switch", { name: "Names & places" })).toBeNull();
    expect(screen.getByRole("switch", { name: "IDs" })).toBeInTheDocument();
  });
});
```

In `components/__tests__/Reader.test.tsx`, add under the other `vi.mock` calls at the top (the reader now asks for the popups' details while the markup is on):

```tsx
vi.mock("@/lib/entities-client", () => ({
  useEntity: () => ({ status: "idle" }), requestEntities: vi.fn(), usePrefetchEntities: vi.fn(),
}));
```

and append at the end of the file (after `describe("Reader, two editions", …)`, so `EN` and `renderPair` are defined):

```tsx
describe("Reader, the Names & places switch", () => {
  const MENTION = { kind: "place", where: "text", start: 0, end: 5, form: "Romae", name: null, qid: "Q220" } as const;
  const named = (day: typeof DAY, edition: string) => ({
    ...day, metadata: { ...day.metadata, edition }, elogia: [{ ...day.elogia[0], mentions: [MENTION] }],
  });

  it("shows when the day on screen names someone or somewhere", async () => {
    vi.mocked(getDay).mockResolvedValue(named(DAY, "martyrologium_romanum_1749"));
    render1749();
    expect(await screen.findByRole("switch", { name: "Names & places" })).toBeInTheDocument();
  });

  it("is not rendered on a day without mentions, and the stored choice is left alone", async () => {
    window.localStorage.setItem("reader.markup", "1");
    render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    expect(screen.queryByRole("switch", { name: "Names & places" })).toBeNull();
    expect(window.localStorage.getItem("reader.markup")).toBe("1");
  });

  it("shows in the compare view when either column has a mention", async () => {
    vi.mocked(getDay).mockImplementation(async (edition: string) =>
      edition === EN ? named(DAY, EN) : DAY);
    renderPair();
    expect(await screen.findByRole("switch", { name: "Names & places" })).toBeInTheDocument();
  });
});
```
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run lib/__tests__/use-reader-switch.test.tsx components/__tests__/ReaderBar.test.tsx`
Expected: FAIL — `@/lib/use-reader-switch` not found; no switch named "Names & places". (Run the Reader tests in Step 6.)

- [ ] **Step 3: Write `lib/use-reader-switch.ts`**

```ts
"use client";

import { useCallback, useSyncExternalStore } from "react";

type Store = { current: boolean | null; listeners: Set<() => void> };
const stores = new Map<string, Store>();
let subscribed = 0;

function store(key: string): Store {
  let s = stores.get(key);
  if (!s) {
    // This tab's choice, so the switch still works where storage is blocked.
    s = { current: null, listeners: new Set() };
    stores.set(key, s);
  }
  return s;
}

function onStorage(e: StorageEvent) {
  const s = e.key ? stores.get(e.key) : undefined;
  if (!s) return;
  s.current = null; // another tab flipped it: read it afresh
  s.listeners.forEach((l) => l());
}

/** Test-only: forgets this tab's choices. */
export function __resetReaderSwitches() {
  for (const s of stores.values()) s.current = null;
}

/** One of the reader's switches, remembered in this browser under `key` across days and visits; off by default. */
export function useReaderSwitch(key: string): [boolean, (on: boolean) => void] {
  const subscribe = useCallback(
    (listener: () => void) => {
      const s = store(key);
      if (subscribed++ === 0) window.addEventListener("storage", onStorage);
      s.listeners.add(listener);
      return () => {
        s.listeners.delete(listener);
        if (--subscribed === 0) window.removeEventListener("storage", onStorage);
      };
    },
    [key],
  );
  const read = useCallback(() => {
    const s = store(key);
    if (s.current !== null) return s.current;
    try {
      return window.localStorage.getItem(key) === "1";
    } catch {
      return false; // storage blocked: the switch starts off
    }
  }, [key]);
  const on = useSyncExternalStore(subscribe, read, () => false);
  const set = useCallback(
    (next: boolean) => {
      const s = store(key);
      s.current = next;
      try {
        window.localStorage.setItem(key, next ? "1" : "0");
      } catch {
        // storage blocked: nothing to remember it in
      }
      s.listeners.forEach((l) => l());
    },
    [key],
  );
  return [on, set];
}

/** The reader's "Names & places" switch: marks the persons and places the eulogies name. */
export function useMarkupSwitch(): [boolean, (on: boolean) => void] {
  return useReaderSwitch("reader.markup");
}
```

Replace the whole of `lib/use-show-ids.ts` with:

```ts
"use client";

import { __resetReaderSwitches, useReaderSwitch } from "@/lib/use-reader-switch";

/** Test-only: forgets this tab's choice. */
export const __resetShowIds = __resetReaderSwitches;

/** The reader's "show canonical ids" switch, remembered in this browser across days and visits. */
export function useShowIds(): [boolean, (on: boolean) => void] {
  return useReaderSwitch("reader.showIds");
}
```

- [ ] **Step 4: Add the messages**

In each `messages/<locale>.json`, add a top-level `"Markup"` object after `"Reader"` (the `messages` test requires the same keys in all six). English:

```json
  "Markup": {
    "switch": "Names & places",
    "switchTitle": "Mark the persons and places each eulogy names",
    "person": "person",
    "place": "place",
    "notLinked": "Not yet linked to Wikidata",
    "seeOnMap": "See on the map",
    "wikidata": "Wikidata",
    "wikipedia": "Wikipedia",
    "unavailable": "Details unavailable.",
    "retry": "Try again",
    "loading": "Loading…",
    "lifeBoth": "{born} – {died}",
    "lifeBorn": "born {born}",
    "lifeDied": "died {died}",
    "bc": "{date} BC",
    "circa": "c. {date}",
    "decade": "{decade}s",
    "century": "{ordinal} century",
    "portrait": "Portrait of {name}",
    "mapLabel": "Map of {name}"
  },
```

Italian:

```json
  "Markup": {
    "switch": "Nomi e luoghi",
    "switchTitle": "Evidenzia le persone e i luoghi che ogni elogio nomina",
    "person": "persona",
    "place": "luogo",
    "notLinked": "Non ancora collegato a Wikidata",
    "seeOnMap": "Vedi sulla mappa",
    "wikidata": "Wikidata",
    "wikipedia": "Wikipedia",
    "unavailable": "Dettagli non disponibili.",
    "retry": "Riprova",
    "loading": "Caricamento…",
    "lifeBoth": "{born} – {died}",
    "lifeBorn": "nato nel {born}",
    "lifeDied": "morto nel {died}",
    "bc": "{date} a.C.",
    "circa": "ca. {date}",
    "decade": "anni {decade}",
    "century": "{ordinal} secolo",
    "portrait": "Ritratto di {name}",
    "mapLabel": "Mappa di {name}"
  },
```

French:

```json
  "Markup": {
    "switch": "Noms et lieux",
    "switchTitle": "Signaler les personnes et les lieux que nomme chaque éloge",
    "person": "personne",
    "place": "lieu",
    "notLinked": "Pas encore lié à Wikidata",
    "seeOnMap": "Voir sur la carte",
    "wikidata": "Wikidata",
    "wikipedia": "Wikipedia",
    "unavailable": "Détails indisponibles.",
    "retry": "Réessayer",
    "loading": "Chargement…",
    "lifeBoth": "{born} – {died}",
    "lifeBorn": "né en {born}",
    "lifeDied": "mort en {died}",
    "bc": "{date} av. J.-C.",
    "circa": "v. {date}",
    "decade": "années {decade}",
    "century": "{ordinal}e siècle",
    "portrait": "Portrait de {name}",
    "mapLabel": "Carte de {name}"
  },
```

German:

```json
  "Markup": {
    "switch": "Namen und Orte",
    "switchTitle": "Die Personen und Orte kennzeichnen, die jedes Elogium nennt",
    "person": "Person",
    "place": "Ort",
    "notLinked": "Noch nicht mit Wikidata verknüpft",
    "seeOnMap": "Auf der Karte zeigen",
    "wikidata": "Wikidata",
    "wikipedia": "Wikipedia",
    "unavailable": "Details nicht verfügbar.",
    "retry": "Erneut versuchen",
    "loading": "Wird geladen…",
    "lifeBoth": "{born} – {died}",
    "lifeBorn": "geb. {born}",
    "lifeDied": "gest. {died}",
    "bc": "{date} v. Chr.",
    "circa": "um {date}",
    "decade": "{decade}er Jahre",
    "century": "{ordinal}. Jahrhundert",
    "portrait": "Porträt von {name}",
    "mapLabel": "Karte von {name}"
  },
```

Spanish:

```json
  "Markup": {
    "switch": "Nombres y lugares",
    "switchTitle": "Señalar las personas y los lugares que nombra cada elogio",
    "person": "persona",
    "place": "lugar",
    "notLinked": "Aún no vinculado a Wikidata",
    "seeOnMap": "Ver en el mapa",
    "wikidata": "Wikidata",
    "wikipedia": "Wikipedia",
    "unavailable": "Detalles no disponibles.",
    "retry": "Reintentar",
    "loading": "Cargando…",
    "lifeBoth": "{born} – {died}",
    "lifeBorn": "nacido en {born}",
    "lifeDied": "fallecido en {died}",
    "bc": "{date} a. C.",
    "circa": "c. {date}",
    "decade": "década de {decade}",
    "century": "siglo {ordinal}",
    "portrait": "Retrato de {name}",
    "mapLabel": "Mapa de {name}"
  },
```

Portuguese:

```json
  "Markup": {
    "switch": "Nomes e lugares",
    "switchTitle": "Assinalar as pessoas e os lugares que cada elogio nomeia",
    "person": "pessoa",
    "place": "lugar",
    "notLinked": "Ainda não vinculado ao Wikidata",
    "seeOnMap": "Ver no mapa",
    "wikidata": "Wikidata",
    "wikipedia": "Wikipedia",
    "unavailable": "Detalhes indisponíveis.",
    "retry": "Tentar novamente",
    "loading": "Carregando…",
    "lifeBoth": "{born} – {died}",
    "lifeBorn": "nascido em {born}",
    "lifeDied": "falecido em {died}",
    "bc": "{date} a.C.",
    "circa": "c. {date}",
    "decade": "década de {decade}",
    "century": "século {ordinal}",
    "portrait": "Retrato de {name}",
    "mapLabel": "Mapa de {name}"
  },
```

In `lib/__tests__/messages.test.ts`, add to `SAME_AS_ENGLISH` (after the `"Footer.repos.website"` line):

```ts
  // Names of the two sites, and a format made only of arguments and a dash; "c." for circa in Spanish and Portuguese too.
  "Markup.wikidata": ALL, "Markup.wikipedia": ALL, "Markup.lifeBoth": ALL, "Markup.circa": ["es", "pt"],
```

- [ ] **Step 5: Add the switch to the reader bar**

In `components/ReaderBar.tsx`, add `markupAvailable`, `markup` and `onMarkup` to the destructured props and to the props type (after `onShowIds: (on: boolean) => void;`):

```ts
  /** Whether the day on screen names anyone or anywhere: the "Names & places" switch is drawn only then. */
  markupAvailable: boolean;
  markup: boolean;
  onMarkup: (on: boolean) => void;
```

Add `const tm = useTranslations("Markup");` under `const t = useTranslations("Reader");`. Replace the show-IDs `<label>…</label>` with a shared switch, and add the new one after it. Above `export default function ReaderBar`, add:

```tsx
/** A switch of the reader bar: a checkbox announced as a switch, drawn as a sliding knob. */
function Switch({ id, label, title, checked, onChange }: {
  id: string; label: string; title: string; checked: boolean; onChange: (on: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-sm" title={title}>
      <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={
          "relative h-5 w-9 shrink-0 rounded-full bg-slate-300 transition-colors dark:bg-slate-600 " +
          "peer-checked:bg-[#0b6e7f] peer-focus-visible:ring-2 peer-focus-visible:ring-[#0b6e7f]/50 " +
          "after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white " +
          "after:shadow after:transition-transform peer-checked:after:translate-x-4"
        }
      />
      {label}
    </label>
  );
}
```

and in the JSX:

```tsx
      <Switch id="reader-ids" label={t("ids")} title={t("showIdsTitle")} checked={showIds} onChange={onShowIds} />
      {markupAvailable && (
        <Switch id="reader-markup" label={tm("switch")} title={tm("switchTitle")} checked={markup} onChange={onMarkup} />
      )}
```

(Hidden, the switch only goes unrendered: its stored value in `reader.markup` is never written.)

In `components/Reader.tsx`:

- import `useMarkupSwitch` from `@/lib/use-reader-switch` and `hasMentions` from `@/lib/mentions`;
- under the `useShowIds()` line, add:

```ts
  const [markup, setMarkup] = useMarkupSwitch();
  // Whether the day on screen names anyone or anywhere (either column of a spread): the switch shows only then.
  const [named, setNamed] = useState(false);
```

- pass `markupAvailable={named}`, `markup={markup}` and `onMarkup={setMarkup}` to `<ReaderBar …>` after `onShowIds={setShowIds}`;
- pass `onMentions={setNamed}` to both `<Spread …>` and `<DayView …>`;
- in `DayView`, add `onMentions` to its props (`onMentions: (has: boolean) => void;`) and, between the `useDay` line and the `if (state.kind !== "ready")` return:

```ts
  const ready = state.kind === "ready" ? state.day : null;
  // A day still loading, locked or failed names no one: the switch hides until a page with mentions is drawn.
  useEffect(() => onMentions(ready !== null && hasMentions(ready.elogia)), [ready, onMentions]);
```

In `components/Spread.tsx`, add `useEffect` to the React import and `hasMentions` from `@/lib/mentions`; add to the props `onMentions` (destructured) and to its type `/** Told whether either sheet names anyone or anywhere. */ onMentions?: (has: boolean) => void;`; after `const sb = dayB.state;` add:

```ts
  useEffect(() => {
    const elogia = [...(sa.kind === "ready" ? sa.day.elogia : []), ...(sb.kind === "ready" ? sb.day.elogia : [])];
    onMentions?.(hasMentions(elogia));
  }, [sa, sb, onMentions]);
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run lib/__tests__/use-reader-switch.test.tsx components/__tests__/ReaderBar.test.tsx components/__tests__/Reader.test.tsx lib/__tests__/messages.test.ts && npx tsc --noEmit -p .`
Expected: PASS (the Reader tests still pass: `__resetShowIds` resets both switches).

- [ ] **Step 7: Commit**

```bash
git add lib/use-reader-switch.ts lib/use-show-ids.ts components/ReaderBar.tsx components/Reader.tsx components/Spread.tsx messages/ lib/__tests__/messages.test.ts lib/__tests__/use-reader-switch.test.tsx components/__tests__/ReaderBar.test.tsx components/__tests__/Reader.test.tsx
git commit -F - <<'EOF'
feat(markup): the reader's "Names & places" switch, remembered like "Show IDs", shown on days that name someone

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv
EOF
```

---

### Task 6: Pure helpers for the popups

**Files:**
- Create: `lib/popup-position.ts`, `lib/life-years.ts`, `lib/wikimedia.ts`, `lib/mention-labels.ts`
- Test: `lib/__tests__/popup-helpers.test.ts`

**Interfaces:**
- Consumes: `Labels`, `WikidataDate` (Task 2); the `Markup` messages (Task 5).
- Produces: `popupPosition(anchor: Box, size: {width; height}, viewport: {width; height}, gap?: number, margin?: number): { top: number; left: number; placement: "below" | "above" }`; `MarkupT`; `centuryOrdinal(n: number, locale: Locale): string`; `formatWikidataDate(t: MarkupT, locale: Locale, d: WikidataDate): string`; `lifeYears(t: MarkupT, locale: Locale, born: WikidataDate | null, died: WikidataDate | null): string | null`; `commonsThumb(file, width)`, `commonsPage(file)`, `wikipediaUrl(lang, title)`, `wikidataUrl(qid)`; `inLanguage(labels: Labels | undefined, locale: Locale, fallback: string | null, fallbackLang: string | null): { text: string; lang: string | null } | null`.

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/popup-helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import it_ from "@/messages/it.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import { popupPosition } from "@/lib/popup-position";
import { centuryOrdinal, formatWikidataDate, lifeYears, type MarkupT } from "@/lib/life-years";
import type { WikidataDate } from "@/lib/entities";
import { commonsPage, commonsThumb, wikidataUrl, wikipediaUrl } from "@/lib/wikimedia";
import { inLanguage } from "@/lib/mention-labels";

const vp = { width: 800, height: 600 };
const size = { width: 288, height: 200 };
const box = (top: number, left: number) => ({ top, bottom: top + 20, left, right: left + 60 });

describe("popupPosition", () => {
  it("sets the popup below its mention, at its left edge", () => {
    expect(popupPosition(box(100, 50), size, vp)).toEqual({ top: 126, left: 50, placement: "below" });
  });
  it("flips above a mention near the bottom of the window", () => {
    expect(popupPosition(box(500, 50), size, vp)).toEqual({ top: 294, left: 50, placement: "above" });
  });
  it("shifts left to stay in the window", () => {
    expect(popupPosition(box(100, 700), size, vp).left).toBe(800 - 288 - 8);
  });
  it("stays below when it fits neither way and there is more room below", () => {
    expect(popupPosition(box(40, 50), { width: 288, height: 700 }, vp).placement).toBe("below");
  });
});

describe("dates", () => {
  const tr = (locale: "en" | "it" | "fr" | "de", messages: object) =>
    createTranslator({ locale, messages: messages as typeof en, namespace: "Markup" }) as unknown as MarkupT;
  const t = tr("en", en);
  const ti = tr("it", it_);
  const tf = tr("fr", fr);
  const td = tr("de", de);
  const d = (year: number, precision: WikidataDate["precision"] = "year", circa = false): WikidataDate => ({ year, precision, circa });

  it("writes a year as it is", () => {
    expect(formatWikidataDate(t, "en", d(329))).toBe("329");
    expect(formatWikidataDate(t, "en", d(1900))).toBe("1900");
  });

  it("marks a circa date in each language", () => {
    expect(formatWikidataDate(t, "en", d(329, "year", true))).toBe("c. 329");
    expect(formatWikidataDate(ti, "it", d(329, "year", true))).toBe("ca. 329");
    expect(formatWikidataDate(td, "de", d(329, "year", true))).toBe("um 329");
  });

  it("writes a decade from any year in it", () => {
    expect(formatWikidataDate(t, "en", d(325, "decade"))).toBe("320s");
    expect(formatWikidataDate(ti, "it", d(1920, "decade"))).toBe("anni 1920");
    expect(formatWikidataDate(td, "de", d(320, "decade"))).toBe("320er Jahre");
  });

  it("writes a century from any year in it, with each language's ordinal", () => {
    expect(centuryOrdinal(4, "en")).toBe("4th");
    expect(centuryOrdinal(21, "en")).toBe("21st");
    expect(centuryOrdinal(12, "en")).toBe("12th");
    expect(centuryOrdinal(4, "it")).toBe("IV");
    expect(centuryOrdinal(4, "de")).toBe("4");
    expect(formatWikidataDate(t, "en", d(400, "century"))).toBe("4th century");
    expect(formatWikidataDate(t, "en", d(301, "century"))).toBe("4th century");
    expect(formatWikidataDate(t, "en", d(1201, "century"))).toBe("13th century");
    expect(formatWikidataDate(ti, "it", d(350, "century"))).toBe("IV secolo");
    expect(formatWikidataDate(tf, "fr", d(350, "century"))).toBe("IVe siècle");
    expect(formatWikidataDate(td, "de", d(350, "century"))).toBe("4. Jahrhundert");
  });

  it("writes a date before Christ, whatever its precision, circa outermost", () => {
    expect(formatWikidataDate(t, "en", d(-10))).toBe("10 BC");
    expect(formatWikidataDate(t, "en", d(-150, "century"))).toBe("2nd century BC");
    expect(formatWikidataDate(t, "en", d(-10, "year", true))).toBe("c. 10 BC");
    expect(formatWikidataDate(ti, "it", d(-10))).toBe("10 a.C.");
  });

  it("writes the life span with whichever dates are known", () => {
    expect(lifeYears(t, "en", d(329, "year", true), d(379))).toBe("c. 329 – 379");
    expect(lifeYears(t, "en", null, d(258))).toBe("died 258");
    expect(lifeYears(t, "en", d(1900), null)).toBe("born 1900");
    expect(lifeYears(t, "en", null, null)).toBeNull();
    expect(lifeYears(ti, "it", null, d(258))).toBe("morto nel 258");
  });
});

describe("wikimedia", () => {
  it("builds the Commons, Wikipedia and Wikidata URLs", () => {
    expect(commonsThumb("Basil of Caesarea.jpg", 96)).toBe("https://commons.wikimedia.org/wiki/Special:FilePath/Basil_of_Caesarea.jpg?width=96");
    expect(commonsPage("Basil of Caesarea.jpg")).toBe("https://commons.wikimedia.org/wiki/File:Basil_of_Caesarea.jpg");
    expect(wikipediaUrl("it", "Basilio di Cesarea")).toBe("https://it.wikipedia.org/wiki/Basilio_di_Cesarea");
    expect(wikidataUrl("Q19546")).toBe("https://www.wikidata.org/wiki/Q19546");
  });
});

describe("inLanguage", () => {
  it("takes the interface language, else English, else the fallback, saying which", () => {
    expect(inLanguage({ it: "Roma", en: "Rome" }, "it", "Romæ", "la")).toEqual({ text: "Roma", lang: "it" });
    expect(inLanguage({ en: "Rome" }, "de", "Romæ", "la")).toEqual({ text: "Rome", lang: "en" });
    expect(inLanguage({}, "de", "Basilius", "la")).toEqual({ text: "Basilius", lang: "la" });
    expect(inLanguage(undefined, "de", null, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run lib/__tests__/popup-helpers.test.ts`
Expected: FAIL — the four modules are not found.

- [ ] **Step 3: Implement**

Create `lib/popup-position.ts`:

```ts
/** A rectangle in the window, as getBoundingClientRect gives it. */
export interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Where a popup of `size` goes beside its mention (fixed coordinates): below it, else above it when it fits
 * there and not below, at the mention's left edge shifted to stay `margin` inside the window.
 */
export function popupPosition(
  anchor: Box, size: { width: number; height: number }, viewport: { width: number; height: number }, gap = 6, margin = 8,
): { top: number; left: number; placement: "below" | "above" } {
  const below = anchor.bottom + gap;
  const above = anchor.top - gap - size.height;
  const fitsBelow = below + size.height <= viewport.height - margin;
  const fitsAbove = above >= margin;
  const placement = fitsBelow || (!fitsAbove && viewport.height - anchor.bottom >= anchor.top) ? "below" : "above";
  const top = placement === "below" ? below : Math.max(margin, above);
  const left = Math.min(Math.max(anchor.left, margin), Math.max(margin, viewport.width - size.width - margin));
  return { top, left, placement };
}
```

Create `lib/life-years.ts`:

```ts
import type { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { WikidataDate } from "@/lib/entities";

/** The translator of the `Markup` namespace. */
export type MarkupT = ReturnType<typeof useTranslations<"Markup">>;

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"],
  [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

function roman(n: number): string {
  let out = "";
  for (const [v, r] of ROMAN) {
    for (; n >= v; n -= v) out += r;
  }
  return out;
}

const EN_ORDINAL: Record<string, string> = { one: "st", two: "nd", few: "rd" };

/**
 * A century's number as each language writes it in its message (Markup.century): "4th" in English, "4" in German
 * (the message adds the full stop), Roman numerals in the Romance languages ("IV", the French message adds "e").
 */
export function centuryOrdinal(n: number, locale: Locale): string {
  if (locale === "en") return `${n}${EN_ORDINAL[new Intl.PluralRules("en", { type: "ordinal" }).select(n)] ?? "th"}`;
  return locale === "de" ? String(n) : roman(n);
}

/**
 * One Wikidata date at the precision Wikidata gives it: "329", "320s", "4th century", in the interface language,
 * "BC" after a date before Christ and "c." around a circa one. A decade or century is found from any year in it.
 * Years are strings to the messages, so 1900 is never written "1,900".
 */
export function formatWikidataDate(t: MarkupT, locale: Locale, d: WikidataDate): string {
  const y = Math.abs(d.year);
  const base =
    d.precision === "century"
      ? t("century", { ordinal: centuryOrdinal(Math.floor((y - 1) / 100) + 1, locale) })
      : d.precision === "decade"
        ? t("decade", { decade: String(Math.floor(y / 10) * 10) })
        : String(y);
  const dated = d.year < 0 ? t("bc", { date: base }) : base;
  return d.circa ? t("circa", { date: dated }) : dated;
}

/** A person's life span for the popup, born – died with whichever Wikidata knows; null when it knows neither. */
export function lifeYears(t: MarkupT, locale: Locale, born: WikidataDate | null, died: WikidataDate | null): string | null {
  const b = born ? formatWikidataDate(t, locale, born) : null;
  const d = died ? formatWikidataDate(t, locale, died) : null;
  if (b && d) return t("lifeBoth", { born: b, died: d });
  if (d) return t("lifeDied", { died: d });
  if (b) return t("lifeBorn", { born: b });
  return null;
}
```

Create `lib/wikimedia.ts`:

```ts
/** A page or file title as Wikimedia URLs spell it: underscores for spaces, the rest encoded. */
const title = (s: string) => encodeURIComponent(s.replace(/ /g, "_"));

/** A Commons file scaled to `width` px (Special:FilePath redirects to upload.wikimedia.org). */
export const commonsThumb = (file: string, width: number) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${title(file)}?width=${width}`;

/** A Commons file's page, with its author and license. */
export const commonsPage = (file: string) => `https://commons.wikimedia.org/wiki/File:${title(file)}`;

export const wikipediaUrl = (lang: string, page: string) => `https://${lang}.wikipedia.org/wiki/${title(page)}`;

export const wikidataUrl = (qid: string) => `https://www.wikidata.org/wiki/${qid}`;
```

Create `lib/mention-labels.ts`:

```ts
import type { Locale } from "@/i18n/routing";
import type { Labels } from "@/lib/entities";

/**
 * A text in the interface language, else in English, else `fallback` (in `fallbackLang`), with the language it
 * is in, so the page can tag it; null when there is none.
 */
export function inLanguage(
  labels: Labels | undefined, locale: Locale, fallback: string | null, fallbackLang: string | null,
): { text: string; lang: string | null } | null {
  if (labels?.[locale]) return { text: labels[locale]!, lang: locale };
  if (labels?.en) return { text: labels.en, lang: "en" };
  return fallback ? { text: fallback, lang: fallbackLang } : null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/__tests__/popup-helpers.test.ts && npx tsc --noEmit -p .`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/popup-position.ts lib/life-years.ts lib/wikimedia.ts lib/mention-labels.ts lib/__tests__/popup-helpers.test.ts
git commit -F - <<'EOF'
feat(markup): the popups' helpers: placement, years, Wikimedia links, labels by language

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv
EOF
```

---

### Task 7: The person popup

**Files:**
- Create: `components/markup/Unavailable.tsx`, `components/markup/MentionPersonCard.tsx`
- Test: `components/__tests__/MentionPersonCard.test.tsx`

**Interfaces:**
- Consumes: `PlacedMention` (Task 1); `useEntity`, `requestEntities` (Task 4); `lifeYears(t, locale, born, died)`, `commonsThumb`, `commonsPage`, `wikipediaUrl`, `wikidataUrl`, `inLanguage` (Task 6); `langOn` (`i18n/routing.ts`).
- Produces: `Unavailable({ qid }: { qid: string })`; `MentionPersonCard({ mention, headingId }: { mention: PlacedMention; headingId: string })` (default export).

- [ ] **Step 1: Write the failing tests**

Create `components/__tests__/MentionPersonCard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@/test/intl";
import type { EntityState } from "@/lib/entities-client";

const { state, request } = vi.hoisted(() => ({ state: { current: { status: "idle" } as EntityState }, request: vi.fn() }));
vi.mock("@/lib/entities-client", () => ({ useEntity: () => state.current, requestEntities: request }));

import MentionPersonCard from "@/components/markup/MentionPersonCard";
import type { PlacedMention } from "@/lib/mentions";

const basil: PlacedMention = {
  kind: "person", where: "text", start: 40, end: 47, form: "Basilíi", name: "Basilius", qid: "Q19546",
  key: "mr:0101-basilius|text|40", eulogy: "mr:0101-basilius",
};
const BASIL = {
  kind: "person" as const,
  labels: { en: "Basil of Caesarea", it: "Basilio di Cesarea" },
  details: {
    description: { en: "Greek bishop and Doctor of the Church" }, born: { year: 329, precision: "year", circa: false }, died: { year: 379, precision: "year", circa: false },
    image: { file: "Basil of Caesarea.jpg", author: "Anonymous", license: "Public domain", license_url: null },
    wikipedia: { it: "Basilio di Cesarea" },
  },
};
const card = (m = basil, locale: "en" | "it" | "de" = "en") =>
  render(<MentionPersonCard mention={m} headingId="h" />, { locale });

describe("MentionPersonCard", () => {
  beforeEach(() => {
    state.current = { status: "ready", entity: BASIL };
    request.mockReset();
  });

  it("names the person in the interface language, with years, description, portrait and links", () => {
    card(basil, "it");
    expect(screen.getByRole("heading", { name: "Basilio di Cesarea" })).not.toHaveAttribute("lang");
    expect(screen.getByText("329 – 379")).toBeInTheDocument();
    expect(screen.getByText("Greek bishop and Doctor of the Church")).toHaveAttribute("lang", "en");
    const img = screen.getByRole("img", { name: "Ritratto di Basilio di Cesarea" });
    expect(img).toHaveAttribute("src", "https://commons.wikimedia.org/wiki/Special:FilePath/Basil_of_Caesarea.jpg?width=96");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(screen.getByRole("link", { name: "Anonymous" })).toHaveAttribute("href", "https://commons.wikimedia.org/wiki/File:Basil_of_Caesarea.jpg");
    expect(screen.getByText(/Public domain/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wikipedia" })).toHaveAttribute("href", "https://it.wikipedia.org/wiki/Basilio_di_Cesarea");
    expect(screen.getByRole("link", { name: "Wikidata" })).toHaveAttribute("href", "https://www.wikidata.org/wiki/Q19546");
  });

  it("credits a portrait without a known author by its license alone", () => {
    const image = { file: "Basil.jpg", author: null, license: "CC BY-SA 4.0", license_url: "https://creativecommons.org/licenses/by-sa/4.0" };
    state.current = { status: "ready", entity: { ...BASIL, details: { ...BASIL.details, image } } };
    const { container } = card();
    const credit = container.querySelector("figcaption")!;
    expect(credit.textContent).toBe("CC BY-SA 4.0");
    expect(screen.getByRole("link", { name: "CC BY-SA 4.0" })).toHaveAttribute("href", "https://creativecommons.org/licenses/by-sa/4.0");
  });

  it("names a license without a link as plain text", () => {
    const { container } = card();
    expect(container.querySelector("figcaption")!.textContent).toBe("Anonymous · Public domain");
    expect(screen.queryByRole("link", { name: "Public domain" })).toBeNull();
  });

  it("shows no portrait when Wikidata has none", () => {
    state.current = { status: "ready", entity: { ...BASIL, details: { ...BASIL.details, image: null } } };
    card();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("falls back to the English name, tagged, and offers no Wikipedia article in another language", () => {
    card(basil, "de");
    expect(screen.getByRole("heading", { name: "Basil of Caesarea" })).toHaveAttribute("lang", "en");
    expect(screen.queryByRole("link", { name: "Wikipedia" })).toBeNull();
  });

  it("a QID the snapshots don't know: the Latin name, tagged, and Wikidata", () => {
    state.current = { status: "ready", entity: null };
    card();
    expect(screen.getByRole("heading", { name: "Basilius" })).toHaveAttribute("lang", "la");
    expect(screen.getByRole("link", { name: "Wikidata" })).toBeInTheDocument();
    expect(screen.queryByText("Details unavailable.")).toBeNull();
  });

  it("a person not yet linked: the Latin name, the notice and the eulogy's ID", () => {
    card({ ...basil, qid: null });
    expect(screen.getByRole("heading", { name: "Basilius" })).toHaveAttribute("lang", "la");
    expect(screen.getByText("Not yet linked to Wikidata")).toBeInTheDocument();
    expect(screen.getByText("mr:0101-basilius")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Wikidata" })).toBeNull();
  });

  it("when the details fail: the printed name, the notice and a retry", () => {
    state.current = { status: "error" };
    card();
    expect(screen.getByRole("heading", { name: "Basilius" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(request).toHaveBeenCalledWith(["Q19546"]);
  });

  it("says it is loading while the details are on their way", () => {
    state.current = { status: "loading" };
    card();
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run components/__tests__/MentionPersonCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `components/markup/Unavailable.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { requestEntities } from "@/lib/entities-client";

/** The popup's note when its details could not be loaded, with a way to ask again. */
export function Unavailable({ qid }: { qid: string }) {
  const t = useTranslations("Markup");
  return (
    <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
      {t("unavailable")}{" "}
      <button type="button" className="underline" onClick={() => void requestEntities([qid])}>
        {t("retry")}
      </button>
    </p>
  );
}

/** The popup's note while its details are on their way. */
export function Loading() {
  const t = useTranslations("Markup");
  return <p role="status" className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">{t("loading")}</p>;
}
```

Create `components/markup/MentionPersonCard.tsx`:

```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import { langOn, type Locale } from "@/i18n/routing";
import { Loading, Unavailable } from "@/components/markup/Unavailable";
import { useEntity } from "@/lib/entities-client";
import { lifeYears } from "@/lib/life-years";
import { inLanguage } from "@/lib/mention-labels";
import type { PlacedMention } from "@/lib/mentions";
import { commonsPage, commonsThumb, wikidataUrl, wikipediaUrl } from "@/lib/wikimedia";

/**
 * A person's popup: their name in the interface language (else English, else the Latin nominative, each tagged),
 * years, description, portrait with its credit, and links to Wikipedia (in the interface language only) and
 * Wikidata. A person crmedr has not linked yet shows the Latin name, a notice and the eulogy's canonical ID.
 */
export default function MentionPersonCard({ mention, headingId }: { mention: PlacedMention; headingId: string }) {
  const t = useTranslations("Markup");
  const locale = useLocale() as Locale;
  const state = useEntity(mention.qid);
  const latin = mention.name ?? mention.form;
  if (!mention.qid) {
    return (
      <>
        <h2 id={headingId} className="font-semibold" lang={langOn("la", locale)}>{latin}</h2>
        <p className="mt-1 text-slate-600 dark:text-slate-400">{t("notLinked")}</p>
        <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">{mention.eulogy}</p>
      </>
    );
  }
  const person = state.status === "ready" && state.entity?.kind === "person" ? state.entity : null;
  const details = person?.details ?? null;
  const name = inLanguage(person?.labels, locale, latin, "la")!;
  const years = details ? lifeYears(t, locale, details.born, details.died) : null;
  const description = inLanguage(details?.description, locale, null, null);
  const article = details?.wikipedia[locale];
  const image = details?.image ?? null;
  return (
    <>
      <div className="flex gap-3">
        {image && (
          <figure className="w-24 shrink-0">
            <a href={commonsPage(image.file)} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- a remote Commons thumbnail, shown as is */}
              <img src={commonsThumb(image.file, 96)} alt={t("portrait", { name: name.text })} width={96} loading="lazy" className="rounded" />
            </a>
            <figcaption className="mt-1 text-[0.7rem] leading-tight text-slate-500 dark:text-slate-400">
              {image.author && (
                <>
                  <a href={commonsPage(image.file)} target="_blank" rel="noreferrer" className="underline">{image.author}</a>
                  {" · "}
                </>
              )}
              {image.license_url ? (
                <a href={image.license_url} target="_blank" rel="noreferrer" className="underline">{image.license}</a>
              ) : (
                image.license
              )}
            </figcaption>
          </figure>
        )}
        <div className="min-w-0">
          <h2 id={headingId} className="font-semibold" lang={langOn(name.lang, locale)}>{name.text}</h2>
          {years && <p className="text-slate-600 dark:text-slate-400">{years}</p>}
          {description && <p className="mt-1" lang={langOn(description.lang, locale)}>{description.text}</p>}
          <p className="mt-2 flex gap-3 text-xs">
            {article && (
              <a href={wikipediaUrl(locale, article)} target="_blank" rel="noreferrer" className="underline">{t("wikipedia")}</a>
            )}
            <a href={wikidataUrl(mention.qid)} target="_blank" rel="noreferrer" className="underline">{t("wikidata")}</a>
          </p>
        </div>
      </div>
      {(state.status === "loading" || state.status === "idle") && <Loading />}
      {state.status === "error" && <Unavailable qid={mention.qid} />}
    </>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run components/__tests__/MentionPersonCard.test.tsx && npx tsc --noEmit -p . && npx eslint components/markup`
Expected: PASS, no lint errors.

- [ ] **Step 5: Commit**

```bash
git add components/markup/Unavailable.tsx components/markup/MentionPersonCard.tsx components/__tests__/MentionPersonCard.test.tsx
git commit -F - <<'EOF'
feat(markup): the person popup: name by language, years, description, portrait, links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv
EOF
```

---

### Task 8: The place popup and its lazy map

**Files:**
- Create: `lib/esri-tiles.ts`, `components/markup/MentionMap.tsx`, `components/markup/MentionPlaceCard.tsx`
- Modify: `components/PlaceMap.tsx`, `components/EulogyMap.tsx` (use the shared tile constants)
- Test: `components/__tests__/MentionPlaceCard.test.tsx`

**Interfaces:**
- Consumes: `PlacedMention`; `useEntity`; `Loading`, `Unavailable` (Task 7); `placeLabel`, `placeLabelLang` (`lib/places-index.ts`); `langOn`; `wikidataUrl`; `Link` (`@/i18n/navigation`).
- Produces: `ESRI_STREET_TILES: string`, `ESRI_ATTRIBUTION: string`; `MentionMap({ coords, label })` (default export); `MentionPlaceCard({ mention, edition, lang, headingId }: { mention: PlacedMention; edition: string; lang: string | undefined; headingId: string })` (default export).

- [ ] **Step 1: Write the failing tests**

Create `components/__tests__/MentionPlaceCard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@/test/intl";
import type { EntityState } from "@/lib/entities-client";

const { state, mapSpy, setView } = vi.hoisted(() => ({
  state: { current: { status: "idle" } as EntityState }, mapSpy: vi.fn(), setView: vi.fn(),
}));
vi.mock("@/lib/entities-client", () => ({ useEntity: () => state.current, requestEntities: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children, ...p }: { href: string; children?: React.ReactNode }) => <a href={`/en${href}`} {...p}>{children}</a> }));
vi.mock("leaflet/dist/leaflet.css", () => ({}));
vi.mock("leaflet", () => {
  const layer = { addTo: () => layer };
  const L = {
    map: (...a: unknown[]) => { mapSpy(...a); return { setView, remove: vi.fn() }; },
    tileLayer: () => layer,
    circleMarker: () => layer,
  };
  return { default: L, ...L };
});

import MentionPlaceCard from "@/components/markup/MentionPlaceCard";
import type { PlacedMention } from "@/lib/mentions";

const caesarea: PlacedMention = {
  kind: "place", where: "text", start: 0, end: 21, form: "Cæsaréæ in Cappadócia", name: null, qid: "Q48338",
  key: "mr:0101-basilius|text|0", eulogy: "mr:0101-basilius",
};
const KAYSERI = { kind: "place" as const, labels: { en: "Kayseri", it: "Kayseri" }, label: "Kayseri", country: "TR", coords: [38.7, 35.5] as [number, number] };
const card = (locale: "en" | "it" | "de" = "en", m = caesarea) =>
  render(<MentionPlaceCard mention={m} edition="martyrologium_romanum_2004" lang="la" headingId="h" />, { locale });

describe("MentionPlaceCard", () => {
  beforeEach(() => {
    state.current = { status: "ready", entity: KAYSERI };
    mapSpy.mockReset();
    setView.mockReset();
  });

  it("names the place and its country in the interface language, with the printed form tagged", () => {
    card("it");
    expect(screen.getByRole("heading")).toHaveTextContent("Kayseri (Turchia)");
    expect(screen.getByText("Cæsaréæ in Cappadócia")).toHaveAttribute("lang", "la");
    expect(screen.getByRole("link", { name: "Vedi sulla mappa" })).toHaveAttribute("href", "/en/map?edition=martyrologium_romanum_2004");
    expect(screen.getByRole("link", { name: "Wikidata" })).toHaveAttribute("href", "https://www.wikidata.org/wiki/Q48338");
  });

  it("tags an English fallback name", () => {
    card("de");
    expect(screen.getByText("Kayseri")).toHaveAttribute("lang", "en");
  });

  it("draws the small map, with the zoom buttons only, once Leaflet has loaded", async () => {
    card();
    await waitFor(() => expect(mapSpy).toHaveBeenCalled());
    expect(mapSpy.mock.calls[0][1]).toMatchObject({ dragging: false, scrollWheelZoom: false, keyboard: false });
    expect(setView).toHaveBeenCalledWith([38.7, 35.5], 8);
    expect(screen.getByRole("img", { name: "Map of Kayseri" })).toBeInTheDocument();
  });

  it("draws no map for a place without coordinates", () => {
    state.current = { status: "ready", entity: { ...KAYSERI, coords: null } };
    card();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("when the details fail: the printed form, the notice, and still the map link", () => {
    state.current = { status: "error" };
    card();
    expect(screen.getByRole("heading")).toHaveTextContent("Cæsaréæ in Cappadócia");
    expect(screen.getByText(/Details unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See on the map" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run components/__tests__/MentionPlaceCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Share the tile constants**

Create `lib/esri-tiles.ts`:

```ts
// Esri World Street Map rather than the standard OSM tiles: OSM labels each place in its local script (kanji,
// Arabic, Hangul…), which a reader of Latin and Italian place names cannot read. Esri labels in English, keyless.
export const ESRI_STREET_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";

export const ESRI_ATTRIBUTION =
  "Tiles &copy; Esri &mdash; Sources: Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, " +
  "METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), NGCC, " +
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
  "and the GIS User Community";
```

In `components/PlaceMap.tsx` and `components/EulogyMap.tsx`, add `import { ESRI_ATTRIBUTION, ESRI_STREET_TILES } from "@/lib/esri-tiles";` and replace each `L.tileLayer("https://server.arcgisonline.com/…", { maxZoom: 18, attribution: "…" })` call with `L.tileLayer(ESRI_STREET_TILES, { maxZoom: 18, attribution: ESRI_ATTRIBUTION })`. In `PlaceMap.tsx`, replace the four-line comment above the call with `// Esri World Street Map: English labels, keyless (lib/esri-tiles.ts).`

- [ ] **Step 4: Write the map and the card**

Create `components/markup/MentionMap.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import { ESRI_ATTRIBUTION, ESRI_STREET_TILES } from "@/lib/esri-tiles";

/**
 * One place on a small map in its popup. Only the zoom buttons work, so scrolling or dragging over it moves the
 * page. Loaded with the first place popup (React.lazy), so Leaflet never weighs on the reader otherwise.
 */
export default function MentionMap({ coords, label }: { coords: [number, number]; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  const [lat, lon] = coords;
  useEffect(() => {
    let map: LeafletMap | null = null;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      map = L.map(el.current, {
        dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false,
      });
      L.tileLayer(ESRI_STREET_TILES, { maxZoom: 18, attribution: ESRI_ATTRIBUTION }).addTo(map);
      L.circleMarker([lat, lon], { color: "#0b6e7f", fillColor: "#22a5b8", radius: 7, weight: 2, fillOpacity: 0.8 }).addTo(map);
      map.setView([lat, lon], 8);
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lon]);
  return <div ref={el} role="img" aria-label={label} className="mt-2 h-40 w-full rounded border border-slate-300 dark:border-slate-700" />;
}
```

Create `components/markup/MentionPlaceCard.tsx`:

```tsx
"use client";

import { lazy, Suspense } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { langOn, type Locale } from "@/i18n/routing";
import { Loading, Unavailable } from "@/components/markup/Unavailable";
import { useEntity } from "@/lib/entities-client";
import type { PlacedMention } from "@/lib/mentions";
import { placeLabel, placeLabelLang } from "@/lib/places-index";
import { wikidataUrl } from "@/lib/wikimedia";

// Leaflet comes with the first place popup, not with the reader.
const MentionMap = lazy(() => import("@/components/markup/MentionMap"));

function regionName(locale: string, code: string): string | undefined {
  try {
    return code ? new Intl.DisplayNames([locale], { type: "region" }).of(code) : undefined;
  } catch {
    return undefined; // not a region code
  }
}

/**
 * A place's popup: its name in the interface language (else English, tagged) and country, the words the edition
 * prints (tagged with the edition's language `lang`), a small map, and links to the map page and Wikidata.
 */
export default function MentionPlaceCard({ mention, edition, lang, headingId }: {
  mention: PlacedMention; edition: string; lang: string | undefined; headingId: string;
}) {
  const t = useTranslations("Markup");
  const locale = useLocale() as Locale;
  const state = useEntity(mention.qid);
  const place = state.status === "ready" && state.entity?.kind === "place" ? state.entity : null;
  const info = place ? { label: place.label, country: place.country, coords: place.coords, labels: place.labels } : null;
  const name = info && mention.qid ? placeLabel(info, mention.qid, locale) : mention.form;
  const nameLang = info ? placeLabelLang(info, locale) : lang ?? null;
  const country = info ? regionName(locale, info.country) : undefined;
  return (
    <>
      <h2 id={headingId} className="font-semibold">
        <span lang={langOn(nameLang, locale)}>{name}</span>
        {country && <span className="font-normal text-slate-600 dark:text-slate-400"> ({country})</span>}
      </h2>
      {info && <p className="mt-1 italic" lang={langOn(lang, locale)}>{mention.form}</p>}
      {info?.coords && (
        <Suspense fallback={<div className="mt-2 h-40 w-full rounded bg-slate-100 dark:bg-slate-800" />}>
          <MentionMap coords={info.coords} label={t("mapLabel", { name })} />
        </Suspense>
      )}
      <p className="mt-2 flex gap-3 text-xs">
        <Link href={`/map?edition=${encodeURIComponent(edition)}`} className="underline">{t("seeOnMap")}</Link>
        {mention.qid && <a href={wikidataUrl(mention.qid)} target="_blank" rel="noreferrer" className="underline">{t("wikidata")}</a>}
      </p>
      {mention.qid && (state.status === "loading" || state.status === "idle") && <Loading />}
      {mention.qid && state.status === "error" && <Unavailable qid={mention.qid} />}
    </>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run components/__tests__/MentionPlaceCard.test.tsx components/__tests__/PlaceMap.test.tsx components/__tests__/EulogyMap.test.tsx && npx tsc --noEmit -p . && npx eslint components/markup components/PlaceMap.tsx components/EulogyMap.tsx lib/esri-tiles.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/esri-tiles.ts components/markup/MentionMap.tsx components/markup/MentionPlaceCard.tsx components/PlaceMap.tsx components/EulogyMap.tsx components/__tests__/MentionPlaceCard.test.tsx
git commit -F - <<'EOF'
feat(markup): the place popup, with a small map that brings Leaflet only when opened

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv
EOF
```

---

### Task 9: The provider, the pieces and the popup shell

**Files:**
- Create: `components/markup/Markup.tsx`, `components/markup/MentionPopup.tsx`, `components/markup/MentionPiece.tsx`
- Modify: `components/page.module.css`
- Test: `components/__tests__/Markup.test.tsx`, `lib/__tests__/focus-rings.test.ts` (append a CSS check)

**Interfaces:**
- Consumes: `PlacedMention`, `mentionsIn`, `splitByMentions`, `mentionQids` (Task 1); `usePrefetchEntities` (Task 4); `popupPosition` (Task 6); `MentionPersonCard` (Task 7); `MentionPlaceCard` (Task 8).
- Produces: `MarkupProvider({ on, langs, page, children }: { on: boolean; langs: Record<string, string>; page: string; children: ReactNode })`; `useMarkup(): MarkupApi | null` (null when off or outside a provider); `PrefetchEntities({ elogia }: { elogia: (Pick<ElogiumOut, "mentions"> | null)[] })`; `OPEN_MS = 300`, `CLOSE_MS = 200`; `MentionRun({ text, from, to, mentions, edition })`; `MentionText({ text, mentions, where, eulogy, edition })`; CSS classes `styles.mention`, `styles.person`, `styles.place`.

- [ ] **Step 1: Write the failing tests**

Create `components/__tests__/Markup.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@/test/intl";

vi.mock("@/lib/entities-client", () => ({
  useEntity: () => ({ status: "ready", entity: null }), requestEntities: vi.fn(), usePrefetchEntities: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children }: { href: string; children?: React.ReactNode }) => <a href={href}>{children}</a> }));

import { CLOSE_MS, MarkupProvider, OPEN_MS } from "@/components/markup/Markup";
import { MentionText } from "@/components/markup/MentionPiece";
import type { Mention } from "@/lib/types";
import styles from "@/components/page.module.css";

const TEXT = "Cæsaréæ in Cappadócia, sepultúra sancti Basilíi, magístri.";
const MENTIONS: Mention[] = [
  { kind: "place", where: "text", start: 0, end: 21, form: "Cæsaréæ in Cappadócia", name: null, qid: "Q48338" },
  { kind: "person", where: "text", start: 40, end: 47, form: "Basilíi", name: "Basilius", qid: null },
];

function Page({ on = true, page = "a" }: { on?: boolean; page?: string }) {
  return (
    <MarkupProvider on={on} langs={{ ed: "la" }} page={page}>
      <p>
        <MentionText text={TEXT} mentions={MENTIONS} where="text" eulogy="mr:0101-basilius" edition="ed" />
      </p>
      <button>elsewhere</button>
    </MarkupProvider>
  );
}
const person = () => screen.getByRole("button", { name: "Basilíi" });
const place = () => screen.getByRole("button", { name: "Cæsaréæ in Cappadócia" });

describe("the markup", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("marks nothing while off: the text as it is", () => {
    const { container } = render(<Page on={false} />);
    expect(container.querySelector("p")!.innerHTML).toBe(TEXT);
  });

  it("marks each mention, dotted for persons and dashed for places, announced as a person or place", () => {
    render(<Page />);
    expect(person()).toHaveClass(styles.mention, styles.person);
    expect(place()).toHaveClass(styles.mention, styles.place);
    expect(person()).toHaveAttribute("tabindex", "0");
    expect(person()).toHaveAttribute("aria-haspopup", "dialog");
    expect(person()).toHaveAttribute("aria-expanded", "false");
    expect(person()).toHaveAttribute("aria-roledescription", "person");
    expect(place()).toHaveAttribute("aria-roledescription", "place");
  });

  it("opens on hover after the delay, and closes after the pointer leaves", () => {
    render(<Page />);
    fireEvent.mouseEnter(person());
    expect(person()).toHaveAttribute("data-active");
    act(() => vi.advanceTimersByTime(OPEN_MS - 1));
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("dialog", { name: "Basilius" })).toBeInTheDocument();
    fireEvent.mouseLeave(person());
    act(() => vi.advanceTimersByTime(CLOSE_MS));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(person()).not.toHaveAttribute("data-active");
  });

  it("stays open while the pointer is in the popup", () => {
    render(<Page />);
    fireEvent.mouseEnter(person());
    act(() => vi.advanceTimersByTime(OPEN_MS));
    fireEvent.mouseLeave(person());
    fireEvent.mouseEnter(screen.getByRole("dialog"));
    act(() => vi.advanceTimersByTime(CLOSE_MS * 2));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("pins on click, one popup at a time; a second click unpins", () => {
    render(<Page />);
    fireEvent.click(person());
    expect(screen.getByRole("dialog", { name: "Basilius" })).toBeInTheDocument();
    expect(person()).toHaveAttribute("aria-expanded", "true");
    fireEvent.mouseLeave(person());
    act(() => vi.advanceTimersByTime(CLOSE_MS * 2));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(place());
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog")).toHaveTextContent("Cæsaréæ in Cappadócia");
    fireEvent.click(place());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("pins on Enter and moves focus into the popup; Escape closes it and returns focus", () => {
    render(<Page />);
    person().focus();
    fireEvent.keyDown(person(), { key: "Enter" });
    const dialog = screen.getByRole("dialog");
    expect(dialog).not.toHaveAttribute("aria-modal");
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(person()).toHaveFocus();
  });

  it("pins on Space too", () => {
    render(<Page />);
    fireEvent.keyDown(person(), { key: " " });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes on a click outside", () => {
    render(<Page />);
    fireEvent.click(person());
    fireEvent.mouseDown(screen.getByRole("button", { name: "elsewhere" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the popup when the switch goes off", () => {
    const { rerender } = render(<Page />);
    fireEvent.click(person());
    rerender(<Page on={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Basilíi" })).toBeNull();
  });

  it("closes the popup when the page changes", () => {
    const { rerender } = render(<Page />);
    fireEvent.click(person());
    rerender(<Page page="b" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
```

Append to `lib/__tests__/focus-rings.test.ts`:

```ts
describe("the markup's styles", () => {
  it("underline persons dotted and places dashed, tint them, and keep the tint in forced colours", () => {
    const css = readFileSync("components/page.module.css", "utf8");
    expect(css).toMatch(/\.person \{[^}]*text-decoration-style: dotted/);
    expect(css).toMatch(/\.place \{[^}]*text-decoration-style: dashed/);
    expect(css).toMatch(/\.mention \{[^}]*text-underline-offset: 0\.2em/);
    expect(css).toMatch(/@media \(forced-colors: active\) \{[^}]*\.mention\[data-active\][^}]*Highlight/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[^}]*\.mention \{ transition: none; \}/);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run components/__tests__/Markup.test.tsx lib/__tests__/focus-rings.test.ts`
Expected: FAIL — `@/components/markup/Markup` not found; the CSS rules are missing.

- [ ] **Step 3: Add the styles**

Append to `components/page.module.css`:

```css
/* Persons and places the eulogy names, while "Names & places" is on: dotted for persons, dashed for places, in
   the text's own colour; a soft tint (warm for persons, cool for places) on every piece while one is hovered,
   focused or open. */
.mention {
  text-decoration-line: underline; text-decoration-thickness: 1px; text-underline-offset: 0.2em;
  text-decoration-color: color-mix(in srgb, currentColor 60%, transparent);
  cursor: help; border-radius: 2px; transition: background-color 150ms ease-out;
}
.person { text-decoration-style: dotted; }
.place { text-decoration-style: dashed; }
.person[data-active] { background-color: rgba(214, 170, 60, 0.25); }
.place[data-active] { background-color: rgba(11, 110, 127, 0.15); }
.mention:focus-visible { outline: 2px solid rgba(11, 110, 127, 0.5); outline-offset: 1px; }
@media (prefers-color-scheme: dark) {
  .person[data-active] { background-color: rgba(250, 204, 21, 0.2); }
  .place[data-active] { background-color: rgba(103, 232, 249, 0.18); }
}
@media (forced-colors: active) {
  .mention[data-active] { forced-color-adjust: none; background-color: Highlight; color: HighlightText; }
}
@media (prefers-reduced-motion: reduce) {
  .mention { transition: none; }
}
```

- [ ] **Step 4: Write the provider**

Create `components/markup/Markup.tsx`:

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import MentionPopup from "@/components/markup/MentionPopup";
import { usePrefetchEntities } from "@/lib/entities-client";
import { mentionQids, type PlacedMention } from "@/lib/mentions";
import type { ElogiumOut } from "@/lib/types";

/** How long the pointer rests on a mention before its popup opens, and how long after it leaves before it closes. */
export const OPEN_MS = 300;
export const CLOSE_MS = 200;

/** A mention and the edition it is printed in. */
export interface MarkupTarget {
  mention: PlacedMention;
  edition: string;
}

/** The open popup: its mention, the piece it sits beside, whether a click pinned it and whether the keyboard did. */
export interface OpenPopup {
  target: MarkupTarget;
  anchor: HTMLElement;
  pinned: boolean;
  keyboard: boolean;
}

export interface MarkupApi {
  /** The mention tinted: open, hovered or focused. */
  active: string | null;
  open: OpenPopup | null;
  hoverStart(t: MarkupTarget, anchor: HTMLElement): void;
  hoverEnd(): void;
  /** Pins the mention's popup, or unpins it when it is the one pinned. */
  pin(t: MarkupTarget, anchor: HTMLElement, keyboard: boolean): void;
  focus(key: string | null): void;
}

const Ctx = createContext<MarkupApi | null>(null);

/** The markup's state, or null while "Names & places" is off (or outside the reader): then nothing is marked. */
export function useMarkup(): MarkupApi | null {
  return useContext(Ctx);
}

/** A mention's first piece, the one that takes the focus. */
function firstPiece(key: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>("[data-mention][tabindex]")].find((n) => n.dataset.mention === key);
}

/**
 * The reader's markup: whether it is on, which mention is tinted, and the one popup (in a portal). `langs` gives
 * each edition's language, for the printed words in a place popup; `page` names the day shown, and a new one
 * closes the popup, whose mention has gone.
 */
export function MarkupProvider({ on, langs, page, children }: {
  on: boolean; langs: Record<string, string>; page: string; children: ReactNode;
}) {
  const [open, setOpen] = useState<OpenPopup | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const openRef = useRef<OpenPopup | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const later = useCallback((ms: number, f: () => void) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(f, ms);
  }, []);
  const close = useCallback((returnFocus: boolean) => {
    window.clearTimeout(timer.current);
    const o = openRef.current;
    openRef.current = null;
    setOpen(null);
    if (o && returnFocus) firstPiece(o.target.mention.key)?.focus();
  }, []);
  const show = useCallback((o: OpenPopup) => {
    window.clearTimeout(timer.current);
    openRef.current = o;
    setOpen(o);
  }, []);

  // Off, or another day: no popup.
  useEffect(() => {
    close(false);
  }, [on, page, close]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Escape closes and gives the focus back; a click outside the popup and its mention closes.
  useEffect(() => {
    if (!open) return;
    const key = open.target.mention.key;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target;
      if (t instanceof Node && popupRef.current?.contains(t)) return;
      if (t instanceof Element && t.closest<HTMLElement>("[data-mention]")?.dataset.mention === key) return;
      close(popupRef.current?.contains(document.activeElement) ?? false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, close]);

  const api = useMemo<MarkupApi>(() => ({
    active: open?.target.mention.key ?? hovered ?? focused,
    open,
    hoverStart(t, anchor) {
      setHovered(t.mention.key);
      const o = openRef.current;
      if (o?.pinned) return;
      if (o?.target.mention.key === t.mention.key) {
        window.clearTimeout(timer.current);
        return;
      }
      later(OPEN_MS, () => show({ target: t, anchor, pinned: false, keyboard: false }));
    },
    hoverEnd() {
      setHovered(null);
      if (openRef.current?.pinned) return;
      later(CLOSE_MS, () => {
        if (!openRef.current?.pinned) close(false);
      });
    },
    pin(t, anchor, keyboard) {
      const o = openRef.current;
      if (o?.pinned && o.target.mention.key === t.mention.key) close(keyboard);
      else show({ target: t, anchor, pinned: true, keyboard });
    },
    focus: setFocused,
  }), [open, hovered, focused, later, show, close]);

  return (
    <Ctx.Provider value={on ? api : null}>
      {children}
      {on && open && typeof document !== "undefined" &&
        createPortal(
          <MentionPopup
            ref={popupRef}
            open={open}
            lang={langs[open.target.edition]}
            onEnter={() => window.clearTimeout(timer.current)}
            onLeave={() => api.hoverEnd()}
          />,
          document.body,
        )}
    </Ctx.Provider>
  );
}

/** While the markup is on, asks at once for the details of every item a page's eulogies name. */
export function PrefetchEntities({ elogia }: { elogia: (Pick<ElogiumOut, "mentions"> | null)[] }) {
  usePrefetchEntities(mentionQids(elogia), useMarkup() !== null);
  return null;
}
```

- [ ] **Step 5: Write the popup shell**

Create `components/markup/MentionPopup.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useState, type Ref, type RefObject } from "react";
import type { OpenPopup } from "@/components/markup/Markup";
import MentionPersonCard from "@/components/markup/MentionPersonCard";
import MentionPlaceCard from "@/components/markup/MentionPlaceCard";
import { popupPosition } from "@/lib/popup-position";

/**
 * The open mention's popup: a non-modal dialog beside its mention, below it unless it fits only above, kept in
 * the window as the page scrolls or resizes. Focus moves into it only when the keyboard opened it.
 */
export default function MentionPopup({ ref, open, lang, onEnter, onLeave }: {
  ref: Ref<HTMLDivElement>; open: OpenPopup; lang: string | undefined; onEnter: () => void; onLeave: () => void;
}) {
  const headingId = useId();
  const el = ref as RefObject<HTMLDivElement | null>;
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const place = useCallback(() => {
    const node = el.current;
    if (!node) return;
    setPos(popupPosition(
      open.anchor.getBoundingClientRect(),
      { width: node.offsetWidth, height: node.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    ));
  }, [el, open.anchor]);

  useLayoutEffect(place, [place, open.target.mention.key]);
  useEffect(() => {
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    // The details arrive after it opens: follow its height (where the browser can tell).
    const ro = typeof ResizeObserver === "undefined" || !el.current ? null : new ResizeObserver(place);
    if (ro && el.current) ro.observe(el.current);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      ro?.disconnect();
    };
  }, [place, el]);
  useEffect(() => {
    if (open.keyboard) el.current?.focus();
  }, [open, el]);

  const m = open.target.mention;
  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={headingId}
      tabIndex={-1}
      className={
        "fixed z-50 w-72 max-w-[calc(100vw-1rem)] rounded border border-slate-300 bg-white p-3 text-sm text-slate-900 " +
        "shadow-lg outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      }
      style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: "hidden" }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {m.kind === "person" ? (
        <MentionPersonCard mention={m} headingId={headingId} />
      ) : (
        <MentionPlaceCard mention={m} edition={open.target.edition} lang={lang} headingId={headingId} />
      )}
    </div>
  );
}
```

(React 19 passes `ref` as a regular prop to function components; no `forwardRef`.)

- [ ] **Step 6: Write the pieces**

Create `components/markup/MentionPiece.tsx`:

```tsx
"use client";

import { Fragment, useMemo, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useMarkup } from "@/components/markup/Markup";
import styles from "@/components/page.module.css";
import { mentionsIn, splitByMentions, type PlacedMention } from "@/lib/mentions";
import type { Mention } from "@/lib/types";

/**
 * One piece of a mention (a footnote mark or an erratum can cut a mention in two): every piece hovers, tints and
 * opens the same popup; the first is the one the keyboard reaches.
 */
function MentionPiece({ mention, edition, first, children }: {
  mention: PlacedMention; edition: string; first: boolean; children: ReactNode;
}) {
  const t = useTranslations("Markup");
  const markup = useMarkup()!;
  const ref = useRef<HTMLSpanElement>(null);
  const target = { mention, edition };
  const expanded = markup.open?.target.mention.key === mention.key;
  return (
    <span
      ref={ref}
      data-mention={mention.key}
      data-active={markup.active === mention.key ? "" : undefined}
      className={`${styles.mention} ${mention.kind === "person" ? styles.person : styles.place}`}
      onMouseEnter={() => markup.hoverStart(target, ref.current!)}
      onMouseLeave={() => markup.hoverEnd()}
      onClick={() => markup.pin(target, ref.current!, false)}
      {...(first
        ? {
            tabIndex: 0,
            role: "button",
            "aria-haspopup": "dialog" as const,
            "aria-expanded": expanded,
            "aria-roledescription": t(mention.kind),
            onFocus: () => markup.focus(mention.key),
            onBlur: () => markup.focus(null),
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              markup.pin(target, ref.current!, true);
            },
          }
        : {})}
    >
      {children}
    </span>
  );
}

/** `text` from `from` to `to`, its mentions' pieces marked; plain text when there are none. */
export function MentionRun({ text, from, to, mentions, edition }: {
  text: string; from: number; to: number; mentions: PlacedMention[]; edition: string;
}) {
  if (mentions.length === 0) return <>{text.slice(from, to)}</>;
  return (
    <>
      {splitByMentions(from, to, mentions).map((p) =>
        p.mention ? (
          <MentionPiece key={p.start} mention={p.mention} edition={edition} first={p.first}>
            {text.slice(p.start, p.end)}
          </MentionPiece>
        ) : (
          <Fragment key={p.start}>{text.slice(p.start, p.end)}</Fragment>
        ),
      )}
    </>
  );
}

/** A whole text (a footnote's, or a eulogy's without apparatus) with its mentions marked while the markup is on. */
export function MentionText({ text, mentions, where, eulogy, edition }: {
  text: string; mentions: Mention[] | undefined; where: "text" | number; eulogy: string; edition: string;
}) {
  const on = useMarkup() !== null;
  const placed = useMemo(
    () => (on ? mentionsIn(mentions, where, eulogy, text.length) : []),
    [on, mentions, where, eulogy, text.length],
  );
  return <MentionRun text={text} from={0} to={text.length} mentions={placed} edition={edition} />;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run components/__tests__/Markup.test.tsx lib/__tests__/focus-rings.test.ts && npx tsc --noEmit -p . && npx eslint components/markup`
Expected: PASS. If `fireEvent.mouseEnter` does not reach React's `onMouseEnter` in this Testing Library version, use `fireEvent.mouseOver` in the tests (React listens for `mouseover`/`mouseout` to synthesise enter/leave).

- [ ] **Step 8: Commit**

```bash
git add components/markup/Markup.tsx components/markup/MentionPopup.tsx components/markup/MentionPiece.tsx components/page.module.css components/__tests__/Markup.test.tsx lib/__tests__/focus-rings.test.ts
git commit -F - <<'EOF'
feat(markup): marked mentions, the hover/pin/keyboard state, and the one popup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv
EOF
```

---

### Task 10: Mentions in the reader's text and footnotes

**Files:**
- Modify: `components/EulogyText.tsx`, `components/Eulogy.tsx`, `components/PrintedFootnotes.tsx`, `components/DayPage.tsx`, `components/Spread.tsx`, `components/Reader.tsx`
- Test: `components/__tests__/EulogyMarkup.test.tsx`, `lib/__tests__/markup-bundle.test.ts`

**Interfaces:**
- Consumes: `MarkupProvider`, `useMarkup`, `PrefetchEntities`, `MentionRun`, `MentionText` (Task 9); `mentionsIn` (Task 1); `useMarkupSwitch` (Task 5).
- Produces: `EulogyText` prop `mentions?: Mention[]`; `PrintedFootnotes` prop `edition?: string`.

- [ ] **Step 1: Write the failing tests**

Create `components/__tests__/EulogyMarkup.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/intl";

vi.mock("@/lib/entities-client", () => ({
  useEntity: () => ({ status: "ready", entity: null }), requestEntities: vi.fn(), usePrefetchEntities: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children }: { href: string; children?: React.ReactNode }) => <a href={href}>{children}</a> }));

import { MarkupProvider } from "@/components/markup/Markup";
import EulogyText from "@/components/EulogyText";
import PrintedFootnotes from "@/components/PrintedFootnotes";
import { pageFootnotes } from "@/lib/footnotes";
import type { Erratum, Mention } from "@/lib/types";

const TEXT = "Cæsaréæ in Cappadócia, sepultúra sancti Basilíi, magístri.";
const place: Mention = { kind: "place", where: "text", start: 0, end: 21, form: "Cæsaréæ in Cappadócia", name: null, qid: "Q48338" };
const person: Mention = { kind: "person", where: "text", start: 40, end: 47, form: "Basilíi", name: "Basilius", qid: null };
const inNote: Mention = { kind: "person", where: { footnote: 1 }, start: 4, end: 9, form: "Petri", name: "Petrus", qid: null };
const ID = "mr:0101-basilius";
const footnotes = pageFootnotes([{ id: ID, footnotes: [{ mark: "1", after: "Cæsaréæ", text: "Vide Petri vitam." }], mentions: [place, person, inNote] }], "ed");

const within = (on: boolean, ui: React.ReactNode) => (
  <MarkupProvider on={on} langs={{ ed: "la" }} page="p">{ui}</MarkupProvider>
);

describe("mentions in the reader's text", () => {
  it("leaves the eulogy exactly as it is while the markup is off", () => {
    const plain = render(<p><EulogyText text={TEXT} id={ID} edition="ed" footnotes={footnotes} /></p>);
    const html = plain.container.innerHTML;
    plain.unmount();
    const off = render(within(false, <p><EulogyText text={TEXT} id={ID} edition="ed" footnotes={footnotes} mentions={[place, person]} /></p>));
    expect(off.container.innerHTML).toBe(html);
  });

  it("marks a eulogy without apparatus too", () => {
    render(within(true, <p><EulogyText text={TEXT} id={ID} edition="ed" mentions={[place, person]} /></p>));
    expect(screen.getByRole("button", { name: "Basilíi" })).toBeInTheDocument();
  });

  it("cuts a mention at a footnote mark into pieces of one mention, the first focusable, all tinted together", () => {
    const { container } = render(within(true, <p><EulogyText text={TEXT} id={ID} edition="ed" footnotes={footnotes} mentions={[place, person]} /></p>));
    const pieces = [...container.querySelectorAll<HTMLElement>(`[data-mention="${ID}|text|0"]`)];
    expect(pieces.map((p) => p.textContent)).toEqual(["Cæsaréæ", " in Cappadócia"]);
    expect(pieces[0]).toHaveAttribute("tabindex", "0");
    expect(pieces[1]).not.toHaveAttribute("tabindex");
    expect(pieces[0].nextElementSibling?.tagName).toBe("A"); // the footnote mark between them
    fireEvent.mouseEnter(pieces[1]);
    expect(pieces[0]).toHaveAttribute("data-active");
    expect(pieces[1]).toHaveAttribute("data-active");
  });

  it("cuts a mention at the edge of an erratum, keeping every piece marked", () => {
    const erratum: Erratum = { kind: "replace", printed: "Basilíi", corrected: "Basilii", ref: "1.2", entry: "Basilíi] Basilii" };
    const long: Mention = { ...person, start: 33, end: 47, form: "sancti Basilíi" };
    const { container } = render(within(true, <p><EulogyText text={TEXT} id={ID} edition="ed" errata={[erratum]} mentions={[long]} /></p>));
    const pieces = [...container.querySelectorAll<HTMLElement>(`[data-mention="${ID}|text|33"]`)];
    expect(pieces.map((p) => p.textContent)).toEqual(["sancti ", "Basilíi"]);
    expect(pieces[0]).toHaveAttribute("tabindex", "0");
  });

  it("marks the mentions printed in a footnote, counted from the footnote's text", () => {
    render(within(true, <PrintedFootnotes notes={footnotes} edition="ed" lang="la" />));
    expect(screen.getByRole("button", { name: "Petri" })).toHaveAttribute("data-mention", `${ID}|fn1|4`);
  });
});
```

Create `lib/__tests__/markup-bundle.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

// Only `import type` may name them: a value import would put a snapshot in the reader's bundle.
const SERVER_ONLY = /^import (?!type )[^;]*from "@\/(data\/(persons|places|person-details)-snapshot\.json|lib\/(persons|places|person-details))"/m;

describe("the markup's client code", () => {
  it("never imports a persons, places or person-details snapshot", () => {
    const files = [
      ...readdirSync("components/markup").map((f) => `components/markup/${f}`),
      "lib/entities-client.ts", "lib/entities.ts", "lib/mentions.ts", "lib/mention-labels.ts",
      "components/EulogyText.tsx", "components/PrintedFootnotes.tsx", "components/Reader.tsx",
    ];
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(SERVER_ONLY);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run components/__tests__/EulogyMarkup.test.tsx lib/__tests__/markup-bundle.test.ts`
Expected: FAIL — no buttons are marked (EulogyText ignores `mentions`), and `PrintedFootnotes` marks nothing. The bundle test passes already (it guards the future).

- [ ] **Step 3: Mark the eulogy's text**

In `components/EulogyText.tsx`:

- Change the React import to `import { Fragment, useMemo, type ReactNode } from "react";` and add:

```ts
import { useMarkup } from "@/components/markup/Markup";
import { MentionRun } from "@/components/markup/MentionPiece";
import { mentionsIn } from "@/lib/mentions";
import type { Erratum, Mention } from "@/lib/types";
```

(replacing the existing `import type { Erratum } from "@/lib/types";`).

- Add `mentions` to the props: in the destructuring after `errataClassName = …,` add `mentions,`, and in the type after `errataClassName?: string;` add `mentions?: Mention[];`. Add to the doc comment: `` `mentions` are the persons and places it names, marked while "Names & places" is on.``
- After `const misprints = misprintsFor(edition, id);` add:

```ts
  const on = useMarkup() !== null;
  const marked = useMemo(() => (on ? mentionsIn(mentions, "text", id ?? "", text.length) : []), [on, mentions, id, text.length]);
```

- Change the early return to `if (misprints.length === 0 && footnotes.length === 0 && errata.length === 0 && marked.length === 0) return <>{text}</>;`
- In the runs loop, replace the two text pushes:

```tsx
          parts.push(<Fragment key={`t${m.footnote.anchor}`}><MentionRun text={text} from={start + cut} to={m.at} mentions={marked} edition={edition} /></Fragment>);
```

and

```tsx
        parts.push(<Fragment key="rest"><MentionRun text={text} from={start + cut} to={end} mentions={marked} edition={edition} /></Fragment>);
```

(The runs partition `text`, so `text.slice(start + cut, …)` is the slice of `s.text` the code sliced before; with no mentions `MentionRun` renders that same plain text.)

- [ ] **Step 4: Pass the mentions, and mark the footnotes**

In `components/Eulogy.tsx`, add `mentions={e.mentions}` to the `<EulogyText …>` props.

In `components/PrintedFootnotes.tsx`, add `import { MentionText } from "@/components/markup/MentionPiece";`, change the signature to `export default function PrintedFootnotes({ notes, lang, edition = "" }: { notes: PageFootnote[]; lang?: string; edition?: string })`, add to its doc comment `` `edition` (a CLBDR edition id) names the edition the persons and places marked in the footnotes are printed in.``, and replace `<span>{n.text}</span>` with:

```tsx
            <span>
              <MentionText text={n.text} mentions={n.mentions} where={n.number ?? 0} eulogy={n.id} edition={edition} />
            </span>
```

In `components/DayPage.tsx`, add `import { PrefetchEntities } from "@/components/markup/Markup";`, pass `edition={edition}` to `<PrintedFootnotes …>`, and add `<PrefetchEntities elogia={day.elogia} />` as the first child of `<article>`.

In `components/Spread.tsx`, add the same import; in the `conclusio` cell pass `edition={s.id}` to `<PrintedFootnotes …>`; in the aligned return, add as the first child of the `styles.spread` div:

```tsx
        <PrefetchEntities elogia={[...days.a.elogia, ...days.b.elogia]} />
```

- [ ] **Step 5: Put the provider in the reader**

In `components/Reader.tsx`, add `import { MarkupProvider } from "@/components/markup/Markup";`, and after the `editions` state:

```ts
  // Each edition's language, for the printed words in a place popup.
  const langs = useMemo(() => Object.fromEntries(editions.map((e) => [e.edition_id, editionLang(e)])), [editions]);
```

Wrap the children of `<div ref={pages} className="flex-1">` in:

```tsx
          <MarkupProvider on={markup} langs={langs} page={`${edition}+${withEdition ?? ""}/${mm}/${dd}`}>
            {/* the existing Spread / DayView conditional, unchanged */}
          </MarkupProvider>
```

- [ ] **Step 6: Run the whole suite**

Run: `npx vitest run && npx tsc --noEmit -p . && npm run lint`
Expected: every test passes (including the existing `EulogyText`, `DayPage`, `Spread`, `Reader`, `PrintedFootnotes` tests, unchanged), no type or lint errors.

- [ ] **Step 7: Commit**

```bash
git add components/EulogyText.tsx components/Eulogy.tsx components/PrintedFootnotes.tsx components/DayPage.tsx components/Spread.tsx components/Reader.tsx components/__tests__/EulogyMarkup.test.tsx lib/__tests__/markup-bundle.test.ts
git commit -F - <<'EOF'
feat(markup): the reader marks the persons and places in the eulogies and their footnotes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv
EOF
```

---

### Task 11: Build, check in a browser, open the PR

**Files:** none new (fixes, if any, in the files above).

**Interfaces:** none.

**Prerequisite:** an API serving `mentions` (plan 2): its PR deployed, or a local `martyrology-api` on its branch with the vendored crmedr of plan 1. Without it the reader shows no marks, which is expected but checks nothing.

- [ ] **Step 1: Production build**

Run: `API_BASE=<the API with mentions> npm run build`
Expected: the build succeeds; the route list includes `ƒ /api/entities`.

- [ ] **Step 2: Install Chrome for Playwright (once per machine)**

Run: `npx playwright install chrome`
If it needs `sudo` and cannot prompt, ask the user to run `! npx playwright install chrome` in this session.

- [ ] **Step 3: Start the build and check in the browser**

```bash
PORT=3311 AUTH_URL=http://localhost:3311 AUTH_SECRET=x API_BASE=<the API with mentions> node .next/standalone/server.js
```

With the Playwright browser tools, on `http://localhost:3311/en/read/martyrologium_romanum_2004/01/01` then `…/martyrologium_romanum_2004_it_IT/01/01`, check and record:

1. With the switch off, no dotted or dashed underlines; turn "Names & places" on: "Cæsaréæ in Cappadócia" is dashed, "Basilíi" dotted.
2. Hover "Basilíi": after ~300 ms a popup with the person; move away: it closes; hover again and move into the popup: it stays.
3. Click "Romæ" (mr:0101-almachius): the popup pins with "Rome (Italy)", the printed "Romæ" and a map; the network panel shows Leaflet loaded only now.
4. Tab to a mention, press Enter: focus moves into the popup; Escape: it closes and focus is back on the mention.
5. A person with a portrait shows the thumbnail with its credit (pick one from `data/person-details-snapshot.json` and open its day).
6. Reload: the switch is still on. Turn the page with a popup open: it closes.
7. In the Italian edition, places are marked (dashed) and no persons are (crmedr has none for it).
8. On a day of an edition without mentions (e.g. `martyrologium_romanum_1749`), the "Names & places" switch is not shown; back on a 2004 day it is, in the state it was left.

Stop the server afterwards.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin feat/eulogy-markup-reader
gh pr create --title "feat: mark the persons and places in the eulogies (Names & places)" --body "$(cat <<'EOF'
## Summary
- A "Names & places" switch in the reader bar, remembered like "Show IDs", marks the persons (dotted) and places (dashed) each eulogy and footnote names, from the `mentions` the API serves (part 2).
- Hover (300 ms), click or Enter opens one popup: a person's name in the website language (else English, else Latin, tagged), years, description, Commons portrait with its credit, Wikipedia and Wikidata; a place's name and country, the printed form, a small map (Leaflet loads only then), and links to the map page and Wikidata.
- `/api/entities` serves those details from the snapshots, so the reader downloads none of them; the reader asks once per day and keeps the answers for the session.
- `scripts/snapshot-registry.mjs` copies crmedr's `person_details.json` (part 1) into `data/person-details-snapshot.json`.

Spec: `docs/superpowers/specs/2026-10-09-eulogy-markup-design.md`. Plan: `docs/superpowers/plans/2026-10-09-eulogy-markup-3-reader.md`.

## Test plan
- [x] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`
- [x] In a browser against an API serving mentions: the checks in Task 11 of the plan

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv
EOF
)"
```

---

## Self-review

- **Spec coverage:** snapshot step (Task 2); `lib/types.ts` and footnote mentions (Task 1); `/api/entities` with cap and cache header (Task 3); fetch once per day, session cache (Tasks 4, 10); `useReaderSwitch`, `useShowIds` kept, the switch, shown only on days with mentions (Task 5); dates with circa, decade, century and BCE (Task 6); cut points, pieces sharing `data-mention`, overlap first-wins with a warning (Tasks 1, 9, 10); look, tint, dark mode, forced colours, reduced motion (Task 9); semantics of the first piece (Task 9); one popup in a portal, placement, flip/shift, scroll/resize (Tasks 6, 9); hover/close delays, click/Enter/Space pin, Escape/outside close with focus return, non-modal dialog, focus in only from the keyboard (Task 9); person popup and its fallbacks, unlinked person (Task 7); place popup, lazy map, "See on the map" (Task 8); "Details unavailable" with retry (Tasks 7, 8); six languages (Task 5); everywhere `EulogyText` renders in the reader, the compare spread included (Task 10); end-to-end check (Task 11).
- **Type consistency:** `Mention.name: string | null`, `WikidataDate`, `PlacedMention`, `mentionsIn(…, where: "text" | number, …)`, `MarkupTarget`, `OpenPopup`, `EntityState`, `MAX_IDS`, `useMarkupSwitch` are used with the same names and shapes throughout.
- **Placeholders:** none; Task 11's API address is the one input the executor must supply.
