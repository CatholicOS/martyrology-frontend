# Parallel Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read one day in two editions side by side, set as two facing sheets with each eulogy level with its counterpart, turning together from day to day.

**Architecture:** A reader mode at `/read/{A}/{mm}/{dd}?with={B}`. Pure alignment logic (`lib/parallel.ts`) turns the two days into rows; a `Spread` component lays the rows out on a three-column grid (sheet A | gutter | sheet B) drawn as two cream sheets, falling back to two independent pages when rows cannot be built. The reader carries `?with=` through every navigation.

**Tech Stack:** Next.js 16.3.6 (App Router), React 19, TypeScript, Tailwind, CSS modules, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-02-parallel-reader-design.md`

## Global Constraints

- This is Next.js 16.3.6: check `node_modules/next/dist/docs/` before using any Next API. Pages receive `params` and `searchParams` as **promises**; `redirect()` from `next/navigation` throws and, in a server component, replaces the URL.
- No API change. Endpoints used: `getDay(edition, mm, dd)`, `getEditions()`, `getAccess()`, `getElogium(id)` from `lib/api.ts`.
- Paired URL: `/read/{A}/{mm}/{dd}?with={B}` (`with` URL-encoded).
- Gutter between the sheets: `2.5rem`. Paired page width: `max-w-7xl`; single reader stays `max-w-5xl`.
- Phone layout below `640px` (Tailwind `sm`): one sheet, A's eulogy then B's.
- Gap notes are set like the misprint notes: colour `#5c4f45`, `0.8em`, upright, keyword in italics.
- A note names the other edition by its year (`1749`), or by year and language (`2004 Italian`) when both editions on the page share the year.
- Unaligned notice text: `The {year} {Language} edition is not yet aligned, so its eulogies are not matched.`
- Paired title: `{d} {Month} — {Title A} {yearA} | {Title B} {yearB}`.
- Commit trailers on every commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Nk2QD1sRjGjeCFwt5jmXTA
  ```
- Run the checks with `npx vitest run`, `npx tsc --noEmit -p .`, `npx eslint app components lib scripts`.

## Review Focus

- **The same eulogy twice on one side of a day** (an edition that prints a eulogy twice): both copies print, the first pairs, the second gets its own row; nothing is lost and nothing throws. Test in Task 1.
- **One side has no eulogies at all on the day** (an empty `elogia` list): every row is one-sided, the other sheet shows only gap notes, titulus and conclusio rows still frame it. Test in Task 1.
- **A placements request fails with a server error** (not a 404): the note stays "not on this day in …", nothing throws, and the failure is not cached, so the next visit asks again. Test in Task 3.
- **`?with=` given twice** (`?with=a&with=b`, which Next delivers as an array): treated as no pairing, the single reader renders, no crash. Test in Task 5.
- **The second edition is locked for a signed-out visitor**: that sheet shows the locked notice with its Sign in button, the first sheet reads normally. Test in Task 4.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/parallel.ts` (new) | `lcs`, `buildRows`, `gapNote`; types `Row`, `EulogyRow`, `GapNote`, `Placements`. Pure. |
| `lib/editions.ts` | + `yearAndLanguage`, `shortName`. |
| `lib/calendar.ts` | `dayPath` gains an optional `withEdition`. |
| `lib/use-day.ts` (new) | `useDay` hook and `DayState`, extracted from `Reader`'s `DayView`. |
| `lib/use-placements.ts` (new) | `usePlacements` hook with a module-level cache. |
| `components/Eulogy.tsx` (new) | One eulogy as printed (rubric number, misprint notes). |
| `components/DayStatus.tsx` (new) | Loading / locked / no text / error, for a day that is not ready. |
| `components/DayPage.tsx` | Uses `Eulogy`; exports `Conclusio`. |
| `components/Spread.tsx` (new) | The two-sheet view: aligned rows, gap notes, independent fallback. |
| `components/page.module.css` | + spread, sheet, cell, caption, gap, tag classes. |
| `components/Reader.tsx` | `withEdition` prop; renders `Spread` when paired; carries `with`. |
| `components/ReaderBar.tsx` | Compare-with select, ⇄ and × buttons. |
| `app/read/[edition]/[mm]/[dd]/page.tsx` | Reads/validates `with`, redirects when invalid, paired title, width. |
| `components/ComparePage.tsx` (moved from `app/compare/page.tsx`) | The curator catalog diff, unchanged. |
| `app/compare/page.tsx` | Curator gate. |
| `components/SiteHeader.tsx` | "Compare" for curators only. |

---

### Task 1: Pure helpers — alignment, note names, paired paths

**Files:**
- Create: `lib/parallel.ts`
- Modify: `lib/editions.ts` (append two functions), `lib/calendar.ts:49-51` (`dayPath`)
- Test: `lib/__tests__/parallel.test.ts` (new), `lib/__tests__/editions.test.ts`, `lib/__tests__/calendar.test.ts`

**Interfaces:**
- Consumes: `ElogiumOut`, `EditionPlacement`, `EditionOut` from `lib/types.ts`; `Day`, `Lang` from `lib/calendar.ts`; `editionLang` from `lib/editions.ts`.
- Produces:
  - `type Placements = Record<string, Record<string, EditionPlacement>>`
  - `interface EulogyRow { kind: "eulogy"; a: ElogiumOut | null; b: ElogiumOut | null; counterpart: number | null }`
  - `type Row = { kind: "titulus" } | EulogyRow | { kind: "conclusio" }`
  - `type GapNote = { kind: "absent" } | { kind: "pending" } | { kind: "elsewhere"; day: Day; entry: number | null } | { kind: "moved"; direction: "above" | "below"; entry: number | null }`
  - `lcs(xs: string[], ys: string[]): string[]`
  - `buildRows(a: ElogiumOut[], b: ElogiumOut[]): Row[]`
  - `gapNote(rows: Row[], index: number, emptyEdition: string, placements: Placements, day: Day): GapNote | null`
  - `yearAndLanguage(e: EditionOut): string` → `"1914 English"`
  - `shortName(e: EditionOut, other: EditionOut): string` → `"1749"` or `"2004 Italian"`
  - `dayPath(edition: string, d: Day, withEdition?: string | null): string`

- [ ] **Step 1: Write the failing tests for `lib/parallel.ts`**

Create `lib/__tests__/parallel.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildRows, gapNote, lcs, type EulogyRow, type Placements, type Row } from "@/lib/parallel";
import type { ElogiumOut } from "@/lib/types";

const el = (id: string | null, entry: number | null = 1, unnumbered = false): ElogiumOut => ({
  id, entry, asterisk: false, unnumbered, anchor_day: "10-04", text: `text of ${id}`,
});
const ids = (rows: Row[]) =>
  rows.map((r) => (r.kind === "eulogy" ? `${r.a?.id ?? "-"}|${r.b?.id ?? "-"}` : r.kind));
const DAY = { mm: 10, dd: 4 };
const B = "martyrologium_romanum_1749";

describe("lcs", () => {
  it("keeps the longest run common to both orders", () => {
    expect(lcs(["x", "y", "z"], ["x", "z"])).toEqual(["x", "z"]);
    expect(lcs(["x", "y"], ["y", "x"])).toHaveLength(1);
    expect(lcs([], ["x"])).toEqual([]);
  });
});

describe("buildRows", () => {
  it("pairs every eulogy of identical days, between titulus and conclusio", () => {
    expect(ids(buildRows([el("x"), el("y")], [el("x"), el("y")]))).toEqual(["titulus", "x|x", "y|y", "conclusio"]);
  });

  it("puts a B-only eulogy after the row holding B's previous eulogy", () => {
    expect(ids(buildRows([el("x"), el("y")], [el("x"), el("z"), el("y")]))).toEqual(["titulus", "x|x", "-|z", "y|y", "conclusio"]);
  });

  it("puts a B-only eulogy first when it is B's first", () => {
    expect(ids(buildRows([el("x")], [el("z"), el("x")]))).toEqual(["titulus", "-|z", "x|x", "conclusio"]);
  });

  it("keeps A-only eulogies in A's order", () => {
    expect(ids(buildRows([el("x"), el("w"), el("y")], [el("x"), el("y")]))).toEqual(["titulus", "x|x", "w|-", "y|y", "conclusio"]);
  });

  it("leaves a reordered eulogy unpaired, pointing each side at the other's row", () => {
    const rows = buildRows([el("x"), el("y")], [el("y"), el("x")]);
    expect(ids(rows)).toEqual(["titulus", "x|-", "y|y", "-|x", "conclusio"]);
    expect((rows[1] as EulogyRow).counterpart).toBe(3);
    expect((rows[3] as EulogyRow).counterpart).toBe(1);
  });

  it("gives a second copy of the same eulogy its own row", () => {
    expect(ids(buildRows([el("x"), el("x")], [el("x")]))).toEqual(["titulus", "x|x", "x|-", "conclusio"]);
  });

  it("frames an empty side with titulus and conclusio", () => {
    expect(ids(buildRows([el("x"), el("y")], []))).toEqual(["titulus", "x|-", "y|-", "conclusio"]);
  });

  it("never pairs eulogies without a canonical id", () => {
    // ids() prints a missing id as "-": an A row and a B row, each one-sided.
    expect(ids(buildRows([el(null)], [el(null)]))).toEqual(["titulus", "-|-", "-|-", "conclusio"]);
  });
});

describe("gapNote", () => {
  const rows = buildRows([el("x"), el("w", 5)], [el("x")]);
  const w = 2; // row of the A-only eulogy w

  it("is pending until the placements arrive", () => {
    expect(gapNote(rows, w, B, {}, DAY)).toEqual({ kind: "pending" });
  });

  it("says absent when the other edition does not print it", () => {
    const p: Placements = { w: { other: { day_printed: "10-04", entry: 5, asterisk: false, unnumbered: false, text: null } } };
    expect(gapNote(rows, w, B, p, DAY)).toEqual({ kind: "absent" });
  });

  it("names the other day and entry when printed elsewhere", () => {
    const p: Placements = { w: { [B]: { day_printed: "10-05", entry: 3, asterisk: false, unnumbered: false, text: null } } };
    expect(gapNote(rows, w, B, p, DAY)).toEqual({ kind: "elsewhere", day: { mm: 10, dd: 5 }, entry: 3 });
  });

  it("drops the entry of an unnumbered placement", () => {
    const p: Placements = { w: { [B]: { day_printed: "10-05", entry: 1, asterisk: false, unnumbered: true, text: null } } };
    expect(gapNote(rows, w, B, p, DAY)).toEqual({ kind: "elsewhere", day: { mm: 10, dd: 5 }, entry: null });
  });

  it("says above or below for a eulogy printed on this day out of order", () => {
    const r = buildRows([el("x", 1), el("y", 2)], [el("y", 6), el("x", 7)]);
    expect(gapNote(r, 1, B, {}, DAY)).toEqual({ kind: "moved", direction: "below", entry: 7 });
    expect(gapNote(r, 3, "a-edition", {}, DAY)).toEqual({ kind: "moved", direction: "above", entry: 1 });
  });

  it("has no note for a paired row, a frame row, or a eulogy without id", () => {
    expect(gapNote(rows, 1, B, {}, DAY)).toBeNull();
    expect(gapNote(rows, 0, B, {}, DAY)).toBeNull();
    const r = buildRows([el(null)], []);
    expect(gapNote(r, 1, B, {}, DAY)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run lib/__tests__/parallel.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/parallel"`.

