# Subject identity review cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the curator review crmedr's monthly subject-identity change-set: rename cards with ranked candidates (category, labels, Jev's clarity score), Jev's suggestion with "Take the suggestion" on rename and person cards, expanded person candidates with their source, and a eulogy's cards shown together.

**Architecture:** Types and pure helpers in `lib/subject-review.ts` (tested without React); a new `components/RenameCard.tsx` for rename ops that carry `candidates` (others keep `IdOperationCard`); `PersonCard` gains source badges, title items and the Jev block; `ReviewPage` groups ops by eulogy when the change-set holds rename candidates. Decisions keep today's shapes, so `exportChangeset`, `lib/decisions.ts` and crmedr's `build_person_items.py apply` are unchanged.

**Tech Stack:** Next.js 16 (client components only here), React, TypeScript, next-intl (six message files), Vitest + Testing Library (`@/test/intl`).

**Input file:** crmedr writes one monthly file holding both the rename ops and that month's person ops (`crmedr-subjects-MM.json`, uploaded by hand to `CHANGESETS_DIR`), so a eulogy's cards can be shown together; person op ids are unchanged, so decisions already saved in the browser for `person_items_review.json` carry over through `loadDecisionsFor` (same edition prefix, matched by op id).

**Spec:** crmedr `docs/superpowers/specs/2026-10-18-subject-identity-design.md` (sections "4. Cards and decisions", "Components"), on crmedr PR #147.

## Global Constraints

- The change-set shape is crmedr's (PR #147), read as is:
  - rename op: `{op:"rename", id, new_id, uid:"subject:<id>", class, confidence, candidates:[RenameCandidate], reasoning, subject_la, decision, jev?}`.
  - `RenameCandidate`: `{new_id, category, weak, certain?, labels:{la, en, it} (en/it may be null), basis, draft_class?}`; `basis === "bare-name draft"` marks the earlier draft.
  - categories (exact): `surname`, `place-genitive`, `place-adjective`, `role`, `role-place`, `epithet`, `twin`, `papa`, `biblical-title`.
  - rename `jev`: `{decision:"accept"|"edit", new_id? (edit), probability, confidence, model, flags:string[], scores:{[new_id]: number 0..3}}` or, when Jev doubts the record, `{flags, model, scores}` with no `decision`.
  - person `jev`: `{decision:"accept"|"edit"|"reject", wikidata? (accept/edit), source? , reason? (reject), kind?, probability, confidence, model, flags?}`.
  - person candidate `source`: `search` | `companion:P3373` (and other `companion:Pnnn`) | `sparql` | `title` | `curated`.
- `jev` is never a decision by itself: only a click records one. `op.suggested` keeps its current meaning on person cards (the default selection); `jev` is separate.
- Decision shapes stay as today: rename accept `{decision:"accept"}` (= `op.new_id`); choosing another candidate `{decision:"edit", edited:{new_id, subject_la: candidate.labels.la}}`; person accept/edit/reject as PersonCard does now.
- A person card's accept means `op.suggested?.wikidata ?? op.candidates[0].wikidata` (crmedr `_resolve`). A Jev accept equals that item by construction.
- A listed person candidate is appliable when its `source` is `title` or `curated`, or its evidence has `human` and `status` (crmedr `_appliable`).
- All new UI strings in `messages/en.json` under `Review.rename.*` / `Review.person.*`, then `npm run sync-messages`, then real translations in it, fr, de, es, pt (no new allowlist entries unless a word is the same in that language, e.g. "ID").
- Change-sets quoting the 2004 texts never enter the repository (fixtures are invented).

## Review Focus

- A rename op without `candidates` (older change-sets, delete/merge): must still render with `IdOperationCard`, unchanged. → Task 2.
- A Jev rename suggestion whose `new_id` is not among `candidates` (stale file): no take button. → Task 1.
- A Jev person suggestion naming a QID not on the card, or a non-appliable candidate: no take button. → Task 1.
- A candidate with `labels.en`/`labels.it` null: shown as "—", never "null". → Task 2.
- Grouping must not reorder or hide cards in a change-set without rename candidates (mentions, places). → Task 4.

---

### Task 1: Types and helpers

**Files:**
- Modify: `lib/changeset.ts` (RenameOp, ResolvePersonOp, PersonCandidate)
- Create: `lib/subject-review.ts`
- Test: `lib/__tests__/subject-review.test.ts`

