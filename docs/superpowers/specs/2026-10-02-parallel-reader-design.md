# Parallel reader: two editions side by side — design

**Status:** approved in brainstorming 2026-10-02; spec under review.
**Repos:** `martyrology-frontend` only. No API change.
**Sub-project 3 of 4** of the redesign begun in
[2026-10-02-reader-and-landing-design.md](2026-10-02-reader-and-landing-design.md):
the two-books comparison view.

## Goal

Let a reader open a day in two editions at once — Latin beside a translation,
or an old edition beside the current one — set as two sheets of paper lying
side by side, with each eulogy level with its counterpart, and turning together
from day to day. The same view serves both purposes: reading a parallel text,
and seeing how a day changed between editions (eulogies added, dropped, or
printed on another day).

## Decisions taken

| Question | Decision |
|---|---|
| Who it is for | Both readers (parallel text) and scholars (historical comparison), in **one view**. |
| Where it lives | A **mode of the reader**: `/read/{A}/{mm}/{dd}?with={B}`, entered from a "Compare with…" control in the reader bar. |
| The curator Compare page | **Stays** as it is (catalog diff), but becomes **curator-only**, like Review. |
| Alignment | **Row-aligned**: one row per canonical ID, A's eulogy left, B's right. |
| Look | **Two facing sheets**: each column is its own continuous cream sheet with its own shadow, and an empty gutter between them. |
| Lockstep | Every way of changing the day keeps `?with=`; both sheets always show the same day and turn as one. |
| "Printed on another day" lookup | Per eulogy via `GET /elogium/{id}`, cached; not the 1 MB catalog, and no new API endpoint. |

## Current facts this design rests on

- `GET /api/v1/elogia/edition/{edition}/{mm}/{dd}` returns a day's `titulus`,
  `elogia` (in printed order; each with `id`, `entry`, `asterisk`,
  `unnumbered`, `text`) and `conclusio`. For a locked edition the `text` of
  each eulogy is null and `metadata.access` is `restricted-texts`.
- `GET /api/v1/editions` gives each edition's `aligned` flag: `true` when its
  eulogies are keyed by canonical ID, `false` when not yet (none today; the
  1914 English translation was, before its alignment), `null` when no texts are attached.
- `GET /api/v1/elogium/{id}` returns one eulogy with its placement
  (`day_printed`, `entry`, `unnumbered`) in every edition that prints it.
- `GET /api/v1/elogia?edition=…` (the catalog) is about 1 MB per edition, too
  heavy to fetch on every page view.
- The reader (`components/Reader.tsx`) already turns days with side strips,
  ←/→ keys, swipe, month and day selects and a Today button, and switches
  books with a select in `ReaderBar`. `DayPage` typesets one day; misprint
  notes come from `EulogyText`.

## The page

### Two sheets, rows in step

The day is a three-column grid: **sheet A | gutter | sheet B**.

- Each eulogy pair occupies one grid row, so a eulogy and its counterpart
  always start at the same height.
- The sheets are two decorative layers behind the grid, each spanning every
  row of its column, with the reader's cream paper, padding and shadow. The
  rows therefore do not read as table cells: the eye sees two printed sheets.
- The gutter (about 2.5rem) is empty space, not paper.
- Typography is the reader's: Georgia, red rubrics for numbers and asterisks,
  misprint notes as `[sic! expected: …]` (each sheet with its own edition).
- **Top row:** each sheet's titulus (or the computed date heading in its
  language), with the edition beneath in small caps, e.g. *Martyrologium
  Romanum 2004 · Latin*.
- **Bottom row:** each sheet's conclusio, with R. as a rubric.
- On the paired page the content width grows from `max-w-5xl` to `max-w-7xl`;
  the single reader is unchanged.

### Gaps

When a row has a eulogy on one side only, the other side is blank paper except
for a grey editorial note, set like the misprint notes (upright, keyword in
italics, `#5c4f45` at 0.8em):

| Situation | Note on the empty side |
|---|---|
| The other edition does not print this eulogy | [*not in 1749*] |
| It prints it on another day | [*1749: 5 October, n. 3* →] — a link to that day in the same pairing |
| It prints it on this day, out of order (see Alignment) | [*1749: n. 7, below*] or [*… above*] |
| The other placement is unnumbered | the same, without "n." |
| The eulogy has no canonical ID | no note |
| Placements still loading | [*not on this day in 1749*], replaced when they arrive |

The edition in a note is named by its year when that is unambiguous on the
page, else by year and language (*2004 Italian*).

### Phones

Below the `sm` breakpoint the grid has one column and a single sheet. The DOM
order is A cell, B cell for each row, so the pairs stack with no second
layout: A's eulogy, then B's indented under a thin rule with a small edition
tag (*1749*). A gap shows as the tag line with its note
(*1749: not in this edition*).

### When rows cannot be built

