# Subject identity: places as evidence — Implementation Plan (frontend cards)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show place agreement and the other evidence as translated chips on person cards, add the subject rename card (`relabel`), and keep a month's persons bundle off `/review` once its subjects file is up.

**Architecture:** `lib/changeset.ts` learns the `relabel` op and the candidates' `places`; `components/PersonCard.tsx` renders evidence chips; a new `components/RelabelCard.tsx` mirrors `RenameCard.tsx` (Jev's suggestion, take it, accept, edit, keep current); `lib/subject-review.ts` groups a eulogy's rename, relabel and persons in that order; `scripts/import-changeset.mjs` gains `--except-months`.

**Tech Stack:** Next.js 16, React, TypeScript, next-intl (six languages: de, en, es, fr, it, pt), Vitest.

**Spec:** `../crmedr/docs/superpowers/specs/2026-10-25-subject-identity-places-design.md`. The crmedr half: `../crmedr/docs/superpowers/plans/2026-10-25-subject-identity-places.md` (Tasks 3 and 7 define the data this plan reads).

## Global Constraints

- Every user-visible string goes through `messages/*.json`, in all six files.
- Data shapes (from crmedr Task 3): candidate `places?: {role: string; qid: string; label: string; via: "P19" | "P20" | "P119" | "P937"}[]`, `place_labels?`; op `places?: {role, label, qid}[]`; evidence strings `human | status | name | death | place`; source `place`.
- `relabel` op (crmedr Task 7): `{op: "relabel", id, uid, current: Labels, labels: Labels, candidates: {labels: Labels; from_id: string | null}[], jev?, prefilled?, decision, edited?: {labels: Labels}}`, `Labels = {la, en, it}` (strings or null).
- Older change-sets without these fields must still parse and render (all new fields optional).
- `npx vitest run`, `npx tsc --noEmit`, `npm run lint` clean before each commit (currently 1,107 tests).

## Review Focus

1. A January file decided before `relabel` existed has renames and no relabel ops: the grouped card must render as now (Task F3 test `renders a eulogy with no relabel op`).
2. An evidence string the frontend does not know (a future one) must still show, as the raw string (Task F2 test `unknown evidence shown raw`).
3. Taking Jev's relabel suggestion when Jev's pick is the current labels must record "keep", not an edit identical to the current (Task F3 test `jev picks the current labels`).
4. `--except-months` with a month that has no bundle, or a malformed list (`2,13`): the former is ignored, the latter refused before anything is written (Task F1 tests).
5. A persons decision stored in `localStorage` under a month whose bundle has been removed must not crash `/review` (Task F1 test `missing bundle with stored decisions`).

---

### Task F1: Keep a month's persons bundle off `/review`

**Files:**
- Modify: `scripts/import-changeset.mjs` (`main`, `writeBundle`)
- Test: `lib/__tests__/changeset.test.ts`

**Interfaces:**
- Produces: `writeBundle(cs, name, { byMonth, dir, isPublic, exceptMonths = [] })`: month parts in `exceptMonths` (two-digit strings) are not written, and an earlier copy of them is removed; CLI `--except-months 01,02`.

- [ ] **Step 1: Write the failing tests:** `skips the excepted months` (months 01 and 02 of a two-month change-set, except `01` → only `x-02.json`, and an old `x-01.json` removed); `refuses a malformed month list` (`13` → throws, nothing written); `ignores a month with no operations`; `missing bundle with stored decisions` (the ReviewPage test with a stored decision for a name absent from the index renders the picker).
- [ ] **Step 2: Run** `npx vitest run lib/__tests__/changeset.test.ts components/__tests__/ReviewPage.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement.** Update the README's persons bundle command to show `--except-months`.
- [ ] **Step 4: Run** the full checks — Expected: all pass.
- [ ] **Step 5: Commit** `import-changeset: --except-months keeps a month's persons bundle off /review`.

### Task F2: Evidence chips, place agreement included

**Files:**
- Modify: `lib/changeset.ts` (`PersonCandidate` gains `places?`, `place_labels?`; the op gains `places?`), `components/PersonCard.tsx` (l.~130, the evidence line), `messages/*.json` (namespace `PersonCard`)
- Test: `components/__tests__/PersonCard.test.tsx`

**Interfaces:**
- Produces: message keys `PersonCard.evidence.{human,status,name,death,place}`, `PersonCard.agrees.{P19,P20,P119,P937}` with `{place}` ("born in {place}", "died in {place}", "buried in {place}", "worked in {place}"), `PersonCard.source.place`.

- [ ] **Step 1: Write the failing tests:** `shows evidence as chips` (each known string as a labelled chip); `shows the place agreement` (a candidate with `places: [{via: "P20", label: "Bologna", …}]` shows "died in Bologna"); `unknown evidence shown raw`; `place source badge`.
- [ ] **Step 2: Run** `npx vitest run components/__tests__/PersonCard.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement**, with the six translations.
- [ ] **Step 4: Run** the full checks — Expected: all pass.
- [ ] **Step 5: Commit** `person cards: evidence chips, with the place agreement`.

### Task F3: The subject rename card

**Files:**
- Modify: `lib/changeset.ts` (the `relabel` op type, parser, `isOperation`, export), `lib/subject-review.ts` (`groupByEulogy`: rename, relabel, then persons), `components/OperationCard.tsx` (route `relabel`)
- Create: `components/RelabelCard.tsx`
- Modify: `messages/*.json` (namespace `RelabelCard`)
- Test: `lib/__tests__/changeset.test.ts`, `lib/__tests__/subject-review.test.ts`, `components/__tests__/RelabelCard.test.tsx`

**Interfaces:**
- Consumes: the `relabel` shape (Global Constraints); `RenameCard.tsx`'s Jev line and "Take the suggestion" pattern.
- Produces: decisions `accept` (the proposed `labels`), `edit` with `edited.labels` (three fields), `reject` ("keep the current subjects"); "Take the suggestion" records Jev's pick as `accept` when it is `labels`, `reject` when it is the current, else `edit`.

- [ ] **Step 1: Write the failing tests:** `parses a relabel op` (and an old change-set without one); `groups rename, relabel, persons`; `renders a eulogy with no relabel op`; RelabelCard: `shows current and candidates`, `accept`, `edit three fields`, `keep current`, `take jev's suggestion`, `jev picks the current labels` (→ reject/keep).
- [ ] **Step 2: Run** the three test files — Expected: FAIL.
- [ ] **Step 3: Implement**, with the six translations.
- [ ] **Step 4: Run** the full checks — Expected: all pass.
- [ ] **Step 5: Commit** `review: the subject rename card (relabel)`.