**Interfaces:**
- Produces (in `lib/changeset.ts`): `RenameCategory` (union of the nine strings), `RenameCandidate`, `RenameJev`, `PersonJev`; `RenameOp.candidates?: RenameCandidate[]`, `RenameOp.jev?: RenameJev | null`; `ResolvePersonOp.jev?: PersonJev | null`; `PersonCandidate.source?: string`.
- Produces (in `lib/subject-review.ts`):
  - `renameChoiceRecord(op: RenameOp, newId: string): DecisionRecord` — accept when `newId === op.new_id`, else edit `{new_id, subject_la}` (the candidate's `labels.la`, or `op.subject_la` for an id not among candidates).
  - `renameJevRecord(op: RenameOp): DecisionRecord | null` — null without `jev.decision`, or when an edit's `new_id` is not a candidate.
  - `personDefaultQid(op: ResolvePersonOp): string`.
  - `personAppliable(c: PersonCandidate): boolean`.
  - `personJevRecord(op: ResolvePersonOp): DecisionRecord | null` — accept → `{decision:"accept"}` only if `jev.wikidata === personDefaultQid(op)`; edit → `{decision:"edit", edited:{wikidata}}`; reject → `{decision:"reject", edited:{reason: jev.reason}}`; null when the QID is not a listed appliable candidate (accept/edit) or `reason` is empty (reject).
  - `sourceKey(source?: string): "search" | "companion" | "sparql" | "title" | "curated"` and `companionProp(source): string | null` ("P3373").
  - `opEulogy(op: Op): string | null` — rename → `op.id`; resolve_person → `op.eulogy`; else null.
  - `groupByEulogy(ops: Op[]): { eulogy: string | null; ops: Op[] }[]` — consecutive groups in first-appearance order of each eulogy; within a group the rename op first, then the rest in file order; ops with no eulogy stay single groups in place.

- [ ] **Step 1: Write the failing tests** (`lib/__tests__/subject-review.test.ts`), with an invented rename op (EUGENDUS: candidates `-abbas-condatiscensis` role-place, `-condatiscensis` place-adjective, `-condatisci` place-genitive draft) and a person op (candidates Q1 search human+status, Q2 `companion:P3373` human+status, Q3 `title` non-human):

```ts
expect(renameChoiceRecord(OP, OP.new_id)).toEqual({ decision: "accept" });
expect(renameChoiceRecord(OP, "mr:0101-eugendus-condatiscensis")).toEqual(
  { decision: "edit", edited: { new_id: "mr:0101-eugendus-condatiscensis", subject_la: "Sanctus Eugendus Condatiscensis" } });
expect(renameJevRecord({ ...OP, jev: { decision: "edit", new_id: "mr:0101-x", probability: 0.9, confidence: 0.9, model: "jev", flags: [], scores: {} } })).toBeNull();
expect(renameJevRecord({ ...OP, jev: { flags: ["record:places[0]"], model: "jev", scores: {} } })).toBeNull();
expect(personJevRecord({ ...POP, jev: { decision: "accept", wikidata: "Q1", probability: 0.9, confidence: 0.9, model: "jev" } })).toEqual({ decision: "accept" });
expect(personJevRecord({ ...POP, jev: { decision: "edit", wikidata: "Q2", source: "companion:P3373", probability: 0.9, confidence: 0.9, model: "jev" } })).toEqual({ decision: "edit", edited: { wikidata: "Q2" } });
expect(personJevRecord({ ...POP, jev: { decision: "edit", wikidata: "Q9", probability: 0.9, confidence: 0.9, model: "jev" } })).toBeNull();
expect(personJevRecord({ ...POP, jev: { decision: "reject", reason: "Jev: none of the candidates is this person", probability: 0.9, confidence: 0.9, model: "jev" } }))
  .toEqual({ decision: "reject", edited: { reason: "Jev: none of the candidates is this person" } });
expect(personAppliable(POP.candidates[2])).toBe(true);   // title item
expect(companionProp("companion:P3373")).toBe("P3373");
expect(groupByEulogy([PERSON_A, RENAME_B, RENAME_A, PERSON_B2]).map(g => g.ops.map(opId)))
  .toEqual([[ "subject:mr:0101-a", "mr:0101-a|A" ], [ "subject:mr:0102-b", "mr:0102-b|B#2" ]]);  // opId: a rename's uid
```

- [ ] **Step 2:** `npx vitest run lib/__tests__/subject-review.test.ts` — FAIL (module missing).
- [ ] **Step 3:** Implement the types and helpers.
- [ ] **Step 4:** Run the test — PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** `git add lib/changeset.ts lib/subject-review.ts lib/__tests__/subject-review.test.ts && git commit -m "subject review: rename candidates, Jev suggestions and eulogy groups (crmedr#74)"`

### Task 2: RenameCard

**Files:**
- Create: `components/RenameCard.tsx`
- Modify: `components/OperationCard.tsx` (dispatch: `op.op === "rename" && op.candidates?.length` → RenameCard)
- Modify: `messages/en.json` (`Review.rename.*`)
- Test: `components/__tests__/RenameCard.test.tsx`

**Interfaces:**
- Consumes: Task 1 helpers and types.
- Produces: `RenameCard({op, decision, onDecide, locale, baseEdition}: {op: RenameOp; decision?: DecisionRecord; onDecide: (id: string, d: DecisionRecord) => void; locale: Locale; baseEdition: string})`.

Layout (top to bottom): header `rename · {op.id}` + decision badge (as IdOperationCard); the EulogyView toggle (same as IdOperationCard, same `alongside`); a radio list of candidates, each row: `new_id` (mono), a category chip (`t("category.<cat>")`), badges `t("weak")` when `weak`, `t("uncertain")` when `certain === false`, `t("draft")` when `basis === "bare-name draft"`, the Jev clarity score when `jev.scores[new_id]` exists (`t("clarity", {score: n.toFixed(1)})`, out of 3), then the three labels (`la · en · it`, a null shown as "—") and `basis` in small text; the Jev block (as MentionCard: `t("suggests", {what, confidence})`, `what` = `t("keep")` for accept or the candidate's new_id for an edit, confidence = round(probability×100)); flags as an amber list (`t("flag.record", {field})` for `record:…`, `t("flag.grammar", {field, choice})` for `grammar:…`); a flagged-only `jev` shows `t("doubts")` and no take button; buttons Accept selected (records `renameChoiceRecord(op, selected)`), Take the suggestion (disabled unless `renameJevRecord(op)`), Edit (free `new_id` + `subject_la` inputs, as IdOperationCard), Reject.
Initial selection: an edit decision's `edited.new_id` if it is a candidate, else `op.new_id`.

- [ ] **Step 1: Write the failing tests**: renders three candidates with chips "role and place", "place (adjective)", "place (genitive)" and the badge "earlier draft"; selecting the second and clicking "Accept selected" calls `onDecide("subject:mr:0101-eugendus", {decision:"edit", edited:{new_id:"mr:0101-eugendus-condatiscensis", subject_la:"Sanctus Eugendus Condatiscensis"}})`; with `jev` edit p=0.87 shows "Jev suggests: mr:0101-eugendus-condatiscensis (87%)" and the take button records the same edit; with `jev` accept shows "Jev suggests: keep the proposed ID (…%)"; a flagged jev shows "Jev doubts the record" + "record: places[0]" and no enabled take button; clarity "clarity 2.6/3" shown; null en label renders "—"; a rename op WITHOUT candidates renders the old card (assert `id → new_id` text) through `OperationCard`.
- [ ] **Step 2:** `npx vitest run components/__tests__/RenameCard.test.tsx` — FAIL.
- [ ] **Step 3:** Implement; add en strings: `Review.rename`: `category.{surname: "surname", place-genitive: "place (genitive)", place-adjective: "place (adjective)", role: "role", role-place: "role and place", epithet: "epithet", twin: "twin", papa: "pope", biblical-title: "biblical title"}`, `weak: "weak"`, `uncertain: "uncertain genitive"`, `draft: "earlier draft"`, `clarity: "clarity {score}/3"`, `suggests: "Jev suggests: {what} ({confidence}%)"`, `keep: "keep the proposed ID"`, `take: "Take the suggestion"`, `doubts: "Jev doubts the record"`, `flag.record: "record: {field}"`, `flag.grammar: "{field} reads as {choice}"`, `acceptSelected: "Accept selected"`, `labels: "labels"`; then `npm run sync-messages`.
- [ ] **Step 4:** Run the test — PASS; full `npm test` PASS (messages test may need Task 5's translations: if it fails only on the new keys, note it and continue — Task 5 fixes it).
- [ ] **Step 5: Commit** `"RenameCard: candidates with category, labels and Jev's suggestion (crmedr#74)"`

### Task 3: PersonCard — sources, title items, Jev

**Files:**
- Modify: `components/PersonCard.tsx`
- Modify: `messages/en.json` (`Review.person.*`)
- Test: `components/__tests__/PersonCard.test.tsx`

**Interfaces:**
- Consumes: `personAppliable`, `personDefaultQid`, `personJevRecord`, `sourceKey`, `companionProp` (Task 1).

Changes: `eligible` uses `personAppliable(listed)` instead of the evidence check; each candidate row shows a source badge when `source` is not `search` (`t("source.companion", {prop})`, `t("source.sparql")`, `t("source.title")`, `t("source.curated")`); the Jev block under the suggestion line: `t("jevSuggests", {what, confidence})` with `what` = the candidate's `wikidata label` for accept/edit or `t("jevNone")` for reject, a `t("jevKind", {kind})` note when `jev.kind` is not "person", and a "Take the suggestion" button (`Review.rename.take` reused is NOT allowed: add `Review.person.take`) calling `onDecide(id, personJevRecord(op))`, disabled when null. Taking an edit also moves the radio selection to that QID.

- [ ] **Step 1: Write the failing tests**: a `companion:P3373` candidate shows "found through a relative (P3373)"; a `title` non-human candidate can be selected and accepted (Accept enabled); with `jev` edit Q2 p=0.93 shows "Jev suggests: Q2 Jean Légo (93%)" and the button records `{decision:"edit", edited:{wikidata:"Q2"}}`; a `jev` reject records `{decision:"reject", edited:{reason}}`; a `jev` naming Q9 (not listed) → button disabled; no `jev` → no Jev line, no button; existing PersonCard tests still pass.
- [ ] **Step 2:** `npx vitest run components/__tests__/PersonCard.test.tsx` — FAIL.
- [ ] **Step 3:** Implement; en strings `Review.person`: `source.companion: "found through a relative ({prop})"`, `source.sparql: "died on this day"`, `source.title: "title or feast"`, `source.curated: "curated title"`, `jevSuggests: "Jev suggests: {what} ({confidence}%)"`, `jevNone: "no item"`, `jevKind: "Jev reads this name as: {kind}"`, `take: "Take the suggestion"`; `npm run sync-messages`.
- [ ] **Step 4:** Run — PASS; full `npm test` (same note on messages as Task 2).
- [ ] **Step 5: Commit** `"PersonCard: candidate sources, title items and Jev's suggestion (crmedr#74)"`

### Task 4: A eulogy's cards together

**Files:**
- Modify: `components/ReviewPage.tsx`
- Modify: `messages/en.json` (`Review.eulogyGroup`)
- Test: `components/__tests__/ReviewPage.test.tsx`

**Interfaces:**
- Consumes: `groupByEulogy`, `opEulogy` (Task 1).

When the loaded change-set has at least one rename op with `candidates`, the filtered ops are rendered through `groupByEulogy`: each group with a eulogy gets a heading `t("eulogyGroup", {eulogy})` (mono, small) and its cards inside one bordered container; paging (`PAGE_SIZE`) counts cards as now (a group may be cut by "show more"). Otherwise rendering is exactly as today. Filters apply before grouping.

- [ ] **Step 1: Write the failing tests**: a change-set [person A, rename B, rename A, person B#2] (invented) renders headings in order "mr:0101-a", "mr:0102-b", with the rename card before the person card inside each; a mentions-only change-set renders no group heading and keeps file order.
- [ ] **Step 2:** `npx vitest run components/__tests__/ReviewPage.test.tsx` — FAIL.
- [ ] **Step 3:** Implement; en `Review.eulogyGroup: "Eulogy {eulogy}"`; `npm run sync-messages`.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5: Commit** `"review: a eulogy's rename and person cards together (crmedr#74)"`

### Task 5: Translations and checks

**Files:**
- Modify: `messages/{it,fr,de,es,pt}.json`
- Modify (only if a string is genuinely identical in a language): `lib/__tests__/messages.test.ts` allowlist

- [ ] **Step 1:** Translate every key added in Tasks 2-4 into it, fr, de, es, pt (keep `{placeholders}` and "Jev" unchanged; Italian e.g. `category.place-genitive: "luogo (genitivo)"`, `take: "Accetta il suggerimento"`).
- [ ] **Step 2:** `npm test` — all PASS (messages and CuratorStrings tests included); `npm run lint` clean; `npx tsc --noEmit` clean; `npm run build` succeeds.
- [ ] **Step 3: Commit** `"messages: the subject review strings in six languages"`