If either edition has `aligned: false`, or either side is locked, has no text
for the day, or failed to load, the two sheets are filled **independently**:
the same grid holds one cell per side containing a whole `DayPage` (or that
side's notice), still with the gutter, still turning together.

- An unaligned edition adds one line under the reader bar, e.g. "The 1914
  English edition is not yet aligned, so its eulogies are not matched."
  Rows are built only once both editions' metadata is known and neither is
  unaligned; until the editions list loads (or if it fails) the two
  independent pages are shown.
- A locked side shows the existing `LockedNotice` (with sign-in); the other
  side reads normally.
- No text for the day, or an error with Retry, are shown per side as in the
  single reader.

## Navigation and lockstep

### URL

`/read/{A}/{mm}/{dd}?with={B}`. Shareable and bookmarkable; Back and Forward
work. If `with` is not a known edition, or equals A, the page renders the
single reader and drops the parameter with `router.replace`.

The document title is *4 October — Martyrologium Romanum 2004 | Martyrologium
Romanum 1749*.

### Reader bar

- Beside the book switcher, a second select, **Compare with…**: "— none —"
  plus every edition the viewer can open (`shelfState` "open"), except A.
  Choosing one adds `?with=`; "— none —" removes it. (As built, the empty
  option is labelled "Compare with…".)
- In paired mode two small buttons follow: **⇄** swaps the sheets
  (`/read/{B}/…?with={A}`) and **×** closes the second sheet.
- Switching book A keeps B, unless the new A is B, in which case the pairing
  is dropped.

### Lockstep

Every way of changing the day carries `with`: the side strips, ←/→, swipe,
the month and day selects, Today, and the links in gap notes. The page-turn
animation runs once, on the whole spread, so the two sheets turn as one.

## Data and alignment

### Fetching

- Both days are fetched in parallel from the day endpoint; each side has its
  own state (loading, ready, locked, no text, error). Rows are built once both
  sides are ready.
- The editions list (already fetched and cached by the reader) gives each
  side's `aligned` flag.
- For the eulogies that end up one-sided, `/elogium/{id}` is fetched in
  parallel and cached per ID for the session; one response answers for both
  sides, since it holds every edition's placement.

### Building rows (`lib/parallel.ts`)

Input: the two days' eulogies in printed order.

1. Let `shared` be the IDs present on this day in both editions.
2. Take the **longest common subsequence** of A's and B's orders of `shared`.
   Those pairs share a row. This keeps both sheets in their own printed order.
3. Every other eulogy gets a row of its own:
   - A-only eulogies (and shared ones outside the subsequence, on A's side)
     sit in A's order;
   - B-only eulogies (and shared ones outside the subsequence, on B's side)
     are inserted after the row that holds B's previous eulogy (at the top if
     there is none).
4. The titulus row comes first and the conclusio row last.

Each one-sided row carries, for its empty side, a gap note computed by
`gapNote` from that eulogy's placements:

- no placement in the other edition → *not in*;
- a placement on another day → *other day* (with day and entry);
- a placement on this day (only possible outside the subsequence) → *above*
  or *below*, by comparing printed positions;
- unknown yet → *not on this day*;
- no canonical ID → none.

## Components and files

**New**

- `lib/parallel.ts` — `buildRows`, `lcs`, `gapNote`. Pure, no React.
- `lib/use-day.ts` — the day-loading state machine (loading, ready, locked, no
  text, error, retry), extracted from `Reader`'s `DayView` so the single
  reader and each sheet share it; `DayView` keeps its behaviour.
- `lib/use-placements.ts` — fetches `/elogium/{id}` for a list of IDs, with a
  module-level cache.
- `components/Eulogy.tsx` — one eulogy: number and asterisk as rubrics, text
  through `EulogyText`. Extracted from `DayPage` so the page and the spread
  typeset eulogies identically.
- `components/Spread.tsx` — the two-sheet grid: aligned rows, gap notes, the
  independent fallback, and the phone layout.

**Changed**

- `lib/calendar.ts` — `dayPath(edition, day, withEdition?)` appends
  `?with=`.
- `app/read/[edition]/[mm]/[dd]/page.tsx` — reads and validates
  `searchParams.with` (with `editionExists`), passes it on, sets the paired
  title.
- `components/Reader.tsx` — takes `withEdition`; when paired renders `Spread`
  instead of `DayView`, widens, and passes `with` to every navigation.
- `components/ReaderBar.tsx` — the Compare-with select and the ⇄ and ×
  buttons.
- `components/DayPage.tsx` — uses `Eulogy`.
- `components/SiteHeader.tsx` — "Compare" only for curators, beside Review.
- `app/compare/page.tsx` — becomes a server gate (`notFound()` unless
  `viewer.curator`), like `app/review/page.tsx`; today's client page moves
  to `components/ComparePage.tsx` unchanged.

## Testing

Test-first, with Vitest and Testing Library, as in the rest of the repo.

- `lib/__tests__/parallel.test.ts`
  - identical days pair every row;
  - a B-only eulogy lands after B's previous eulogy, and at the top when it
    is B's first;
  - a reordered pair falls outside the subsequence and both sides get
    *above/below* notes;
  - *not in*, *other day* (with day and entry), *not on this day* (no
    placements yet), an unnumbered placement without "n.", a null ID without
    a note;
  - titulus and conclusio rows.
- `lib/__tests__/calendar.test.ts` — `dayPath` with and without `with`.
- `components/__tests__/Spread.test.tsx` — paired eulogies share a row; gap
  notes render, and the other-day note links to that day with `?with=`; the
  independent fallback with its unaligned note; a locked side shows the
  locked notice while the other reads.
- `components/__tests__/Reader.test.tsx` (there is no separate
  `ReaderBar.test.tsx`; the bar's cases live here) —
  choosing, swapping and closing a comparison; every navigation keeps
  `?with=`; an invalid `with` is dropped (by a server `redirect()` to the plain path,
  covered in `ReadRoutes.test.tsx`); the paired turn animation runs
  once.
- `components/__tests__/ReadRoutes.test.tsx` — the `with` parameter and the
  paired title.
- `components/__tests__/SiteHeader.test.tsx` — Compare hidden from
  non-curators; a gate test for `/compare` like the Review gate.
- In the browser, at desktop and phone widths: 2004 Latin | 2004 CEI (nearly
  all rows paired), 1749 | 2004 (many gaps and other-day notes), and the
  independent fallback (unaligned editions: none today, so check it with the
  editions list blocked or failing).

## Out of scope

- Remembering the last pairing between visits.
- Three or more editions at once.
- A batch placements endpoint in the API.
- Any change to the curator Compare diff, beyond hiding it from
  non-curators.