- [ ] **Step 3: Implement `lib/parallel.ts`**

```ts
import type { Day } from "@/lib/calendar";
import type { EditionPlacement, ElogiumOut } from "@/lib/types";

/** Every edition's placement of a eulogy, by canonical id, then edition id. A missing id: not fetched yet. */
export type Placements = Record<string, Record<string, EditionPlacement>>;

export interface EulogyRow {
  kind: "eulogy";
  a: ElogiumOut | null;
  b: ElogiumOut | null;
  /** For a one-sided row whose eulogy the other edition prints on this day too (out of order): the row holding it. */
  counterpart: number | null;
}

export type Row = { kind: "titulus" } | EulogyRow | { kind: "conclusio" };

/** What the empty side of a one-sided row says about the eulogy on the other side. */
export type GapNote =
  | { kind: "absent" }
  | { kind: "pending" }
  | { kind: "elsewhere"; day: Day; entry: number | null }
  | { kind: "moved"; direction: "above" | "below"; entry: number | null };

type Side = "a" | "b";

/** The longest common subsequence of two id orders. */
export function lcs(xs: string[], ys: string[]): string[] {
  const t: number[][] = Array.from({ length: xs.length + 1 }, () => new Array<number>(ys.length + 1).fill(0));
  for (let i = xs.length - 1; i >= 0; i--)
    for (let j = ys.length - 1; j >= 0; j--)
      t[i][j] = xs[i] === ys[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const out: string[] = [];
  for (let i = 0, j = 0; i < xs.length && j < ys.length; ) {
    if (xs[i] === ys[j]) {
      out.push(xs[i]);
      i++;
      j++;
    } else if (t[i + 1][j] >= t[i][j + 1]) i++;
    else j++;
  }
  return out;
}

const idsOf = (xs: ElogiumOut[]) => new Set(xs.flatMap((e) => (e.id ? [e.id] : [])));

/**
 * One day of two editions as rows: the eulogies both print in the same order share a row (the
 * longest common subsequence); every other eulogy has a row of its own, so each side still reads
 * in its own printed order. A B-only row goes after the row holding B's previous eulogy.
 */
export function buildRows(a: ElogiumOut[], b: ElogiumOut[]): Row[] {
  const inA = idsOf(a);
  const inB = idsOf(b);
  const paired = new Set(
    lcs(
      a.flatMap((e) => (e.id && inB.has(e.id) ? [e.id] : [])),
      b.flatMap((e) => (e.id && inA.has(e.id) ? [e.id] : [])),
    ),
  );
  const body: EulogyRow[] = a.map((e) => ({ kind: "eulogy", a: e, b: null, counterpart: null }));
  let after = -1;
  for (const e of b) {
    const i = e.id && paired.has(e.id) ? body.findIndex((r) => r.a?.id === e.id && r.b === null) : -1;
    if (i >= 0) {
      body[i].b = e;
      after = i;
    } else {
      after += 1;
      body.splice(after, 0, { kind: "eulogy", a: null, b: e, counterpart: null });
    }
  }
  const rows: Row[] = [{ kind: "titulus" }, ...body, { kind: "conclusio" }];
  rows.forEach((r, i) => {
    if (r.kind !== "eulogy" || (r.a && r.b)) return;
    const side: Side = r.a ? "a" : "b";
    const other: Side = side === "a" ? "b" : "a";
    const id = r[side]?.id;
    if (!id) return;
    const j = rows.findIndex((x, k) => k !== i && x.kind === "eulogy" && x[other]?.id === id);
    if (j >= 0) r.counterpart = j;
  });
  return rows;
}

/**
 * The note for the empty side of row `index`: where `emptyEdition` prints the eulogy shown on the
 * other side. Null for a paired row, a frame row, or a eulogy without canonical id.
 */
export function gapNote(rows: Row[], index: number, emptyEdition: string, placements: Placements, day: Day): GapNote | null {
  const row = rows[index];
  if (row.kind !== "eulogy" || (row.a && row.b) || (!row.a && !row.b)) return null;
  const empty: Side = row.a ? "b" : "a";
  const id = (row.a ?? row.b)?.id;
  if (!id) return null;
  if (row.counterpart !== null) {
    const there = rows[row.counterpart] as EulogyRow;
    const c = there[empty];
    return { kind: "moved", direction: row.counterpart < index ? "above" : "below", entry: c && !c.unnumbered ? c.entry : null };
  }
  const known = placements[id];
  if (!known) return { kind: "pending" };
  const p = known[emptyEdition];
  if (!p) return { kind: "absent" };
  const [mm, dd] = p.day_printed.split("-").map(Number);
  if (mm === day.mm && dd === day.dd) return null;
  return { kind: "elsewhere", day: { mm, dd }, entry: p.unnumbered ? null : p.entry };
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run lib/__tests__/parallel.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Write the failing tests for the names and `dayPath`**

Append to `lib/__tests__/editions.test.ts` (it already defines `ed` and `E`); add `shortName, yearAndLanguage` to its import from `@/lib/editions`:

```ts
describe("note names", () => {
  it("names an edition by year, or by year and language when both share it", () => {
    expect(shortName(E.e1749, E.e2004)).toBe("1749");
    expect(shortName(E.e2004it, E.e2004)).toBe("2004 Italian");
    expect(shortName(E.e2004, E.e2004it)).toBe("2004 Latin");
  });

  it("gives year and language for notices", () => {
    expect(yearAndLanguage(E.e1914en)).toBe("1914 English");
  });
});
```

Append to `lib/__tests__/calendar.test.ts` (import `dayPath` if not already imported):

```ts
describe("dayPath with a second edition", () => {
  it("carries ?with= when given, and nothing otherwise", () => {
    expect(dayPath("martyrologium_romanum_2004", { mm: 10, dd: 4 })).toBe("/read/martyrologium_romanum_2004/10/04");
    expect(dayPath("martyrologium_romanum_2004", { mm: 10, dd: 4 }, null)).toBe("/read/martyrologium_romanum_2004/10/04");
    expect(dayPath("martyrologium_romanum_2004", { mm: 10, dd: 4 }, "martyrologium_romanum_1749")).toBe(
      "/read/martyrologium_romanum_2004/10/04?with=martyrologium_romanum_1749",
    );
  });
});
```

- [ ] **Step 6: Run them to see them fail**

Run: `npx vitest run lib/__tests__/editions.test.ts lib/__tests__/calendar.test.ts`
Expected: FAIL — `shortName is not a function` (or not exported), and the `?with=` assertion fails.

- [ ] **Step 7: Implement them**

Append to `lib/editions.ts`:

```ts
const LANGUAGE_NAMES: Record<Lang, string> = { la: "Latin", it: "Italian", en: "English" };

/** "1914 English", for notices. */
export function yearAndLanguage(e: EditionOut): string {
  return `${e.year} ${LANGUAGE_NAMES[editionLang(e)]}`;
}

/** How a note names `e` beside `other`: by its year, or by year and language when the two share a year. */
export function shortName(e: EditionOut, other: EditionOut): string {
  return e.year === other.year ? yearAndLanguage(e) : String(e.year);
}
```

Replace `dayPath` in `lib/calendar.ts`:

```ts
export function dayPath(edition: string, d: Day, withEdition?: string | null): string {
  const path = `/read/${encodeURIComponent(edition)}/${pad2(d.mm)}/${pad2(d.dd)}`;
  return withEdition ? `${path}?with=${encodeURIComponent(withEdition)}` : path;
}
```

- [ ] **Step 8: Run all checks**

Run: `npx vitest run && npx tsc --noEmit -p . && npx eslint app components lib scripts`
Expected: all tests pass, no type or lint errors.

- [ ] **Step 9: Commit**

```bash
git add lib/parallel.ts lib/editions.ts lib/calendar.ts lib/__tests__/parallel.test.ts lib/__tests__/editions.test.ts lib/__tests__/calendar.test.ts
git commit -m "feat: align two editions' days into rows, with gap notes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nk2QD1sRjGjeCFwt5jmXTA"
```

---

### Task 2: Extract `Eulogy`, `DayStatus` and `useDay` from the reader

A refactor: the reader's behaviour must not change. Its existing tests are the safety net.

**Files:**
- Create: `components/Eulogy.tsx`, `components/DayStatus.tsx`, `lib/use-day.ts`
- Modify: `components/DayPage.tsx`, `components/Reader.tsx` (the `State` type and `DayView`)
- Test: `components/__tests__/DayPage.test.tsx`, `components/__tests__/Reader.test.tsx` (existing, unchanged)

**Interfaces:**
- Consumes: `getDay`, `ApiError` from `lib/api.ts`; `LockedNotice`; `EulogyText`.
- Produces:
  - `components/Eulogy.tsx`: `default function Eulogy({ e, edition }: { e: ElogiumOut; edition?: string })`
  - `components/DayPage.tsx`: also `export function Conclusio({ text }: { text: string })`
  - `lib/use-day.ts`: `type DayState = { kind: "loading" } | { kind: "ready"; day: DayOut } | { kind: "locked"; accessInfo: string | null } | { kind: "notext" } | { kind: "error" }` and `function useDay(edition: string, mm: number, dd: number): { state: DayState; retry: () => void }`
  - `components/DayStatus.tsx`: `default function DayStatus({ state, retry, title, signedIn, mm, dd }: { state: Exclude<DayState, { kind: "ready" }>; retry: () => void; title: string; signedIn: boolean; mm: number; dd: number })`

- [ ] **Step 1: Confirm the safety net is green**

Run: `npx vitest run components/__tests__/DayPage.test.tsx components/__tests__/Reader.test.tsx`
Expected: PASS.

- [ ] **Step 2: Create `components/Eulogy.tsx`**

```tsx
import EulogyText from "@/components/EulogyText";
import styles from "@/components/page.module.css";
import type { ElogiumOut } from "@/lib/types";

/**
 * One eulogy as printed: its number and asterisk as rubrics, or, unnumbered, as a centred
 * heading. `edition` (a CLBDR edition id) selects the misprint notes.
 */
export default function Eulogy({ e, edition }: { e: ElogiumOut; edition?: string }) {
  const text = e.text && edition ? <EulogyText text={e.text} id={e.id} edition={edition} noteClassName={styles.sic} /> : e.text;
  return e.unnumbered ? (
    <p className={`${styles.entry} ${styles.unnumbered}`} data-unnumbered="true">
      {text}
    </p>
  ) : (
    <p className={styles.entry}>
      <span className={styles.rubric}>
        {e.entry}
        {e.asterisk ? "*" : ""}
      </span>
      {text}
    </p>
  );
}
```

- [ ] **Step 3: Make `DayPage` use it, and export `Conclusio`**

Replace the whole of `components/DayPage.tsx` with:

```tsx
import Eulogy from "@/components/Eulogy";
import styles from "@/components/page.module.css";
import type { DayContentOut } from "@/lib/types";

/** Split "… R. Deo gratias." so the response mark can be set as a rubric. */
export function Conclusio({ text }: { text: string }) {
  const at = text.lastIndexOf("R.");
  if (at < 0) return <p className={styles.conclusio}>{text}</p>;
  return (
    <p className={styles.conclusio}>
      {text.slice(0, at)}
      <span className={styles.rubric}>R.</span>
      {text.slice(at + 2)}
    </p>
  );
}

/**
 * One day typeset as a printed page. `heading` is used when the edition prints no titulus;
 * `edition` (a CLBDR edition id) selects the misprint notes.
 */
export default function DayPage({
  day, heading, lang, edition,
}: { day: DayContentOut; heading: string; lang?: "la" | "it" | "en"; edition?: string }) {
  return (
    <article className={styles.page} lang={lang}>
      <h2 className={styles.heading}>{day.titulus || heading}</h2>
      {day.elogia.map((e, i) => (
        <Eulogy key={e.id ?? i} e={e} edition={edition} />
      ))}
      {day.conclusio && <Conclusio text={day.conclusio} />}
    </article>
  );
}
```

- [ ] **Step 4: Create `lib/use-day.ts`**

```ts
"use client";

import { useEffect, useState } from "react";
import { ApiError, getDay } from "@/lib/api";
import { pad2 } from "@/lib/calendar";
import type { DayOut } from "@/lib/types";

export type DayState =
  | { kind: "loading" }
  | { kind: "ready"; day: DayOut }
  | { kind: "locked"; accessInfo: string | null }
  | { kind: "notext" }
  | { kind: "error" };

/**
 * One edition's day. Callers key their component on edition and day, so each day starts in
 * "loading"; `retry` loads again after an error.
 */
export function useDay(edition: string, mm: number, dd: number): { state: DayState; retry: () => void } {
  const [state, setState] = useState<DayState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getDay(edition, pad2(mm), pad2(dd)).then(
      (data) => {
        if (cancelled) return;
        if (data.metadata.access === "restricted-texts") {
          setState({ kind: "locked", accessInfo: data.metadata.access_info ?? null });
        } else {
          setState({ kind: "ready", day: data });
        }
      },
      (err: unknown) => {
        if (cancelled) return;
        setState(err instanceof ApiError && err.status === 404 ? { kind: "notext" } : { kind: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [edition, mm, dd, attempt]);

  const retry = () => {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  };

  return { state, retry };
}
```

- [ ] **Step 5: Create `components/DayStatus.tsx`**

```tsx
"use client";

import { signIn } from "next-auth/react";
import LockedNotice from "@/components/LockedNotice";
import { monthName } from "@/lib/calendar";
import type { DayState } from "@/lib/use-day";

/** What stands in for a day's page while it loads, or when it is locked, missing or failed. */
export default function DayStatus({
  state, retry, title, signedIn, mm, dd,
}: {
  state: Exclude<DayState, { kind: "ready" }>;
  retry: () => void;
  title: string;
  signedIn: boolean;
  mm: number;
  dd: number;
}) {
  switch (state.kind) {
    case "loading":
      return (
        <div role="status" className="mx-auto min-h-96 max-w-[38rem] animate-pulse rounded bg-[#fbf6ec]">
          <span className="sr-only">Loading…</span>
        </div>
      );
    case "locked":
      return <LockedNotice title={title} signedIn={signedIn} accessInfo={state.accessInfo} onSignIn={() => void signIn("zitadel")} />;
    case "notext":
      return <p className="mt-10 text-center">This edition has no text for {dd} {monthName(mm, "en")}.</p>;
    case "error":
      return (
        <p className="mt-10 text-center">
          The text could not be loaded.{" "}
          <button type="button" className="underline" onClick={retry}>Retry</button>
        </p>
      );
  }
}
```

- [ ] **Step 6: Make `DayView` use them**

In `components/Reader.tsx`:
- delete the `State` type (lines 15-20) and the whole body of `DayView` from `const [state, setState]` to its closing `</>` and replace the function with:

```tsx
/** One day's page; keyed by the parent on edition/day so each turn starts fresh in "loading". */
function DayView({
  edition, mm, dd, lang, title, signedIn, turn,
}: {
  edition: string; mm: number; dd: number; lang: Lang; title: string; signedIn: boolean; turn: Turn;
}) {
  const { state, retry } = useDay(edition, mm, dd);
  if (state.kind !== "ready") {
    return <DayStatus state={state} retry={retry} title={title} signedIn={signedIn} mm={mm} dd={dd} />;
  }
  return (
    <div className={turn === "next" ? styles.turnNext : turn === "prev" ? styles.turnPrev : undefined}>
      <DayPage day={state.day} heading={dateHeading({ mm, dd }, lang)} lang={lang} edition={edition} />
    </div>
  );
}
```

- update the imports at the top: remove `getDay` and `ApiError` from the `@/lib/api` import if nothing else in the file uses them (keep `getAccess`, `getEditions`); remove `LockedNotice`, `signIn`, `DayOut` and `monthName`, `pad2` if now unused; add

```tsx
import DayStatus from "@/components/DayStatus";
import { useDay } from "@/lib/use-day";
```

Let `npx tsc --noEmit -p .` and `npx eslint components` tell you which imports are now unused.

- [ ] **Step 7: Run all checks**

Run: `npx vitest run && npx tsc --noEmit -p . && npx eslint app components lib scripts`
Expected: everything passes, with no test changed.

- [ ] **Step 8: Commit**

```bash
git add components/Eulogy.tsx components/DayStatus.tsx lib/use-day.ts components/DayPage.tsx components/Reader.tsx
git commit -m "refactor: extract Eulogy, DayStatus and useDay from the reader

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nk2QD1sRjGjeCFwt5jmXTA"
```

---

### Task 3: `usePlacements` — where each edition prints a eulogy

**Files:**
- Create: `lib/use-placements.ts`
- Test: `lib/__tests__/use-placements.test.ts` (new)

**Interfaces:**
- Consumes: `getElogium(id): Promise<EulogyOut>` and `ApiError` from `lib/api.ts`; `Placements` from `lib/parallel.ts`.
- Produces: `usePlacements(ids: string[]): Placements` and `__resetPlacements(): void` (test only).

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/use-placements.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    constructor(public status: number, public title: string) { super(title); }
  }
  return { getElogium: vi.fn(), ApiError };
});

import { getElogium, ApiError } from "@/lib/api";
import { usePlacements, __resetPlacements } from "@/lib/use-placements";

const placement = { day_printed: "10-05", entry: 3, asterisk: false, unnumbered: false, text: null };
const eulogy = (id: string) => ({ id, subject: {}, anchor_day: "10-05", deprecated: false, editions: { e1749: placement } });

beforeEach(() => {
  __resetPlacements();
  vi.mocked(getElogium).mockReset();
});

describe("usePlacements", () => {
  it("fetches each id once and returns its placements", async () => {
    vi.mocked(getElogium).mockImplementation(async (id: string) => eulogy(id));
    const { result, rerender } = renderHook(({ ids }) => usePlacements(ids), { initialProps: { ids: ["mr:a"] } });
    expect(result.current).toEqual({});
    await waitFor(() => expect(result.current).toEqual({ "mr:a": { e1749: placement } }));
    rerender({ ids: ["mr:a"] });
    expect(getElogium).toHaveBeenCalledTimes(1);
  });

  it("records an id the API does not know as printed nowhere", async () => {
    vi.mocked(getElogium).mockRejectedValue(new ApiError(404, "Not Found"));
    const { result } = renderHook(() => usePlacements(["mr:nope"]));
    await waitFor(() => expect(result.current).toEqual({ "mr:nope": {} }));
  });

  it("leaves a failed id unknown, and asks again on the next mount", async () => {
    vi.mocked(getElogium).mockRejectedValue(new ApiError(500, "Server Error"));
    const first = renderHook(() => usePlacements(["mr:a"]));
    await waitFor(() => expect(getElogium).toHaveBeenCalledTimes(1));
    expect(first.result.current).toEqual({});
    first.unmount();
    renderHook(() => usePlacements(["mr:a"]));
    await waitFor(() => expect(getElogium).toHaveBeenCalledTimes(2));
  });

  it("asks nothing for no ids", () => {
    const { result } = renderHook(() => usePlacements([]));
    expect(result.current).toEqual({});
    expect(getElogium).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run lib/__tests__/use-placements.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/use-placements"`.

- [ ] **Step 3: Implement `lib/use-placements.ts`**

```ts
"use client";

import { useEffect, useState } from "react";
import { ApiError, getElogium } from "@/lib/api";
import type { Placements } from "@/lib/parallel";

// For the session: an id's placements in every edition ({} when the API does not know it).
// A failed fetch is not cached, so the next page asks again.
const cache = new Map<string, Placements[string]>();

/** Test-only: forgets every cached placement. */
export function __resetPlacements() {
  cache.clear();
}

/** Every edition's placement of each eulogy in `ids`; an id still loading, or whose fetch failed, is absent. */
export function usePlacements(ids: string[]): Placements {
  const [, setVersion] = useState(0);
  const key = ids.join(" ");

  useEffect(() => {
    const missing = key ? key.split(" ").filter((id) => !cache.has(id)) : [];
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map((id) =>
        getElogium(id).then(
          (e) => void cache.set(id, e.editions),
          (err: unknown) => {
            if (err instanceof ApiError && err.status === 404) cache.set(id, {});
          },
        ),
      ),
    ).then(() => {
      if (!cancelled) setVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return Object.fromEntries(ids.flatMap((id) => (cache.has(id) ? [[id, cache.get(id)!]] : [])));
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run lib/__tests__/use-placements.test.ts`
Expected: PASS.

- [ ] **Step 5: Run all checks**

Run: `npx vitest run && npx tsc --noEmit -p . && npx eslint app components lib scripts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add lib/use-placements.ts lib/__tests__/use-placements.test.ts
git commit -m "feat: fetch and cache each eulogy's placements across editions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nk2QD1sRjGjeCFwt5jmXTA"
```

---

### Task 4: `Spread` — two facing sheets, rows in step

**Files:**
- Create: `components/Spread.tsx`
- Modify: `components/page.module.css` (append)
- Test: `components/__tests__/Spread.test.tsx` (new)

**Interfaces:**
- Consumes: `buildRows`, `gapNote`, `GapNote`, `Row` (Task 1); `shortName`, `yearAndLanguage`, `editionLang`, `editionTitle`, `languageLabel`, `titleCase` from `lib/editions.ts`; `dayPath`, `dateHeading`, `monthName`, `Lang` from `lib/calendar.ts`; `useDay`, `DayState` (Task 2); `usePlacements` (Task 3); `Eulogy`, `DayStatus`, `DayPage`, `Conclusio` (Task 2).
- Produces: `default function Spread({ a, b, editions, mm, dd, signedIn }: { a: string; b: string; editions: EditionOut[]; mm: number; dd: number; signedIn: boolean })`. Each grid cell carries `data-row` (1-based row) and `data-side` (`"a"` | `"b"`).

- [ ] **Step 1: Write the failing tests**

Create `components/__tests__/Spread.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { signInMock } = vi.hoisted(() => ({ signInMock: vi.fn() }));
vi.mock("next-auth/react", () => ({ signIn: signInMock }));
vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    constructor(public status: number, public title: string) { super(title); }
  }
  return { getDay: vi.fn(), getElogium: vi.fn(), ApiError };
});

import Spread from "@/components/Spread";
import { getDay, getElogium } from "@/lib/api";
import { __resetPlacements } from "@/lib/use-placements";
import type { DayOut, EditionOut, ElogiumOut } from "@/lib/types";

const A = "martyrologium_romanum_2004";
const B = "martyrologium_romanum_1749";
const ed = (edition_id: string, year: number, locale: string, aligned: boolean | null = true): EditionOut => ({
  edition_id, year, locale, nature: "editio_typica", book: "martyrologium", scope: {}, promulgation: {},
  governance: { governing_body: "", type: "" }, availability: { status: "public" }, aligned,
});
const EDITIONS = [ed(A, 2004, "la"), ed(B, 1749, "la")];
const el = (id: string, entry: number, text: string): ElogiumOut => ({ id, entry, asterisk: false, unnumbered: false, anchor_day: "10-04", text });
const day = (edition: string, elogia: ElogiumOut[], access = "public"): DayOut => ({
  titulus: null, elogia, conclusio: "Et alibi. R. Deo gratias.",
  metadata: { edition, month: 10, day: 4, access },
});

function serve(days: Record<string, DayOut>) {
  vi.mocked(getDay).mockImplementation(async (edition: string) => days[edition]);
}
const cellOf = (text: string) => screen.getByText(text).closest("[data-row]")!;

beforeEach(() => {
  __resetPlacements();
  vi.mocked(getDay).mockReset();
  vi.mocked(getElogium).mockReset();
});

describe("Spread", () => {
  it("sets a eulogy level with its counterpart, on its own sheet", async () => {
    serve({ [A]: day(A, [el("mr:x", 1, "Romae sancti X.")]), [B]: day(B, [el("mr:x", 4, "Romae passio sancti X.")]) });
    render(<Spread a={A} b={B} editions={EDITIONS} mm={10} dd={4} signedIn={false} />);
    await screen.findByText("Romae sancti X.");
    const left = cellOf("Romae sancti X.");
    const right = cellOf("Romae passio sancti X.");
    expect(left.getAttribute("data-row")).toBe(right.getAttribute("data-row"));
    expect(left.getAttribute("data-side")).toBe("a");
    expect(right.getAttribute("data-side")).toBe("b");
    expect(screen.getByText("Martyrologium Romanum 2004 · Latin")).toBeInTheDocument();
    expect(screen.getByText("Martyrologium Romanum 1749 · Latin")).toBeInTheDocument();
  });

  it("notes a eulogy the other edition prints on another day, linking there in the same pairing", async () => {
    serve({ [A]: day(A, [el("mr:x", 1, "Sancti X."), el("mr:w", 2, "Sancti W.")]), [B]: day(B, [el("mr:x", 4, "Sancti X antiqui.")]) });
    let resolve!: (v: unknown) => void;
    vi.mocked(getElogium).mockReturnValue(new Promise((r) => { resolve = r; }) as never);
    render(<Spread a={A} b={B} editions={EDITIONS} mm={10} dd={4} signedIn={false} />);
    expect(await screen.findByText(/not on this day in/)).toHaveTextContent("[not on this day in 1749]");
    resolve({ id: "mr:w", subject: {}, anchor_day: "10-05", deprecated: false,
      editions: { [B]: { day_printed: "10-05", entry: 3, asterisk: false, unnumbered: false, text: null } } });
    const link = await screen.findByRole("link", { name: /5 October, n\. 3/ });
    expect(link).toHaveAttribute("href", `/read/${A}/10/05?with=${B}`);
    expect(link.closest("[data-row]")!.getAttribute("data-row")).toBe(cellOf("Sancti W.").getAttribute("data-row"));
  });

  it("notes a eulogy the other edition does not print", async () => {
    serve({ [A]: day(A, [el("mr:w", 2, "Sancti W.")]), [B]: day(B, []) });
    vi.mocked(getElogium).mockResolvedValue({ id: "mr:w", subject: {}, anchor_day: "10-04", deprecated: false, editions: {} });
    render(<Spread a={A} b={B} editions={EDITIONS} mm={10} dd={4} signedIn={false} />);
    expect(await screen.findByText(/not in/)).toHaveTextContent("[not in 1749]");
  });

  it("names editions of the same year by year and language", async () => {
    const IT = "martyrologium_romanum_2004_it_IT";
    serve({ [A]: day(A, [el("mr:w", 2, "Sancti W.")]), [IT]: day(IT, []) });
    vi.mocked(getElogium).mockResolvedValue({ id: "mr:w", subject: {}, anchor_day: "10-04", deprecated: false, editions: {} });
    render(<Spread a={A} b={IT} editions={[...EDITIONS, ed(IT, 2004, "it-IT")]} mm={10} dd={4} signedIn={false} />);
    expect(await screen.findByText(/not in/)).toHaveTextContent("[not in 2004 Italian]");
  });

  it("falls back to two independent pages for an unaligned edition, saying why", async () => {
    const EN = "martyrologium_romanum_1914_en_unofficial";
    serve({ [A]: day(A, [el("mr:x", 1, "Sancti X.")]), [EN]: day(EN, [{ ...el("mr:x", 1, "Of Saint X."), id: null }]) });
    render(<Spread a={A} b={EN} editions={[...EDITIONS, ed(EN, 1914, "en", false)]} mm={10} dd={4} signedIn={false} />);
    expect(await screen.findByText("Of Saint X.")).toBeInTheDocument();
    expect(screen.getByText("The 1914 English edition is not yet aligned, so its eulogies are not matched.")).toBeInTheDocument();
    expect(screen.getByText("Sancti X.").closest("[data-row]")).toBeNull();
  });

  it("shows the locked notice on a locked side, and the other side reads", async () => {
    serve({ [A]: day(A, [el("mr:x", 1, "Sancti X.")]), [B]: day(B, [{ ...el("mr:x", 4, ""), text: null }], "restricted-texts") });
    render(<Spread a={A} b={B} editions={EDITIONS} mm={10} dd={4} signedIn={false} />);
    expect(await screen.findByText("Sancti X.")).toBeInTheDocument();
    expect(screen.getByText(/is a copyrighted edition/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(signInMock).toHaveBeenCalledWith("zitadel");
  });
});
```

Check `LockedNotice`'s sign-in button label before running: `grep -n "Sign in" components/LockedNotice.tsx`. If it differs, use its exact text in the last test.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run components/__tests__/Spread.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/Spread"`.

- [ ] **Step 3: Add the styles**

Append to `components/page.module.css`:

```css
/*
 * Two editions side by side. Phones: one sheet, each eulogy followed by its counterpart.
 * From 640px: two cream sheets (decorative layers spanning every row) with an empty gutter,
 * and each pair on one grid row, so a eulogy and its counterpart start level.
 */
.spread {
  display: grid; grid-template-columns: minmax(0, 1fr); padding: 1.5rem 1.25rem;
  background: #fbf6ec; color: #2a1a10; font-family: Georgia, "Times New Roman", serif;
  font-size: 1.05rem; line-height: 1.6; box-shadow: inset 0 0 40px rgba(120, 80, 40, 0.08), 0 2px 10px rgba(0, 0, 0, 0.12);
}
.sheet { display: none; }
.cellB { margin-left: 1rem; border-top: 1px solid rgba(120, 80, 40, 0.18); }
.tag { display: block; margin-top: 0.3rem; font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase; color: #5c4f45; }
.caption { margin: -0.6rem 0 1rem; text-align: center; font-variant: small-caps; font-size: 0.85rem; color: #5c4f45; }
.gap { margin: 0.6rem 0; font-size: 0.8em; color: #5c4f45; }
.gap a { color: inherit; text-decoration: underline; }
.facing { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2.5rem; }
@media (min-width: 640px) {
  .spread {
    grid-template-columns: minmax(0, 1fr) 2.5rem minmax(0, 1fr);
    padding: 0; background: none; box-shadow: none;
  }
  .sheet {
    display: block; grid-row: 1 / span var(--rows); background: #fbf6ec;
    box-shadow: inset 0 0 40px rgba(120, 80, 40, 0.08), 0 2px 10px rgba(0, 0, 0, 0.12);
  }
  .sheetA { grid-column: 1; }
  .sheetB { grid-column: 3; }
  .cellA, .cellB { position: relative; grid-row: var(--row); padding: 0 2.25rem; }
  .cellA { grid-column: 1; }
  .cellB { grid-column: 3; margin-left: 0; border-top: 0; }
  .first { padding-top: 2rem; }
  .last { padding-bottom: 2rem; }
  .tag { display: none; }
  .facing { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
}
```

- [ ] **Step 4: Implement `components/Spread.tsx`**

```tsx
"use client";

import Link from "next/link";
import { Fragment, useMemo, type CSSProperties, type ReactNode } from "react";
import DayPage, { Conclusio } from "@/components/DayPage";
import DayStatus from "@/components/DayStatus";
import Eulogy from "@/components/Eulogy";
import styles from "@/components/page.module.css";
import { dateHeading, dayPath, monthName, type Day, type Lang } from "@/lib/calendar";
import { editionLang, editionTitle, languageLabel, shortName, titleCase, yearAndLanguage } from "@/lib/editions";
import { buildRows, gapNote, type GapNote, type Row } from "@/lib/parallel";
import type { EditionOut } from "@/lib/types";
import { useDay } from "@/lib/use-day";
import { usePlacements } from "@/lib/use-placements";

interface SideInfo {
  id: string;
  meta: EditionOut | undefined;
  lang: Lang;
  /** "Martyrologium Romanum 1749", for notices. */
  title: string;
  /** "Martyrologium Romanum 1749 · Latin", under the heading. */
  caption: string;
  /** "1749" or "2004 Italian", in gap notes and phone tags. */
  name: string;
}

function sideInfo(id: string, otherId: string, editions: EditionOut[]): SideInfo {
  const meta = editions.find((e) => e.edition_id === id);
  const other = editions.find((e) => e.edition_id === otherId);
  const title = meta ? `${titleCase(editionTitle(meta))} ${meta.year}` : id;
  return {
    id,
    meta,
    lang: meta ? editionLang(meta) : "la",
    title,
    caption: meta ? `${title} · ${languageLabel(meta)}` : id,
    name: meta && other ? shortName(meta, other) : id,
  };
}

/** The editorial note on the empty side of a one-sided row, set like the misprint notes. */
function Gap({ note, name, href }: { note: GapNote; name: string; href: (d: Day) => string }) {
  const n = (entry: number | null) => (entry === null ? "" : `, n. ${entry}`);
  let body: ReactNode;
  switch (note.kind) {
    case "absent":
      body = <><i>not in</i> {name}</>;
      break;
    case "pending":
      body = <><i>not on this day in</i> {name}</>;
      break;
    case "moved":
      body = <><i>{name}:</i> {note.entry === null ? "" : `n. ${note.entry}, `}{note.direction}</>;
      break;
    case "elsewhere":
      body = (
        <>
          <i>{name}:</i>{" "}
          <Link href={href(note.day)}>
            {note.day.dd} {monthName(note.day.mm, "en")}{n(note.entry)} →
          </Link>
        </>
      );
      break;
  }
  return <p className={styles.gap}>[{body}]</p>;
}

/**
 * One day of two editions as two facing sheets. When both days are ready and both editions are
 * aligned to canonical ids, eulogies are set row by row, each level with its counterpart; otherwise
 * each sheet is a page of its own.
 */
export default function Spread({
  a, b, editions, mm, dd, signedIn,
}: {
  a: string; b: string; editions: EditionOut[]; mm: number; dd: number; signedIn: boolean;
}) {
  const day = useMemo<Day>(() => ({ mm, dd }), [mm, dd]);
  const A = sideInfo(a, b, editions);
  const B = sideInfo(b, a, editions);
  const dayA = useDay(a, mm, dd);
  const dayB = useDay(b, mm, dd);
  const sa = dayA.state;
  const sb = dayB.state;
  const aligned = A.meta?.aligned !== false && B.meta?.aligned !== false;

  const rows = useMemo<Row[] | null>(
    () => (aligned && sa.kind === "ready" && sb.kind === "ready" ? buildRows(sa.day.elogia, sb.day.elogia) : null),
    [aligned, sa, sb],
  );
  const oneSided = useMemo(
    () =>
      (rows ?? []).flatMap((r) =>
        r.kind === "eulogy" && !(r.a && r.b) && r.counterpart === null && (r.a ?? r.b)?.id ? [(r.a ?? r.b)!.id!] : [],
      ),
    [rows],
  );
  const placements = usePlacements(oneSided);
  const href = (d: Day) => dayPath(a, d, b);

  const unaligned = [A, B].filter((s) => s.meta?.aligned === false);
  const notice = unaligned.map((s) => (
    <p key={s.id} className="mb-3 text-center text-sm text-slate-600 dark:text-slate-400">
      The {yearAndLanguage(s.meta!)} edition is not yet aligned, so its eulogies are not matched.
    </p>
  ));

  if (!rows || sa.kind !== "ready" || sb.kind !== "ready") {
    const page = (s: SideInfo, d: typeof dayA) =>
      d.state.kind === "ready" ? (
        <DayPage day={d.state.day} heading={dateHeading(day, s.lang)} lang={s.lang} edition={s.id} />
      ) : (
        <DayStatus state={d.state} retry={d.retry} title={s.title} signedIn={signedIn} mm={mm} dd={dd} />
      );
    return (
      <>
        {notice}
        <div className={styles.facing}>
          <div>{page(A, dayA)}</div>
          <div>{page(B, dayB)}</div>
        </div>
      </>
    );
  }

  const days = { a: sa.day, b: sb.day };
  const info = { a: A, b: B };
  const cell = (r: Row, i: number, side: "a" | "b"): ReactNode => {
    const s = info[side];
    const d = days[side];
    if (r.kind === "titulus") {
      return (
        <>
          <h2 className={styles.heading}>{d.titulus || dateHeading(day, s.lang)}</h2>
          <p className={styles.caption}>{s.caption}</p>
        </>
      );
    }
    if (r.kind === "conclusio") return d.conclusio ? <Conclusio text={d.conclusio} /> : null;
    const e = r[side];
    if (e) return <Eulogy e={e} edition={s.id} />;
    const note = gapNote(rows, i, s.id, placements, day);
    return note ? <Gap note={note} name={s.name} href={href} /> : null;
  };

  return (
    <>
      {notice}
      <div className={styles.spread} style={{ "--rows": rows.length } as CSSProperties}>
        <div className={`${styles.sheet} ${styles.sheetA}`} aria-hidden />
        <div className={`${styles.sheet} ${styles.sheetB}`} aria-hidden />
        {rows.map((r, i) => {
          const edge = i === 0 ? styles.first : i === rows.length - 1 ? styles.last : "";
          const style = { "--row": i + 1 } as CSSProperties;
          return (
            <Fragment key={i}>
              <div className={`${styles.cellA} ${edge}`} style={style} data-row={i + 1} data-side="a" lang={A.lang}>
                {cell(r, i, "a")}
              </div>
              <div className={`${styles.cellB} ${edge}`} style={style} data-row={i + 1} data-side="b" lang={B.lang}>
                {r.kind === "eulogy" && <span className={styles.tag}>{B.name}</span>}
                {cell(r, i, "b")}
              </div>
            </Fragment>
          );
        })}
      </div>
    </>
  );
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run components/__tests__/Spread.test.tsx`
Expected: PASS. If the "printed on another day" test cannot find the link by name, print `screen.debug()` and check the rendered note text matches `[1749: 5 October, n. 3 →]`.

- [ ] **Step 6: Run all checks**

Run: `npx vitest run && npx tsc --noEmit -p . && npx eslint app components lib scripts`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add components/Spread.tsx components/page.module.css components/__tests__/Spread.test.tsx
git commit -m "feat: set two editions' days as facing sheets, eulogies level with their counterparts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nk2QD1sRjGjeCFwt5jmXTA"
```

---

### Task 5: Paired mode in the reader — URL, bar, lockstep

**Files:**
- Modify: `components/Reader.tsx`, `components/ReaderBar.tsx`, `app/read/[edition]/[mm]/[dd]/page.tsx`
- Test: `components/__tests__/Reader.test.tsx`, `components/__tests__/ReadRoutes.test.tsx`

**Interfaces:**
- Consumes: `Spread` (Task 4), `dayPath(edition, d, withEdition?)` (Task 1), `editionExists`, `editionMeta` from `lib/server-editions.ts`.
- Produces:
  - `Reader({ edition, mm, dd, signedIn, withEdition }: { …; withEdition?: string | null })`
  - `ReaderBar` gains props `compareWith: string | null`, `compareBooks: { id: string; label: string }[]`, `onCompare: (id: string | null, focusId: string) => void`, `onSwap: () => void`.
  - Route: `DayRoute({ params, searchParams })` and `generateMetadata({ params, searchParams })`, `searchParams` optional.

- [ ] **Step 1: Write the failing route tests**

In `components/__tests__/ReadRoutes.test.tsx`, replace the `next/navigation` mock with one that also mocks `redirect`:

```ts
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
  redirect: (to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); },
}));
```

and add, inside `describe("/read routes", …)`:

```ts
  const withParams = (p: Record<string, string>, sp: Record<string, string | string[]>) => ({
    params: Promise.resolve(p), searchParams: Promise.resolve(sp),
  });
  const P = { edition: "martyrologium_romanum_2004", mm: "10", dd: "04" };

  it("renders a valid pairing", async () => {
    expect(await DayRoute(withParams(P, { with: "martyrologium_romanum_1749" }))).toBeTruthy();
  });

  it("drops a pairing with an unknown edition, or with itself", async () => {
    existsMock.mockImplementation(async (id: string) => id !== "nope");
    await expect(DayRoute(withParams(P, { with: "nope" }))).rejects.toThrow("NEXT_REDIRECT /read/martyrologium_romanum_2004/10/04");
    await expect(DayRoute(withParams(P, { with: P.edition }))).rejects.toThrow("NEXT_REDIRECT /read/martyrologium_romanum_2004/10/04");
  });

  it("treats a repeated with as no pairing", async () => {
    expect(await DayRoute(withParams(P, { with: ["a", "b"] }))).toBeTruthy();
  });

  it("titles a pairing with both editions", async () => {
    metaMock.mockImplementation(async (id: string) =>
      id === "martyrologium_romanum_1749" ? { title: "Martyrologium Romanum", year: 1749 } : { title: "Martyrologium Romanum", year: 2004 });
    expect(await generateMetadata(withParams(P, { with: "martyrologium_romanum_1749" }))).toEqual({
      title: "4 October — Martyrologium Romanum 2004 | Martyrologium Romanum 1749",
    });
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run components/__tests__/ReadRoutes.test.tsx`
Expected: FAIL — no redirect thrown, and the title lacks the second edition.

- [ ] **Step 3: Implement the route**

Replace `app/read/[edition]/[mm]/[dd]/page.tsx` with:

```tsx
import { notFound, redirect } from "next/navigation";
import Reader from "@/components/Reader";
import { dayPath, monthName, parseDay } from "@/lib/calendar";
import type { Metadata } from "next";
import { editionExists, editionMeta } from "@/lib/server-editions";
import { getViewer } from "@/lib/viewer";

type Params = Promise<{ edition: string; mm: string; dd: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/** The second edition of a pairing (`?with=`); a missing or repeated parameter is no pairing. */
async function withParam(searchParams?: SearchParams): Promise<string | null> {
  const w = (await searchParams)?.with;
  return typeof w === "string" && w ? w : null;
}

const named = (meta: { title: string; year: number } | null, id: string) => (meta ? `${meta.title} ${meta.year}` : id);

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams?: SearchParams }): Promise<Metadata> {
  const { edition, mm, dd } = await params;
  const day = parseDay(mm, dd);
  if (!day) return { title: "Martyrologium" };
  const w = await withParam(searchParams);
  const books = [named(await editionMeta(edition), edition)];
  if (w && w !== edition) books.push(named(await editionMeta(w), w));
  return { title: `${day.dd} ${monthName(day.mm, "en")} — ${books.join(" | ")}` };
}

export default async function DayRoute({ params, searchParams }: { params: Params; searchParams?: SearchParams }) {
  const { edition, mm, dd } = await params;
  const day = parseDay(mm, dd);
  if (!day || !(await editionExists(edition))) notFound();
  const w = await withParam(searchParams);
  if (w !== null && (w === edition || !(await editionExists(w)))) redirect(dayPath(edition, day));
  const viewer = await getViewer();
  return (
    <main className={w ? "mx-auto max-w-7xl p-4" : "mx-auto max-w-5xl p-4"}>
      <Reader edition={edition} mm={day.mm} dd={day.dd} signedIn={viewer.signedIn} withEdition={w} />
    </main>
  );
}
```

- [ ] **Step 4: Run the route tests to see them pass**

Run: `npx vitest run components/__tests__/ReadRoutes.test.tsx`
Expected: PASS (old and new tests).

- [ ] **Step 5: Write the failing reader tests**

In `components/__tests__/Reader.test.tsx`, add `getElogium: vi.fn()` to the object returned by the `@/lib/api` mock factory, add `getElogium` to the import from `@/lib/api`, and add `waitFor` to the import from `@testing-library/react`. In `beforeEach`, add `vi.mocked(getElogium).mockReset();`. Then add, after the existing `describe("Reader", …)` block:

```tsx
const EN = "martyrologium_romanum_1914_en_unofficial";
const renderPair = (mm = 10, dd = 2) =>
  render(<Reader edition="martyrologium_romanum_1749" mm={mm} dd={dd} signedIn={false} withEdition={EN} />);

describe("Reader, two editions", () => {
  it("shows both editions' texts", async () => {
    renderPair();
    expect(await screen.findAllByText("Romae passio sancti Modesti Sardi.")).toHaveLength(2);
  });

  it("keeps the pairing on every way of turning the day", async () => {
    renderPair();
    await screen.findAllByText("Romae passio sancti Modesti Sardi.");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(push).toHaveBeenLastCalledWith(`/read/martyrologium_romanum_1749/10/03?with=${EN}`);
  });

  it("keeps the pairing from the strips and the day select", async () => {
    const first = renderPair();
    await screen.findAllByText("Romae passio sancti Modesti Sardi.");
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(push).toHaveBeenLastCalledWith(`/read/martyrologium_romanum_1749/10/01?with=${EN}`);
    first.unmount();
    __resetReaderState();
    renderPair();
    await screen.findAllByText("Romae passio sancti Modesti Sardi.");
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "15" } });
    expect(push).toHaveBeenLastCalledWith(`/read/martyrologium_romanum_1749/10/15?with=${EN}`);
  });

  it("swaps the two editions, and closes the second", async () => {
    const first = renderPair();
    await screen.findAllByText("Romae passio sancti Modesti Sardi.");
    fireEvent.click(screen.getByRole("button", { name: "Swap the two editions" }));
    expect(push).toHaveBeenLastCalledWith(`/read/${EN}/10/02?with=martyrologium_romanum_1749`);
    first.unmount();
    __resetReaderState();
    renderPair();
    await screen.findAllByText("Romae passio sancti Modesti Sardi.");
    fireEvent.click(screen.getByRole("button", { name: "Close the second edition" }));
    expect(push).toHaveBeenLastCalledWith("/read/martyrologium_romanum_1749/10/02");
  });

  it("opens a comparison from the Compare with select, offering every other open book", async () => {
    render1749();
    await screen.findByText("Romae passio sancti Modesti Sardi.");
    const select = screen.getByLabelText("Compare with");
    // The book list arrives with the editions, after the day.
    await waitFor(() =>
      expect([...select.querySelectorAll("option")].map((o) => o.textContent)).toEqual(["Compare with…", "Roman Martyrology 1914"]),
    );
    fireEvent.change(select, { target: { value: EN } });
    expect(push).toHaveBeenLastCalledWith(`/read/martyrologium_romanum_1749/10/02?with=${EN}`);
  });

  it("drops the pairing when book A is switched to book B", async () => {
    renderPair();
    await screen.findAllByText("Romae passio sancti Modesti Sardi.");
    fireEvent.change(screen.getByLabelText("Switch book"), { target: { value: EN } });
    expect(push).toHaveBeenLastCalledWith(`/read/${EN}/10/02`);
  });

  it("turns the two sheets as one", async () => {
    const first = renderPair();
    await screen.findAllByText("Romae passio sancti Modesti Sardi.");
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    first.unmount();
    const { container } = renderPair(10, 3);
    await screen.findAllByText("Romae passio sancti Modesti Sardi.");
    expect(container.querySelectorAll(`.${styles.turnNext}`)).toHaveLength(1);
  });
});
```

The option labels in the Compare-with test come from the existing `books` list in `Reader`; with the test's editions the open books are 1749 and the 1914 English, so the only other one is "Roman Martyrology 1914". If the labels differ, print them and match exactly.

- [ ] **Step 6: Run them to see them fail**

Run: `npx vitest run components/__tests__/Reader.test.tsx`
Expected: FAIL — `withEdition` is ignored (a single text, pushes without `?with=`, no "Compare with" select).

- [ ] **Step 7: Implement the bar**

In `components/ReaderBar.tsx`, add the props to the destructuring and the type:

```tsx
  compareWith,
  compareBooks,
  onCompare,
  onSwap,
}: {
  …existing props…
  compareWith: string | null;
  compareBooks: { id: string; label: string }[];
  onCompare: (id: string | null, focusId: string) => void;
  onSwap: () => void;
}) {
```

and insert after the book `<select id="reader-book" …>…</select>`:

```tsx
      <label className="sr-only" htmlFor="reader-with">Compare with</label>
      <select
        id="reader-with"
        className={control}
        value={compareWith ?? ""}
        onChange={(e) => onCompare(e.target.value || null, "reader-with")}
      >
        <option value="">Compare with…</option>
        {compareBooks.map((b) => (
          <option key={b.id} value={b.id}>{b.label}</option>
        ))}
      </select>
      {compareWith && (
        <>
          <button type="button" id="reader-swap" className={control} aria-label="Swap the two editions" onClick={onSwap}>⇄</button>
          <button type="button" id="reader-close" className={control} aria-label="Close the second edition" onClick={() => onCompare(null, "reader-with")}>×</button>
        </>
      )}
```

(The spec's "— none —" option is the empty option, labelled "Compare with…" so the closed select says what it is for; × also closes.)

- [ ] **Step 8: Implement the reader**

In `components/Reader.tsx`:

1. Import `Spread`:

```tsx
import Spread from "@/components/Spread";
```

2. Change the signature:

```tsx
export default function Reader({
  edition, mm, dd, signedIn, withEdition = null,
}: { edition: string; mm: number; dd: number; signedIn: boolean; withEdition?: string | null }) {
```

3. Add a navigation helper after `const navigated = useRef(false);` and route every push through it. Replace the existing `go` with:

```tsx
  // Every navigation goes through here: one push per remount, focus and turn handed to the next page.
  const navigate = useCallback(
    (path: string, direction: Turn = null, focusId: string | null = null) => {
      if (navigated.current) return;
      navigated.current = true;
      pendingTurn = direction;
      pendingFocus = focusId;
      router.push(path);
    },
    [router],
  );

  const go = useCallback(
    (d: Day, direction: Turn = null, focusId: string | null = null) => {
      if (d.mm === mm && d.dd === dd) return; // same URL: Next would not remount, leaving the guard stuck
      navigate(dayPath(edition, d, withEdition), direction, focusId);
    },
    [navigate, edition, withEdition, mm, dd],
  );
```

4. After the `books` memo, add the compare options:

```tsx
  const compareBooks = useMemo(() => {
    const others = books.filter((b) => b.id !== edition);
    if (!withEdition || others.some((b) => b.id === withEdition)) return others;
    // The second book is locked or not listed yet: keep it selectable so the select shows it.
    const meta = editions.find((e) => e.edition_id === withEdition);
    return [...others, { id: withEdition, label: meta ? `${titleCase(editionTitle(meta))} ${meta.year}` : withEdition }];
  }, [books, edition, withEdition, editions]);
```

5. Replace the `<ReaderBar …/>` element with:

```tsx
      <ReaderBar
        edition={edition}
        day={day}
        books={books}
        onGo={(d, focusId) => go(d, null, focusId)}
        onSwitch={(id, focusId) => {
          if (id === edition) return;
          navigate(dayPath(id, day, id === withEdition ? null : withEdition), null, focusId);
        }}
        compareWith={withEdition}
        compareBooks={compareBooks}
        onCompare={(id, focusId) => {
          if (id === withEdition) return;
          navigate(dayPath(edition, day, id), null, focusId);
        }}
        onSwap={() => {
          if (withEdition) navigate(dayPath(withEdition, day, edition), null, "reader-swap");
        }}
      />
```

6. Replace the `<div className="flex-1">…</div>` that holds `DayView` with:

```tsx
        <div className="flex-1">
          {withEdition ? (
            <div className={turn === "next" ? styles.turnNext : turn === "prev" ? styles.turnPrev : undefined}>
              {/* key resets both sheets' loading state for each pairing/day */}
              <Spread
                key={`${edition}+${withEdition}/${mm}/${dd}`}
                a={edition}
                b={withEdition}
                editions={editions}
                mm={mm}
                dd={dd}
                signedIn={signedIn}
              />
            </div>
          ) : (
            /* key resets DayView's loading state for each day/edition */
            <DayView
              key={`${edition}/${mm}/${dd}`}
              edition={edition}
              mm={mm}
              dd={dd}
              lang={lang}
              title={title}
              signedIn={signedIn}
              turn={turn}
            />
          )}
        </div>
```

- [ ] **Step 9: Run the reader tests to see them pass**

Run: `npx vitest run components/__tests__/Reader.test.tsx`
Expected: PASS (old and new tests).

- [ ] **Step 10: Run all checks**

Run: `npx vitest run && npx tsc --noEmit -p . && npx eslint app components lib scripts`
Expected: all pass.

- [ ] **Step 11: Commit**

```bash
git add components/Reader.tsx components/ReaderBar.tsx "app/read/[edition]/[mm]/[dd]/page.tsx" components/__tests__/Reader.test.tsx components/__tests__/ReadRoutes.test.tsx
git commit -m "feat: read two editions side by side, turning together (?with=)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nk2QD1sRjGjeCFwt5jmXTA"
```

---

### Task 6: The curator Compare page becomes curator-only

**Files:**
- Move: `app/compare/page.tsx` → `components/ComparePage.tsx` (content unchanged)
- Create: `app/compare/page.tsx` (the gate)
- Modify: `components/SiteHeader.tsx`
- Test: `components/__tests__/SiteHeader.test.tsx`, `components/__tests__/CompareGate.test.tsx` (new)

**Interfaces:**
- Consumes: `getViewer(): Promise<{ signedIn: boolean; curator: boolean }>` from `lib/viewer.ts`.
- Produces: `app/compare/page.tsx` default export `CompareRoute(): Promise<JSX.Element>` (throws `notFound()` for non-curators).

- [ ] **Step 1: Write the failing tests**

In `components/__tests__/SiteHeader.test.tsx`, replace the first test with:

```tsx
  it("links home, and hides Compare and Review from non-curators", async () => {
    viewerMock.mockResolvedValue({ signedIn: true, curator: false });
    render(await SiteHeader());
    expect(screen.getByRole("link", { name: "Martyrology" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: "Compare" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Review" })).not.toBeInTheDocument();
  });
```

and in the curator test add:

```tsx
    expect(screen.getByRole("link", { name: "Compare" })).toHaveAttribute("href", "/compare");
```

Create `components/__tests__/CompareGate.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";

const { viewerMock } = vi.hoisted(() => ({ viewerMock: vi.fn() }));
vi.mock("@/lib/viewer", () => ({ getViewer: viewerMock }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/components/ComparePage", () => ({ default: () => <p>compare ui</p> }));

import CompareRoute from "@/app/compare/page";

describe("/compare gate", () => {
  beforeEach(() => {
    viewerMock.mockReset();
  });

  it("is a 404 when signed out", async () => {
    viewerMock.mockResolvedValue({ signedIn: false, curator: false });
    await expect(CompareRoute()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("is a 404 for a signed-in reader without a curation role", async () => {
    viewerMock.mockResolvedValue({ signedIn: true, curator: false });
    await expect(CompareRoute()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders the compare UI for a curator", async () => {
    viewerMock.mockResolvedValue({ signedIn: true, curator: true });
    expect(await CompareRoute()).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run components/__tests__/SiteHeader.test.tsx components/__tests__/CompareGate.test.tsx`
Expected: FAIL — Compare is shown to non-curators; `@/components/ComparePage` does not exist.

- [ ] **Step 3: Move the page and add the gate**

```bash
git mv app/compare/page.tsx components/ComparePage.tsx
```

Create `app/compare/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import ComparePage from "@/components/ComparePage";

// The catalog diff is a curation tool: curators only (admin or martyrology_editor).
// Readers compare editions side by side in the reader (?with=).
export default async function CompareRoute() {
  const viewer = await getViewer();
  if (!viewer.curator) notFound();
  return <ComparePage />;
}
```

In `components/SiteHeader.tsx`, replace

```tsx
          <Link href="/compare">Compare</Link>
          {viewer.curator && <Link href="/review">Review</Link>}
```

with

```tsx
          {viewer.curator && <Link href="/compare">Compare</Link>}
          {viewer.curator && <Link href="/review">Review</Link>}
```

Then look for other links to `/compare`: `grep -rn '"/compare"' app components lib`. If any remain outside `SiteHeader`, show them only to curators the same way, or tell the reviewer.

- [ ] **Step 4: Run all checks**

Run: `npx vitest run && npx tsc --noEmit -p . && npx eslint app components lib scripts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add app/compare/page.tsx components/ComparePage.tsx components/SiteHeader.tsx components/__tests__/SiteHeader.test.tsx components/__tests__/CompareGate.test.tsx
git commit -m "feat: make the catalog Compare page curator-only

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Nk2QD1sRjGjeCFwt5jmXTA"
```

---

### Task 7: Check it in the browser, then open the PR

**Files:** none changed unless the check finds a defect (fix it test-first in the owning task's files, then re-run this task).

- [ ] **Step 1: Start the dev server against the local API**

The local Docker API listens on `http://localhost:8000`. Run, in the background:

```bash
API_BASE=http://localhost:8000 npx next dev -p 3001
```

and wait until `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/` prints `200`.

- [ ] **Step 2: Look at three pairings at desktop width (about 1400px)**

Using the browser tools, open each and screenshot:
- `http://localhost:3001/read/martyrologium_romanum_2004/10/04?with=martyrologium_romanum_2004_it_IT` — expect two cream sheets with a gutter, every eulogy level with its counterpart, and the [*sic!* …] note on entry 8\* on both sheets. (The 2004 editions need a signed-in account with access; if locked, the sheets show the locked notice, which is also correct.)
- `http://localhost:3001/read/martyrologium_romanum_2004/10/04?with=martyrologium_romanum_1749` — expect many gap notes; at least one "[1749: … →]" link that opens that day still paired.
- `http://localhost:3001/read/martyrologium_romanum_1749/10/04?with=martyrologium_romanum_1914_en_unofficial` — expect the unaligned notice and two independent pages.

Turn the day with →, the strips and the day select: the URL keeps `?with=` and both sheets change together.

- [ ] **Step 3: Look at phone width (about 390px)**

Resize to 390px wide and reload the 2004 | 1749 pairing: one sheet; each eulogy followed by its counterpart, indented under a thin rule, with the small edition tag; no horizontal scroll.

- [ ] **Step 4: Stop the dev server**

Stop the `next dev` process on port 3001 (`kill $(lsof -t -i :3001 -sTCP:LISTEN)`).

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin HEAD
gh pr create --title "feat: parallel reader — two editions side by side, in lockstep" --body "$(cat <<'EOF'
Implements docs/superpowers/specs/2026-10-02-parallel-reader-design.md.

- `/read/{A}/{mm}/{dd}?with={B}` sets a day of two editions as two facing sheets with an empty gutter. Each eulogy sits level with its counterpart, and every way of turning the day keeps the pairing.
- One-sided eulogies get a grey editorial note on the empty side: *not in 1749*, *1749: 5 October, n. 3 →* (a link to that day, still paired), or *n. 7, below*. The other days come from `/elogium/{id}`, cached for the session.
- With an unaligned edition (the 1914 English), or a locked or missing side, the view falls back to two independent pages that still turn together.
- The reader bar gains a Compare-with select plus ⇄ (swap) and × (close). An invalid `?with=` redirects to the single reader.
- The catalog Compare page and its header link are now curator-only.
- `Eulogy`, `DayStatus` and `useDay` are extracted from the reader, so the single page and the spread share them.

Checked in the browser at desktop and phone widths: 2004 Latin | CEI, 2004 | 1749, and 1749 | 1914 English.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Nk2QD1sRjGjeCFwt5jmXTA
EOF
)"
```
