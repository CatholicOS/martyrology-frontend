# Eulogy markup, part 4 of 4: deciding mentions in /review — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Curators decide crmedr's mention operations (`add_mention`, `set_span`, `remove_mention`) in `/review`. Each one is shown as a quoted passage with the span highlighted, can be accepted, rejected, or edited by picking words, and is exported like every other operation. `import-changeset` bundles the review into the private change-set directory.

**Architecture:**
- Three operation types are added to the change-set model in `lib/changeset.ts`.
- A pure module, `lib/mention-review.ts`, maps an operation's eulogy offsets into its quoted `context` and splits that context for display and word picking.
- A `MentionCard` component renders it, and `OperationCard` dispatches to it the way it already does for the person, place and notes cards.
- `scripts/import-changeset.mjs` gains `--private`, which writes into `CHANGESETS_DIR`. It refuses to write a change-set that quotes text into this public repo.

**Tech Stack:** Next.js 16 (App Router) client components, React 19, next-intl 4, TypeScript, Tailwind CSS 4, Vitest with Testing Library (jsdom), Node ESM scripts.

**Spec:** `docs/superpowers/specs/2026-10-09-eulogy-markup-design.md`. The sections that bind this plan are "Change-set operations" (under crmedr) and "/review" (under martyrology-frontend).

**Depends on:** nothing from parts 2 and 3. The card reads only the change-set file. This part can be built as soon as part 1 fixes the operation shape, including the amendments below. Branch from `main` as `feat/eulogy-markup-review`.

## Global Constraints

- Operation names and fields as the spec gives them: `op`, `id` (`<edition>|<eulogy>|<where>|<start>`), `edition`, `eulogy`, `where`, `kind`, `name` (persons), `context`, `reasoning`, `decision`, `edited`. Then, by operation:
  - `add_mention`: `start`, `end`, `form`;
  - `set_span`: `from {start, end}` and `to {start, end, form}`;
  - `remove_mention`: `start`, `end`, `form`.
- `edited`, when `decision` is `"edit"`, is `{start, end, form}` for `add_mention` and `set_span`. `remove_mention` is accept or reject only.
- Offsets are UTF-16 code units, counted in the eulogy's text or, when `where` is `{footnote: n}`, in that footnote's text. JavaScript string indices are UTF-16, so `String.prototype.slice` uses them directly.
- A change-set whose operations carry `context` quotes the 2004 edition. It is never written into `changesets/` (this repo is public), only into `CHANGESETS_DIR`.
- Every new message exists in all six `messages/*.json` (en, it, fr, de, es, pt). Each is translated, not copied from the English (`lib/__tests__/messages.test.ts` checks both), and keeps the English ICU arguments.
  - Inside a `select`, a branch must never be a single bare word such as `{Person}`. The test's argument scanner reads `{Word}` as an argument named `Word`, so write `{eine Person}`.
- The card's tints follow the spec: warm for persons (amber), cool for places (sky), each with a dark-mode value.
- **Spec amendments that part 1 (crmedr) must also emit.** The spec's operation shape cannot be rendered without them:
  1. **`context_start`** (number, on all three operations): the offset in the eulogy's text, or the footnote's, at which `context` begins. A span's place in `context` is `start - context_start`. The spec says only "a few words either side", which does not say where the context starts. Assuming the span is centred breaks at the start and end of a text and when context is trimmed to word boundaries.
  2. **`kind`** on all three operations, not only `add_mention`. The card tints by kind; the spec's `remove_mention` example omits it.
  3. **`add_mention` with no span:** `start`, `end` and `form` are `null`, `context` is the whole text (or footnote) and `context_start` is `0`, so the curator can find the words. The `id` then ends in the person's `name` instead of `<start>`, so two unmatched persons in one eulogy keep distinct keys.
  4. **The `<where>` part of `id`** is `text` or `footnote:<n>`.
  5. **The review change-set quotes the 2004 text**, so crmedr must not commit `mentions-review.json`. crmedr is public. `extract_mentions.py` writes it to a path the caller gives, or to a gitignored one.

## Review Focus

The five inputs most likely to reach a curator that no happy-path test covers, with the behaviour a curator would expect. Each has a test in the task named.

1. **An `add_mention` with no span** (`start: null`, the person not found). The card says the words were not found. Accept is disabled. Picking words and saving records an edit with the chosen span. *(Task 4)*
2. **Offsets that fall outside `context`** (a bad `context_start`, or a context cut too short). The card shows the passage unmarked with a warning. Accept and edit are disabled, reject still works, and nothing throws. *(Tasks 2, 4)*
3. **The words at the op's offsets no longer equal its `form`.** The card warns that the passage has changed and disables Accept. Edit (for `add_mention` and `set_span`) and Reject stay available. *(Tasks 2, 4)*
4. **Words picked last-to-first, or a saved edit resumed after a reload.** The span is normalised to the first word through the last. A resumed edit shows its own words as proposed, and opening edit again preselects them. *(Tasks 2, 4)*
5. **Bundling.** A change-set with `context`, bundled without `--private`, is refused before any file is written. `--private` without `CHANGESETS_DIR` is refused. A private bundle writes no `index.json`. *(Task 6)*

## File Structure

| File | Responsibility |
|---|---|
| `lib/changeset.ts` (modify) | The three operation types, `MentionOp`, `isMentionOp`, `EditedFields.start/end/form`, adjudicability. |
| `lib/mention-review.ts` (create) | Pure helpers: map an op's offsets into `context`, check them, split the context into display segments and pickable words, build an edit from picked words, the edition's text language, the kind tints. |
| `components/MentionCard.tsx` (create) | The review card for the three operations. |
| `components/OperationCard.tsx` (modify) | Dispatch mention operations to `MentionCard`. |
| `messages/{en,it,fr,de,es,pt}.json` (modify) | `Review.mention`. |
| `scripts/import-changeset.mjs` (modify) | `--private`, `writeBundle`, `quotesText`, the refusal. |
| `README.md` (modify) | How to bundle the mentions review. |
| `lib/__tests__/changeset.test.ts` (modify) | Op types, export, bundling. |
| `lib/__tests__/mention-review.test.ts` (create) | The helpers. |
| `components/__tests__/MentionCard.test.tsx` (create) | The card. |
| `components/__tests__/ReviewPage.test.tsx` (modify) | A mentions change-set loads, filters and renders. |

## Fixture used throughout

The fixtures use invented Latin, never text from the copyrighted 2004 edition:

```
context          = "Fictópoli in Utópia, natális sancti Fictíni et Ficti, epíscopi."   (63 code units)
context_start    = 120
words (index: text start–end in context):
  0 Fictópoli 0–9 · 1 in 10–12 · 2 Utópia 13–19 · 3 natális 21–28 · 4 sancti 29–35 ·
  5 Fictíni 36–43 · 6 et 44–46 · 7 Ficti 47–52 · 8 epíscopi 54–62
"Fictíni"           context 36–43   eulogy 156–163
"Fictíni et Ficti"  context 36–52   eulogy 156–172
"Fictópoli"         context 0–9     eulogy 120–129
```

---

### Task 1: Mention operations in the change-set model

**Files:**
- Modify: `lib/changeset.ts`. Add `start`/`end`/`form` to `EditedFields`, after the `attach_note` fields. Add the new interfaces after `PlaceMarginOp`, extend `Op`, `isAdjudicable`, and add `isMentionOp`.
- Test: `lib/__tests__/changeset.test.ts`

**Interfaces:**
- Consumes: the existing `Base`, `Op`, `opId`, `exportChangeset`.
- Produces:
  - `type MentionWhere = "text" | { footnote: number }`
  - `type MentionKind = "person" | "place"`
  - `interface AddMentionOp { op: "add_mention"; id; edition; eulogy; where: MentionWhere; kind: MentionKind; name?: string; context: string; context_start: number; start: number | null; end: number | null; form: string | null }`
  - `interface SetSpanOp { op: "set_span"; …same base…; from: { start: number; end: number }; to: { start: number; end: number; form: string } }`
  - `interface RemoveMentionOp { op: "remove_mention"; …same base…; start: number; end: number; form: string }`
  - `type MentionOp = AddMentionOp | SetSpanOp | RemoveMentionOp`
  - `function isMentionOp(op: Op): op is MentionOp`
  - `EditedFields.start?: number; end?: number; form?: string`

- [ ] **Step 1: Write the failing tests.** Append to `lib/__tests__/changeset.test.ts`. Extend its first import to `import { parseChangeset, exportChangeset, opId, isAdjudicable, isMentionOp, type MentionOp } from "@/lib/changeset";`.

```ts
describe("mention operations", () => {
  const base = {
    edition: "martyrologium_romanum_2004", eulogy: "mr:0101-fictinus", where: "text" as const,
    context: "Fictópoli in Utópia, natális sancti Fictíni et Ficti, epíscopi.", context_start: 120,
    reasoning: "", decision: null, edited: null,
  };
  const add: MentionOp = { ...base, op: "add_mention", id: "martyrologium_romanum_2004|mr:0101-fictinus|text|156",
    kind: "person", name: "Fictinus", start: 156, end: 163, form: "Fictíni" };
  const set: MentionOp = { ...base, op: "set_span", id: "martyrologium_romanum_2004|mr:0101-fictinus|text|156",
    kind: "person", name: "Fictinus", from: { start: 156, end: 163 }, to: { start: 156, end: 172, form: "Fictíni et Ficti" } };
  const remove: MentionOp = { ...base, op: "remove_mention", id: "martyrologium_romanum_2004|mr:0101-fictinus|text|120",
    kind: "place", start: 120, end: 129, form: "Fictópoli" };

  it("are adjudicable, recognised as mentions, and keyed by their id", () => {
    for (const op of [add, set, remove]) {
      expect(isAdjudicable(op)).toBe(true);
      expect(isMentionOp(op)).toBe(true);
      expect(opId(op)).toBe(op.id);
    }
    expect(isMentionOp({ op: "resolve_place", id: "x", decision: null })).toBe(false);
  });

  it("export a chosen span on the op", () => {
    const cs = parseChangeset(JSON.stringify({ schema: "crmedr-changeset/v1", generated_by: "scripts/extract_mentions.py",
      base: { edition: "martyrologium_romanum_2004", registry: "data/mentions.json" }, operations: [add, remove] }));
    const edited = { start: 156, end: 172, form: "Fictíni et Ficti" };
    const out = exportChangeset(cs, { [add.id]: { decision: "edit", edited }, [remove.id]: { decision: "reject" } });
    expect(out.operations[0]).toMatchObject({ op: "add_mention", decision: "edit", edited });
    expect(out.operations[1]).toMatchObject({ op: "remove_mention", decision: "reject", edited: null });
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**

Run: `npx vitest run lib/__tests__/changeset.test.ts`
Expected: FAIL. TypeScript transpiles without type-checking, so the failure is at runtime: `isMentionOp is not a function`. `isAdjudicable` also returns false for the new ops.

- [ ] **Step 3: Implement.** In `lib/changeset.ts`, add these lines to `EditedFields`, after `mark?: string;`:

```ts
  // add_mention, set_span: the words the curator chose, as offsets in the eulogy's text (or the footnote's)
  start?: number;
  end?: number;
  form?: string;
```

After the `PlaceMarginOp` interface, add:

```ts
/** Where a mention is printed: the eulogy's text, or its nth footnote. */
export type MentionWhere = "text" | { footnote: number };

export type MentionKind = "person" | "place";

/**
 * A person or place a eulogy names, as crmedr's scripts/extract_mentions.py proposes it. Offsets are
 * UTF-16 code units in the eulogy's text, or in the footnote's when `where` is a footnote. `context`
 * quotes a few words either side, from `context_start`, so the card can show the span without the
 * whole text. These change-sets quote the 2004 edition: they live in CHANGESETS_DIR, never in the repo.
 */
interface MentionBase extends Base {
  /** `<edition>|<eulogy>|<where>|<start>`, `<where>` "text" or "footnote:<n>"; without a span, it ends in the name. */
  id: string;
  edition: string;
  eulogy: string;
  where: MentionWhere;
  kind: MentionKind;
  /** A person's nominative in crmedr's persons.json. */
  name?: string;
  context: string;
  context_start: number;
}

/** Mark words not marked yet. No span (all null): crmedr could not find the person; the curator picks the words. */
export interface AddMentionOp extends MentionBase {
  op: "add_mention";
  start: number | null;
  end: number | null;
  form: string | null;
}

/** Move a mark: the words it covers now (`from`) and the words it should cover (`to`). */
export interface SetSpanOp extends MentionBase {
  op: "set_span";
  from: { start: number; end: number };
  to: { start: number; end: number; form: string };
}

/** Remove a mark crmedr doubts: a person inside a place phrase, or a stem that matched in several places. */
export interface RemoveMentionOp extends MentionBase {
  op: "remove_mention";
  start: number;
  end: number;
  form: string;
}

export type MentionOp = AddMentionOp | SetSpanOp | RemoveMentionOp;
```

Extend `Op` with `| AddMentionOp | SetSpanOp | RemoveMentionOp`, placed before `| UnknownOp`. In `isAdjudicable`, add three alternatives after `op.op === "place_margin"`:

```ts
    op.op === "place_margin" ||
    op.op === "add_mention" ||
    op.op === "set_span" ||
    op.op === "remove_mention"
```

After `isAdjudicable`, add:

```ts
export function isMentionOp(op: Op): op is MentionOp {
  return op.op === "add_mention" || op.op === "set_span" || op.op === "remove_mention";
}
```

- [ ] **Step 4: Run the tests and the type check, and confirm they pass.**

Run: `npx vitest run lib/__tests__/changeset.test.ts && npx tsc --noEmit -p .`
Expected: all tests pass, and `tsc` prints nothing.

- [ ] **Step 5: Commit.**

```bash
git add lib/changeset.ts lib/__tests__/changeset.test.ts
git commit -m "feat(review): the mention operations in the change-set model

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv"
```

---

### Task 2: Mapping an operation into its quoted context

**Files:**
- Create: `lib/mention-review.ts`
- Test: `lib/__tests__/mention-review.test.ts`

**Interfaces:**
- Consumes: `DecisionRecord`, `MentionOp`, `MentionKind` (Task 1).
- Produces:
  - `interface Range { start: number; end: number }` (offsets in `context`)
  - `interface MentionRanges { current: Range | null; proposed: Range | null; problem: "outside" | "changed" | null }`
  - `function mentionRanges(op: MentionOp, decision?: DecisionRecord): MentionRanges`
  - `interface Segment { text: string; current: boolean; proposed: boolean }`
  - `function contextSegments(context: string, current: Range | null, proposed: Range | null): Segment[]`
  - `interface Word { text: string; start: number; end: number }`
  - `function contextWords(context: string): Word[]`
  - `function wordsIn(words: Word[], range: Range | null): [number, number] | null`
  - `function editedSpan(op: MentionOp, words: Word[], a: number, b: number): { start: number; end: number; form: string }`
  - `function mentionLang(edition: string): string`
  - `const MENTION_TINT: Record<MentionKind, string>`

- [ ] **Step 1: Write the failing tests.** Create `lib/__tests__/mention-review.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { AddMentionOp, MentionOp, RemoveMentionOp, SetSpanOp } from "@/lib/changeset";
import { contextSegments, contextWords, editedSpan, mentionLang, mentionRanges, wordsIn } from "@/lib/mention-review";

// Invented Latin, never the copyrighted 2004 text.
const context = "Fictópoli in Utópia, natális sancti Fictíni et Ficti, epíscopi.";
const base = { edition: "martyrologium_romanum_2004", eulogy: "mr:0101-fictinus", where: "text" as const, context, context_start: 120, decision: null };
const add = (extra: Partial<AddMentionOp> = {}): AddMentionOp => ({ ...base, op: "add_mention", id: "a", kind: "person", name: "Fictinus", start: 156, end: 163, form: "Fictíni", ...extra });
const set = (extra: Partial<SetSpanOp> = {}): SetSpanOp => ({ ...base, op: "set_span", id: "s", kind: "person", name: "Fictinus",
  from: { start: 156, end: 163 }, to: { start: 156, end: 172, form: "Fictíni et Ficti" }, ...extra });
const remove = (extra: Partial<RemoveMentionOp> = {}): RemoveMentionOp => ({ ...base, op: "remove_mention", id: "r", kind: "place", start: 120, end: 129, form: "Fictópoli", ...extra });

describe("mentionRanges", () => {
  it("finds each operation's words in the context from context_start", () => {
    expect(mentionRanges(add())).toEqual({ current: null, proposed: { start: 36, end: 43 }, problem: null });
    expect(mentionRanges(set())).toEqual({ current: { start: 36, end: 43 }, proposed: { start: 36, end: 52 }, problem: null });
    expect(mentionRanges(remove())).toEqual({ current: { start: 0, end: 9 }, proposed: null, problem: null });
  });

  it("has nothing proposed for an add_mention without a span", () => {
    expect(mentionRanges(add({ start: null, end: null, form: null }))).toEqual({ current: null, proposed: null, problem: null });
  });

  it("shows a saved edit's words as proposed (a resumed review)", () => {
    const r = mentionRanges(add(), { decision: "edit", edited: { start: 156, end: 172, form: "Fictíni et Ficti" } });
    expect(r).toEqual({ current: null, proposed: { start: 36, end: 52 }, problem: null });
  });

  it("refuses offsets outside the context, marking nothing", () => {
    expect(mentionRanges(add({ context_start: 500 }))).toEqual({ current: null, proposed: null, problem: "outside" });
    expect(mentionRanges(remove({ end: 200 }))).toEqual({ current: null, proposed: null, problem: "outside" });
  });

  it("says when the words at the offsets are not the op's form", () => {
    expect(mentionRanges(add({ form: "Fictinus" })).problem).toBe("changed");
    expect(mentionRanges(remove({ form: "Romæ" })).problem).toBe("changed");
    // An edit is read from the context itself: the curator's words always fit.
    expect(mentionRanges(add({ form: "Fictinus" }), { decision: "edit", edited: { start: 156, end: 163, form: "Fictíni" } }).problem).toBeNull();
  });
});

describe("contextSegments", () => {
  it("cuts the context where either span starts or ends, saying which each piece belongs to", () => {
    expect(contextSegments(context, { start: 36, end: 43 }, { start: 36, end: 52 })).toEqual([
      { text: "Fictópoli in Utópia, natális sancti ", current: false, proposed: false },
      { text: "Fictíni", current: true, proposed: true },
      { text: " et Ficti", current: false, proposed: true },
      { text: ", epíscopi.", current: false, proposed: false },
    ]);
    expect(contextSegments(context, null, null)).toEqual([{ text: context, current: false, proposed: false }]);
  });
});

describe("contextWords, wordsIn and editedSpan", () => {
  const words = contextWords(context);

  it("lists the words with their offsets, without punctuation", () => {
    expect(words.map((w) => w.text)).toEqual(["Fictópoli", "in", "Utópia", "natális", "sancti", "Fictíni", "et", "Ficti", "epíscopi"]);
    expect(words[5]).toEqual({ text: "Fictíni", start: 36, end: 43 });
  });

  it("splits an elided Italian word at its apostrophe", () => {
    expect(contextWords("Ancora a Londra, sant’Oliviero").map((w) => w.text)).toEqual(["Ancora", "a", "Londra", "sant", "Oliviero"]);
  });

  it("finds the words a range covers", () => {
    expect(wordsIn(words, { start: 36, end: 52 })).toEqual([5, 7]);
    expect(wordsIn(words, null)).toBeNull();
  });

  it("makes an edit from the first word to the last, in either order, in eulogy offsets", () => {
    const op: MentionOp = add();
    expect(editedSpan(op, words, 7, 5)).toEqual({ start: 156, end: 172, form: "Fictíni et Ficti" });
    expect(editedSpan(op, words, 5, 5)).toEqual({ start: 156, end: 163, form: "Fictíni" });
  });
});

describe("mentionLang", () => {
  it("reads the text's language from the edition", () => {
    expect(mentionLang("martyrologium_romanum_2004")).toBe("la");
    expect(mentionLang("martyrologium_romanum_2004_it_IT")).toBe("it");
    expect(mentionLang("martyrologium_romanum_1914_en_unofficial")).toBe("en");
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**

Run: `npx vitest run lib/__tests__/mention-review.test.ts`
Expected: FAIL with `Failed to resolve import "@/lib/mention-review"`.

- [ ] **Step 3: Implement.** Create `lib/mention-review.ts`:

```ts
import type { DecisionRecord, MentionKind, MentionOp } from "@/lib/changeset";

/** A span of a mention operation's `context`, in its own offsets. */
export interface Range {
  start: number;
  end: number;
}

export interface MentionRanges {
  /** The words marked now: set_span's `from`, remove_mention's span. */
  current: Range | null;
  /** The words to mark: the op's (or the curator's edit); none for remove_mention, or an add_mention without a span. */
  proposed: Range | null;
  /** Why the op can't stand as it is: its offsets fall outside the context, or its words there are not its form. */
  problem: "outside" | "changed" | null;
}

const local = (op: MentionOp, start: number, end: number): Range => ({ start: start - op.context_start, end: end - op.context_start });
const fits = (op: MentionOp, r: Range) => r.start >= 0 && r.start < r.end && r.end <= op.context.length;

/** The op's own spans, and the form each should read (set_span's `from` carries none). */
function opSpans(op: MentionOp): { current: Range | null; proposed: Range | null; forms: [Range, string][] } {
  if (op.op === "add_mention") {
    if (op.start === null || op.end === null) return { current: null, proposed: null, forms: [] };
    const proposed = local(op, op.start, op.end);
    return { current: null, proposed, forms: op.form === null ? [] : [[proposed, op.form]] };
  }
  if (op.op === "set_span") {
    const proposed = local(op, op.to.start, op.to.end);
    return { current: local(op, op.from.start, op.from.end), proposed, forms: [[proposed, op.to.form]] };
  }
  const current = local(op, op.start, op.end);
  return { current, proposed: null, forms: [[current, op.form]] };
}

/**
 * Where an op's words are in its context: the current mark, and the proposed one (a saved edit's when
 * there is one). Offsets outside the context mark nothing; words that are not the op's form are flagged.
 */
export function mentionRanges(op: MentionOp, decision?: DecisionRecord): MentionRanges {
  const ed = decision?.decision === "edit" ? decision.edited : undefined;
  const edited = typeof ed?.start === "number" && typeof ed?.end === "number" ? local(op, ed.start, ed.end) : null;
  const own = opSpans(op);
  const current = own.current;
  const proposed = edited ?? own.proposed;
  if ([current, proposed].some((r) => r !== null && !fits(op, r))) return { current: null, proposed: null, problem: "outside" };
  // An edit's words are read from the context, so only the op's own words are checked against their form.
  const forms = edited ? own.forms.filter(([r]) => r === own.current) : own.forms;
  const changed = forms.some(([r, form]) => op.context.slice(r.start, r.end) !== form);
  return { current, proposed, problem: changed ? "changed" : null };
}

export interface Segment {
  text: string;
  current: boolean;
  proposed: boolean;
}

/** The context cut wherever the current or the proposed span starts or ends. */
export function contextSegments(context: string, current: Range | null, proposed: Range | null): Segment[] {
  const cuts = new Set([0, context.length]);
  for (const r of [current, proposed]) {
    if (r) {
      cuts.add(r.start);
      cuts.add(r.end);
    }
  }
  const at = [...cuts].filter((c) => c >= 0 && c <= context.length).sort((a, b) => a - b);
  const within = (r: Range | null, s: number) => r !== null && s >= r.start && s < r.end;
  return at
    .slice(0, -1)
    .map((s, i) => ({ text: context.slice(s, at[i + 1]), current: within(current, s), proposed: within(proposed, s) }))
    .filter((g) => g.text !== "");
}

export interface Word {
  text: string;
  start: number;
  end: number;
}

// Letters, combining accents, digits and hyphens; an apostrophe ends a word, so "sant’Oliviero" is two.
const WORD = /[\p{L}\p{M}\p{N}-]+/gu;

/** The context's words, with their offsets: what a curator picks a span from. */
export function contextWords(context: string): Word[] {
  return [...context.matchAll(WORD)].map((m) => {
    const at = m.index ?? 0; // always set by matchAll; typed optional in older TypeScript libs
    return { text: m[0], start: at, end: at + m[0].length };
  });
}

/** The first and last word a range touches, or null. */
export function wordsIn(words: Word[], range: Range | null): [number, number] | null {
  if (!range) return null;
  let first = -1;
  let last = -1;
  words.forEach((w, i) => {
    if (w.end > range.start && w.start < range.end) {
      if (first < 0) first = i;
      last = i;
    }
  });
  return first < 0 ? null : [first, last];
}

/** The edit for picked words `a` and `b` (in either order): from the first to the last, in eulogy offsets. */
export function editedSpan(op: MentionOp, words: Word[], a: number, b: number): { start: number; end: number; form: string } {
  const [first, last] = a <= b ? [a, b] : [b, a];
  const start = words[first].start;
  const end = words[last].end;
  return { start: op.context_start + start, end: op.context_start + end, form: op.context.slice(start, end) };
}

/** The language of an edition's text: Italian or English editions by their suffix, else Latin. */
export function mentionLang(edition: string): string {
  return /_(it|en)(_|$)/.exec(edition)?.[1] ?? "la";
}

/** A mark's tint by kind, as in the reader: warm for persons, cool for places. */
export const MENTION_TINT: Record<MentionKind, string> = {
  person: "bg-amber-100 dark:bg-amber-900/40",
  place: "bg-sky-100 dark:bg-sky-900/40",
};
```

- [ ] **Step 4: Run the tests and the type check, and confirm they pass.**

Run: `npx vitest run lib/__tests__/mention-review.test.ts && npx tsc --noEmit -p .`
Expected: all tests pass, and `tsc` prints nothing.

- [ ] **Step 5: Commit.**

```bash
git add lib/mention-review.ts lib/__tests__/mention-review.test.ts
git commit -m "feat(review): map a mention operation's offsets into its quoted context

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv"
```

---

### Task 3: The card's messages in six languages

**Files:**
- Modify: `messages/en.json`, `messages/it.json`, `messages/fr.json`, `messages/de.json`, `messages/es.json`, `messages/pt.json`. Add `Review.mention`, which lands as the last key of `Review`.
- Test: `lib/__tests__/messages.test.ts` (existing; run it, don't change it).

**Interfaces:**
- Produces the keys under `Review.mention` that Task 4 uses: `kind.person`, `kind.place`, `title.add_mention`, `title.set_span`, `title.remove_mention` (each with a `{kind, select, …}` argument), `current`, `proposed`, `noSpan`, `outside`, `changed`, `why` (`{text}`), `choose`, `hint`, `words`, `selected` (`{form}`), `save`.
- Reused from existing namespaces, not duplicated: `Review.person.inText`, `Review.person.inFootnote` (`{n}`), `Review.actions.accept`, `Review.actions.reject`, `Review.actions.cancel`, `Review.decision.*`.

- [ ] **Step 1: Add the messages.** Run this from the repo root. It rewrites each file the way `scripts/sync-messages.mjs` does (`JSON.stringify(…, null, 2)` plus a newline), so the only diff is the new keys.

```bash
node --input-type=module - <<'EOF'
import { readFileSync, writeFileSync } from "node:fs";
const M = {
  en: { kind: { person: "person", place: "place" },
    title: { add_mention: "Mark these words as {kind, select, person {a person} other {a place}}",
      set_span: "Move the mark on {kind, select, person {this person} other {this place}}",
      remove_mention: "Remove the mark on {kind, select, person {this person} other {this place}}" },
    current: "Marked now", proposed: "Proposed", noSpan: "Not found in the text: choose the words to mark.",
    outside: "The proposed words fall outside the quoted text: this operation can't be decided here.",
    changed: "The quoted text no longer has these words in this place: this operation can't be accepted.",
    why: "Why: {text}", choose: "Choose the words", hint: "Click the first word, then the last.",
    words: "Words of the text", selected: "Chosen: {form}", save: "Save the words" },
  it: { kind: { person: "persona", place: "luogo" },
    title: { add_mention: "Segna queste parole come {kind, select, person {una persona} other {un luogo}}",
      set_span: "Sposta il segno su {kind, select, person {questa persona} other {questo luogo}}",
      remove_mention: "Togli il segno su {kind, select, person {questa persona} other {questo luogo}}" },
    current: "Segnato ora", proposed: "Proposto", noSpan: "Non trovato nel testo: scegli le parole da segnare.",
    outside: "Le parole proposte cadono fuori dal testo citato: questa operazione non si può decidere qui.",
    changed: "Il testo citato non ha più queste parole in questo punto: questa operazione non si può accettare.",
    why: "Perché: {text}", choose: "Scegli le parole", hint: "Fai clic sulla prima parola, poi sull’ultima.",
    words: "Parole del testo", selected: "Scelte: {form}", save: "Salva le parole" },
  fr: { kind: { person: "personne", place: "lieu" },
    title: { add_mention: "Marquer ces mots comme {kind, select, person {une personne} other {un lieu}}",
      set_span: "Déplacer la marque de {kind, select, person {cette personne} other {ce lieu}}",
      remove_mention: "Retirer la marque de {kind, select, person {cette personne} other {ce lieu}}" },
    current: "Marqué maintenant", proposed: "Proposé", noSpan: "Introuvable dans le texte : choisissez les mots à marquer.",
    outside: "Les mots proposés sortent du texte cité : cette opération ne peut pas être décidée ici.",
    changed: "Le texte cité n’a plus ces mots à cet endroit : cette opération ne peut pas être acceptée.",
    why: "Pourquoi : {text}", choose: "Choisir les mots", hint: "Cliquez sur le premier mot, puis sur le dernier.",
    words: "Mots du texte", selected: "Choisis : {form}", save: "Enregistrer les mots" },
  de: { kind: { person: "Person", place: "Ort" },
    title: { add_mention: "Diese Wörter als {kind, select, person {eine Person} other {einen Ort}} markieren",
      set_span: "Markierung {kind, select, person {dieser Person} other {dieses Orts}} verschieben",
      remove_mention: "Markierung {kind, select, person {dieser Person} other {dieses Orts}} entfernen" },
    current: "Jetzt markiert", proposed: "Vorgeschlagen", noSpan: "Nicht im Text gefunden: Wörter zum Markieren auswählen.",
    outside: "Die vorgeschlagenen Wörter liegen außerhalb des zitierten Textes: Diese Operation kann hier nicht entschieden werden.",
    changed: "Der zitierte Text hat diese Wörter an dieser Stelle nicht mehr: Diese Operation kann nicht angenommen werden.",
    why: "Warum: {text}", choose: "Wörter auswählen", hint: "Erst auf das erste Wort klicken, dann auf das letzte.",
    words: "Wörter des Textes", selected: "Ausgewählt: {form}", save: "Wörter speichern" },
  es: { kind: { person: "persona", place: "lugar" },
    title: { add_mention: "Marcar estas palabras como {kind, select, person {una persona} other {un lugar}}",
      set_span: "Mover la marca de {kind, select, person {esta persona} other {este lugar}}",
      remove_mention: "Quitar la marca de {kind, select, person {esta persona} other {este lugar}}" },
    current: "Marcado ahora", proposed: "Propuesto", noSpan: "No se encontró en el texto: elige las palabras que marcar.",
    outside: "Las palabras propuestas quedan fuera del texto citado: esta operación no se puede decidir aquí.",
    changed: "El texto citado ya no tiene estas palabras en este lugar: esta operación no se puede aceptar.",
    why: "Por qué: {text}", choose: "Elegir las palabras", hint: "Haz clic en la primera palabra y luego en la última.",
    words: "Palabras del texto", selected: "Elegidas: {form}", save: "Guardar las palabras" },
  pt: { kind: { person: "pessoa", place: "lugar" },
    title: { add_mention: "Marcar estas palavras como {kind, select, person {uma pessoa} other {um lugar}}",
      set_span: "Mover a marca de {kind, select, person {esta pessoa} other {este lugar}}",
      remove_mention: "Remover a marca de {kind, select, person {esta pessoa} other {este lugar}}" },
    current: "Marcado agora", proposed: "Proposto", noSpan: "Não encontrado no texto: escolha as palavras a marcar.",
    outside: "As palavras propostas ficam fora do texto citado: esta operação não pode ser decidida aqui.",
    changed: "O texto citado já não tem estas palavras neste lugar: esta operação não pode ser aceita.",
    why: "Por quê: {text}", choose: "Escolher as palavras", hint: "Clique na primeira palavra e depois na última.",
    words: "Palavras do texto", selected: "Escolhidas: {form}", save: "Salvar as palavras" },
};
for (const [l, m] of Object.entries(M)) {
  const p = `messages/${l}.json`;
  const j = JSON.parse(readFileSync(p, "utf8"));
  j.Review.mention = m;
  writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
}
EOF
```

- [ ] **Step 2: Check that only the new keys changed, and that the messages tests pass.**

Run: `git diff --stat messages/ && npx vitest run lib/__tests__/messages.test.ts`
Expected: each of the six files gains only lines inside `"mention": { … }`, about 25 lines each, and the messages tests pass (same keys, same ICU arguments, nothing left in English).

- [ ] **Step 3: Commit.**

```bash
git add messages/
git commit -m "feat(review): the mention card's messages in six languages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv"
```

---

### Task 4: `MentionCard`, dispatched from `OperationCard`

**Files:**
- Create: `components/MentionCard.tsx`
- Modify: `components/OperationCard.tsx`. Add the import, and a dispatch branch at the top of `OperationCard` after the `place_margin` branch.
- Test: `components/__tests__/MentionCard.test.tsx`

**Interfaces:**
- Consumes: `MentionOp`, `isMentionOp`, `opId`, `DecisionRecord` (Task 1); `mentionRanges`, `contextSegments`, `contextWords`, `wordsIn`, `editedSpan`, `mentionLang`, `MENTION_TINT` (Task 2); `Review.mention.*`, `Review.person.inText/inFootnote`, `Review.actions.*`, `Review.decision.*` (Task 3); `decisionClass` and `decisionLabel` from `components/decisionClass.ts`.
- Produces: `default function MentionCard(props: { op: MentionOp; decision?: DecisionRecord; onDecide: (id: string, d: DecisionRecord) => void }): JSX.Element`. The card's root has `data-testid="op-card-<opId>"`, as every card does.
- The decisions it records, in eulogy offsets:
  - Accept: `{ decision: "accept" }`.
  - Reject: `{ decision: "reject" }`.
  - Save the words: `{ decision: "edit", edited: { start, end, form } }`.

- [ ] **Step 1: Write the failing tests.** Create `components/__tests__/MentionCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/intl";
import OperationCard from "@/components/OperationCard";
import type { AddMentionOp, DecisionRecord, RemoveMentionOp, SetSpanOp } from "@/lib/changeset";

vi.mock("@/lib/api", () => ({ getElogium: vi.fn(), ApiError: class ApiError extends Error {} }));

// Invented Latin, never the copyrighted 2004 text.
const context = "Fictópoli in Utópia, natális sancti Fictíni et Ficti, epíscopi.";
const base = { edition: "martyrologium_romanum_2004", eulogy: "mr:0101-fictinus", where: "text" as const, context, context_start: 120, reasoning: "Stem match", decision: null, edited: null };
const ID = "martyrologium_romanum_2004|mr:0101-fictinus|text|156";
const add = (extra: Partial<AddMentionOp> = {}): AddMentionOp => ({ ...base, op: "add_mention", id: ID, kind: "person", name: "Fictinus", start: 156, end: 163, form: "Fictíni", ...extra });
const set = (): SetSpanOp => ({ ...base, op: "set_span", id: ID, kind: "person", name: "Fictinus", from: { start: 156, end: 163 }, to: { start: 156, end: 172, form: "Fictíni et Ficti" } });
const remove = (extra: Partial<RemoveMentionOp> = {}): RemoveMentionOp => ({ ...base, op: "remove_mention", id: "martyrologium_romanum_2004|mr:0101-fictinus|text|120", kind: "place", start: 120, end: 129, form: "Fictópoli", ...extra });

const renderCard = (op: AddMentionOp | SetSpanOp | RemoveMentionOp, decision?: DecisionRecord) => {
  const onDecide = vi.fn();
  const view = render(<OperationCard op={op} decision={decision} onDecide={onDecide} locale="la" baseEdition="martyrologium_romanum_2004" />);
  return { onDecide, view };
};

describe("MentionCard", () => {
  it("shows an add_mention's passage in the text's language, the proposed words underlined in the person tint", () => {
    const { view } = renderCard(add());
    expect(screen.getByTestId(`op-card-${ID}`)).toBeInTheDocument();
    expect(screen.getByText("Mark these words as a person")).toBeInTheDocument();
    expect(screen.getByText(/in the text/)).toBeInTheDocument();
    const ins = view.container.querySelector("ins")!;
    expect(ins).toHaveTextContent("Fictíni");
    expect(ins.className).toContain("bg-amber-100");
    expect(ins.closest("[lang]")).toHaveAttribute("lang", "la");
    expect(view.container.querySelector("del")).toBeNull();
    expect(screen.getByText("Why: Stem match")).toBeInTheDocument();
  });

  it("shows a set_span's current words struck through and its proposed words underlined", () => {
    const { view } = renderCard(set());
    expect([...view.container.querySelectorAll("ins")].map((e) => e.textContent).join("")).toBe("Fictíni et Ficti");
    expect(view.container.querySelector("del")).toBeNull(); // the current words are inside the proposed ones
    expect(screen.getByText("Move the mark on this person")).toBeInTheDocument();
  });

  it("shows a remove_mention's words struck through in the place tint, with no edit", () => {
    const { view, onDecide } = renderCard(remove());
    const del = view.container.querySelector("del")!;
    expect(del).toHaveTextContent("Fictópoli");
    expect(del.className).toContain("bg-sky-100");
    expect(screen.queryByRole("button", { name: "Choose the words" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(onDecide).toHaveBeenCalledWith(remove().id, { decision: "accept" });
  });

  it("accepts and rejects under the op's id", () => {
    const { onDecide } = renderCard(add());
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onDecide.mock.calls).toEqual([[ID, { decision: "accept" }], [ID, { decision: "reject" }]]);
  });

  it("records the words picked last-to-first as an edit, from the first to the last", () => {
    const { onDecide } = renderCard(add());
    fireEvent.click(screen.getByRole("button", { name: "Choose the words" }));
    fireEvent.click(screen.getByRole("button", { name: "Ficti" }));
    fireEvent.click(screen.getByRole("button", { name: "Fictíni" }));
    expect(screen.getByText("Chosen: Fictíni et Ficti")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save the words" }));
    expect(onDecide).toHaveBeenCalledWith(ID, { decision: "edit", edited: { start: 156, end: 172, form: "Fictíni et Ficti" } });
  });

  it("cancels an edit without deciding", () => {
    const { onDecide } = renderCard(add());
    fireEvent.click(screen.getByRole("button", { name: "Choose the words" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onDecide).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Choose the words" })).toBeInTheDocument();
  });
});

describe("MentionCard, the inputs that reach curators", () => {
  it("asks for the words of an add_mention without a span, and only accepts them as an edit", () => {
    const { view, onDecide } = renderCard(add({ start: null, end: null, form: null }));
    expect(screen.getByText("Not found in the text: choose the words to mark.")).toBeInTheDocument();
    expect(view.container.querySelector("ins")).toBeNull();
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Choose the words" }));
    expect(screen.getByRole("button", { name: "Save the words" })).toBeDisabled(); // nothing picked yet
    fireEvent.click(screen.getByRole("button", { name: "Fictíni" }));
    fireEvent.click(screen.getByRole("button", { name: "Save the words" }));
    expect(onDecide).toHaveBeenCalledWith(ID, { decision: "edit", edited: { start: 156, end: 163, form: "Fictíni" } });
  });

  it("warns about offsets outside the context, marks nothing, and only lets the op be rejected", () => {
    const { view, onDecide } = renderCard(add({ context_start: 500 }));
    expect(screen.getByText(/fall outside the quoted text/)).toBeInTheDocument();
    expect(view.container.querySelector("ins, del")).toBeNull();
    expect(screen.getByText(context)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Choose the words" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onDecide).toHaveBeenCalledWith(ID, { decision: "reject" });
  });

  it("warns when the words are no longer the op's form, keeping edit and reject", () => {
    renderCard(add({ form: "Fictinus" }));
    expect(screen.getByText(/no longer has these words/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Choose the words" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeEnabled();
  });

  it("shows a resumed edit's words as proposed, and picks them again when editing", () => {
    const { view } = renderCard(add(), { decision: "edit", edited: { start: 156, end: 172, form: "Fictíni et Ficti" } });
    expect(screen.getByText("edit")).toBeInTheDocument();
    expect([...view.container.querySelectorAll("ins")].map((e) => e.textContent).join("")).toBe("Fictíni et Ficti");
    fireEvent.click(screen.getByRole("button", { name: "Choose the words" }));
    expect(screen.getByText("Chosen: Fictíni et Ficti")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "et" })).toHaveAttribute("aria-pressed", "true");
  });

  it("says which footnote a mention is printed in", () => {
    renderCard(add({ where: { footnote: 2 } }));
    expect(screen.getByText(/in footnote 2/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**

Run: `npx vitest run components/__tests__/MentionCard.test.tsx`
Expected: FAIL. `OperationCard` renders `IdOperationCard`, which calls `getElogium` and shows no "Mark these words as a person".

- [ ] **Step 3: Implement the card.** Create `components/MentionCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { decisionClass, decisionLabel } from "@/components/decisionClass";
import { opId, type DecisionRecord, type MentionOp } from "@/lib/changeset";
import { MENTION_TINT, contextSegments, contextWords, editedSpan, mentionLang, mentionRanges, wordsIn } from "@/lib/mention-review";

const button = "rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-40";

interface Props {
  op: MentionOp;
  decision?: DecisionRecord;
  onDecide: (id: string, d: DecisionRecord) => void;
}

/**
 * Review card for crmedr's mention ops (add_mention, set_span, remove_mention): the quoted passage
 * with the words marked now struck through and the words to mark underlined, in the kind's tint.
 * Accept takes the op as proposed; "Choose the words" picks a span word by word (the first word, then
 * the last) and records it as an edit, in eulogy offsets. An op whose offsets fall outside its context,
 * or whose words there are not its form, can't be accepted as it is.
 */
export default function MentionCard({ op, decision, onDecide }: Props) {
  const t = useTranslations("Review.mention");
  const p = useTranslations("Review.person");
  const r = useTranslations("Review");
  const uid = opId(op);
  const tint = MENTION_TINT[op.kind];
  const lang = mentionLang(op.edition);
  const words = contextWords(op.context);
  const shown = mentionRanges(op, decision);
  // Accept takes the op as proposed, whatever was saved: judge it as proposed.
  const asProposed = mentionRanges(op);
  const canAccept = asProposed.problem === null && !(op.op === "add_mention" && asProposed.proposed === null);
  const canEdit = op.op !== "remove_mention" && shown.problem !== "outside";
  const [editing, setEditing] = useState(false);
  // The words picked while editing: the first click starts the span, the second ends it.
  const [pick, setPick] = useState<[number, number] | null>(null);
  const [anchor, setAnchor] = useState<number | null>(null);
  const where = op.where === "text" ? p("inText") : p("inFootnote", { n: op.where.footnote });

  const startEditing = () => {
    setPick(wordsIn(words, shown.proposed));
    setAnchor(null);
    setEditing(true);
  };
  const pickWord = (i: number) => {
    if (anchor === null) {
      setAnchor(i);
      setPick([i, i]);
    } else {
      setPick(anchor <= i ? [anchor, i] : [i, anchor]);
      setAnchor(null);
    }
  };
  const picked = pick ? editedSpan(op, words, pick[0], pick[1]) : null;

  return (
    <div className={`mb-3 rounded border p-3 text-sm ${decisionClass(decision)}`} data-testid={`op-card-${uid}`}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {op.op} · {op.eulogy} · {where}
        </span>
        <span className="flex gap-1 text-xs">
          <span className={`rounded px-2 py-0.5 ${tint}`}>{t(`kind.${op.kind}`)}</span>
          {op.confidence && <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{op.confidence}</span>}
          {decision && <span className="rounded bg-slate-200 px-2 py-0.5 font-medium dark:bg-slate-800">{decisionLabel(r, decision)}</span>}
        </span>
      </div>

      <p className="font-medium">{t(`title.${op.op}`, { kind: op.kind })}</p>
      {op.name && <p className="mb-1 text-slate-700 dark:text-slate-300" lang="la">{op.name}</p>}

      {!editing ? (
        <p className="mb-2 border-l-4 border-slate-300 pl-2 font-serif text-base dark:border-slate-700" lang={lang}>
          {contextSegments(op.context, shown.current, shown.proposed).map((s, i) =>
            s.proposed ? (
              <ins key={i} className={`${tint} underline decoration-2 underline-offset-2`}>{s.text}</ins>
            ) : s.current ? (
              <del key={i} className={`${tint} decoration-2`}>{s.text}</del>
            ) : (
              <span key={i}>{s.text}</span>
            ),
          )}
        </p>
      ) : (
        <>
          <p className="mb-1 text-xs text-slate-600 dark:text-slate-400">{t("hint")}</p>
          <p className="mb-2 border-l-4 border-slate-300 pl-2 font-serif text-base dark:border-slate-700" lang={lang} role="group" aria-label={t("words")}>
            {words.map((w, i) => {
              const on = pick !== null && i >= pick[0] && i <= pick[1];
              return (
                <span key={w.start}>
                  {op.context.slice(i === 0 ? 0 : words[i - 1].end, w.start)}
                  <button
                    type="button"
                    aria-pressed={on}
                    className={`inline rounded-sm font-serif ${on ? `${tint} underline` : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                    onClick={() => pickWord(i)}
                  >
                    {w.text}
                  </button>
                </span>
              );
            })}
            {op.context.slice(words.length ? words[words.length - 1].end : 0)}
          </p>
          {picked && <p className="mb-2 text-xs">{t("selected", { form: picked.form })}</p>}
        </>
      )}

      {!editing && (
        <p className="mb-2 flex gap-3 text-xs text-slate-600 dark:text-slate-400">
          {shown.current && <span><del className={tint}>{t("current")}</del></span>}
          {shown.proposed && <span><ins className={`${tint} underline`}>{t("proposed")}</ins></span>}
        </p>
      )}
      {shown.problem === "outside" && <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">{t("outside")}</p>}
      {shown.problem === "changed" && <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">{t("changed")}</p>}
      {op.op === "add_mention" && asProposed.proposed === null && asProposed.problem === null && (
        <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">{t("noSpan")}</p>
      )}
      {op.reasoning && <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">{t("why", { text: op.reasoning })}</p>}

      {!editing ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!canAccept} className={`${button} bg-green-600 hover:bg-green-700`} onClick={() => onDecide(uid, { decision: "accept" })}>
            {r("actions.accept")}
          </button>
          <button type="button" className={`${button} bg-red-600 hover:bg-red-700`} onClick={() => onDecide(uid, { decision: "reject" })}>
            {r("actions.reject")}
          </button>
          {op.op !== "remove_mention" && (
            <button type="button" disabled={!canEdit} className={`${button} bg-slate-600 hover:bg-slate-700`} onClick={startEditing}>
              {t("choose")}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!picked}
            className={`${button} bg-amber-600 hover:bg-amber-700`}
            onClick={() => {
              if (!picked) return;
              onDecide(uid, { decision: "edit", edited: picked });
              setEditing(false);
            }}
          >
            {t("save")}
          </button>
          <button type="button" className={`${button} bg-slate-400 hover:bg-slate-500`} onClick={() => setEditing(false)}>
            {r("actions.cancel")}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Dispatch from `OperationCard`.** In `components/OperationCard.tsx`, add `import MentionCard from "@/components/MentionCard";` after the `EulogyView` import. Add `isMentionOp` to the `@/lib/changeset` import list. Then, after the `place_margin` branch in `OperationCard`, add:

```tsx
  // crmedr's mentions (eulogy markup): a quoted passage and a span, no eulogy fetched.
  if (isMentionOp(props.op)) {
    return <MentionCard op={props.op} decision={props.decision} onDecide={props.onDecide} />;
  }
```

- [ ] **Step 5: Run the card tests, the other card tests, and the type check, and confirm they pass.**

Run: `npx vitest run components/__tests__/MentionCard.test.tsx components/__tests__/OperationCard.test.tsx components/__tests__/PersonCard.test.tsx && npx tsc --noEmit -p .`
Expected: all tests pass, and `tsc` prints nothing.

The test "shows a resumed edit's words…" uses `getByText("edit")` for the decision badge. If that matches more than one element, use `getByText("edit", { selector: "span" })` and run again.

- [ ] **Step 6: Lint.**

Run: `npm run lint`
Expected: no errors or warnings.

- [ ] **Step 7: Commit.**

```bash
git add components/MentionCard.tsx components/OperationCard.tsx components/__tests__/MentionCard.test.tsx
git commit -m "feat(review): a card for deciding the eulogies' person and place marks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv"
```

---

### Task 5: A mentions change-set in the Review page

**Files:**
- Test: `components/__tests__/ReviewPage.test.tsx` (append; `ReviewPage.tsx` needs no change, because its op filter lists whatever `op` values the change-set holds).

**Interfaces:**
- Consumes: `ReviewPage` (unchanged), `MentionCard` via `OperationCard` (Task 4).

- [ ] **Step 1: Write the test.** Append to `components/__tests__/ReviewPage.test.tsx`:

```tsx
describe("ReviewPage with a mentions change-set", () => {
  // Invented Latin, never the copyrighted 2004 text.
  const context = "Fictópoli in Utópia, natális sancti Fictíni et Ficti, epíscopi.";
  const common = { edition: "martyrologium_romanum_2004", eulogy: "mr:0101-fictinus", where: "text", context, context_start: 120, decision: null, edited: null };
  const mentions = {
    schema: "crmedr-changeset/v1", generated_by: "scripts/extract_mentions.py",
    base: { edition: "martyrologium_romanum_2004", registry: "data/mentions.json" },
    operations: [
      { ...common, op: "add_mention", id: "martyrologium_romanum_2004|mr:0101-fictinus|text|156", kind: "person", name: "Fictinus", start: 156, end: 163, form: "Fictíni" },
      { ...common, op: "remove_mention", id: "martyrologium_romanum_2004|mr:0101-fictinus|text|120", kind: "place", start: 120, end: 129, form: "Fictópoli" },
    ],
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ changesets: ["mentions-review-01.json"] }),
      text: () => Promise.resolve(JSON.stringify(mentions)),
      url,
    })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("renders a card per operation and filters them by op", async () => {
    render(<ReviewPage />);
    await waitFor(() => expect(screen.getByRole("option", { name: "mentions-review-01.json" })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/bundled change-set/i), { target: { value: "mentions-review-01.json" } });
    await waitFor(() => expect(screen.getAllByTestId(/^op-card-/)).toHaveLength(2));
    expect(screen.getByText("Mark these words as a person")).toBeInTheDocument();
    // The op filter is the select that offers the ops this change-set holds.
    fireEvent.change(screen.getByRole("option", { name: "remove_mention" }).closest("select")!, { target: { value: "remove_mention" } });
    expect(screen.getAllByTestId(/^op-card-/)).toHaveLength(1);
    expect(screen.getByText("Remove the mark on this place")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and confirm it passes.** Tasks 1 to 4 already made it pass; this test pins the page-level behaviour.

Run: `npx vitest run components/__tests__/ReviewPage.test.tsx`
Expected: PASS, both the existing paging test and the new one.

- [ ] **Step 3: Commit.**

```bash
git add components/__tests__/ReviewPage.test.tsx
git commit -m "test(review): a mentions change-set loads, renders and filters by op

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv"
```

---

### Task 6: Bundling the mentions review privately

**Files:**
- Modify: `scripts/import-changeset.mjs`. Add `quotesText` and `writeBundle`; `writeIndex` returns its path; `main` parses `--private`.
- Modify: `README.md`, the "Data scripts" block.
- Test: `lib/__tests__/changeset.test.ts`

**Interfaces:**
- Consumes: the existing `splitByMonth` and `toBundledChangeset`.
- Produces:
  - `export function quotesText(cs): boolean`: whether any operation carries a `context` string.
  - `export function writeBundle(cs, name, { byMonth: boolean, dir: string, isPublic: boolean }): string[]`: the paths it wrote. It writes `index.json` only when `isPublic`. It throws, before writing anything, when `isPublic && quotesText(cs)`.
- CLI: `npm run import-changeset -- <src> <name> [edition] [--by-month] [--private]`. With `--private` it writes into `$CHANGESETS_DIR` and fails when that is unset.

- [ ] **Step 1: Write the failing tests.** In `lib/__tests__/changeset.test.ts`, extend the script import to `import { convertManifest, quotesText, splitByMonth, toBundledChangeset, writeBundle } from "@/scripts/import-changeset.mjs";` and add these imports at the top:

```ts
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
```

Then append:

```ts
describe("bundling the mentions review", () => {
  const op = (id: string, eulogy: string, extra = {}) => ({ op: "add_mention", id, eulogy, edition: "martyrologium_romanum_2004", where: "text",
    kind: "person", start: 0, end: 7, form: "Fictíni", context: "Fictíni et Ficti", context_start: 0, decision: null, edited: null, ...extra });
  const cs = {
    schema: "crmedr-changeset/v1" as const, generated_by: "scripts/extract_mentions.py",
    base: { edition: "martyrologium_romanum_2004", registry: "data/mentions.json" },
    operations: [op("e|mr:0101-a|text|0", "mr:0101-a"), op("e|mr:0315-b|text|0", "mr:0315-b")],
  };

  it("knows a change-set that quotes the text", () => {
    expect(quotesText(cs)).toBe(true);
    expect(quotesText({ ...cs, operations: [{ op: "resolve_place", id: "x", decision: null }] })).toBe(false);
  });

  it("refuses to write a change-set that quotes the text into the public repo, before writing anything", () => {
    const dir = mkdtempSync(join(tmpdir(), "cs-"));
    expect(() => writeBundle(cs, "mentions-review", { byMonth: true, dir, isPublic: true })).toThrow(/--private/);
    expect(readdirSync(dir)).toEqual([]);
  });

  it("writes a private bundle by month, without an index, replacing the earlier months", () => {
    const dir = mkdtempSync(join(tmpdir(), "cs-"));
    writeFileSync(join(dir, "mentions-review-07.json"), "{}"); // a month now without operations
    const written = writeBundle(cs, "mentions-review", { byMonth: true, dir, isPublic: false });
    expect(written.map((f) => f.split(/[\\/]/).pop())).toEqual(["mentions-review-01.json", "mentions-review-03.json"]);
    expect(readdirSync(dir).sort()).toEqual(["mentions-review-01.json", "mentions-review-03.json"]);
    expect(existsSync(join(dir, "index.json"))).toBe(false);
    expect(JSON.parse(readFileSync(join(dir, "mentions-review-03.json"), "utf8")).operations).toHaveLength(1);
  });

  it("still writes a public change-set with its index", () => {
    const dir = mkdtempSync(join(tmpdir(), "cs-"));
    const places = { ...cs, operations: [{ op: "resolve_place", id: "Fictópoli", decision: null, edited: null }] };
    writeBundle(places, "gazetteer-review", { byMonth: false, dir, isPublic: true });
    expect(JSON.parse(readFileSync(join(dir, "index.json"), "utf8"))).toEqual({ changesets: ["gazetteer-review.json"] });
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**

Run: `npx vitest run lib/__tests__/changeset.test.ts`
Expected: FAIL with `quotesText is not a function`, or with a missing export.

- [ ] **Step 3: Implement.** In `scripts/import-changeset.mjs`, replace `main` and `writeIndex` with:

```js
/**
 * Whether a change-set quotes an edition's text: its operations carry a `context` (crmedr's mentions
 * review quotes the 2004 edition), so it must never be written into this public repo.
 * @param {import("../lib/changeset.ts").Changeset} cs
 */
export function quotesText(cs) {
  return cs.operations.some((op) => typeof op.context === "string");
}

/**
 * Write a change-set into `dir`, whole or one file per month. The repo's changesets/ (`isPublic`) gets
 * its index regenerated; CHANGESETS_DIR needs none (every *.json there is listed). A change-set that
 * quotes the text is refused for the repo before anything is written. Returns the paths written.
 * @param {import("../lib/changeset.ts").Changeset} cs
 * @param {string} name
 * @param {{byMonth: boolean, dir: string, isPublic: boolean}} options
 * @returns {string[]}
 */
export function writeBundle(cs, name, { byMonth, dir, isPublic }) {
  if (isPublic && quotesText(cs)) {
    throw new Error(`${name} quotes the text (its operations carry context): bundle it with --private into CHANGESETS_DIR, never into this public repo`);
  }
  mkdirSync(dir, { recursive: true });
  const written = [];
  if (byMonth) {
    // A month now without operations must not keep its earlier part.
    for (const f of readdirSync(dir)) if (new RegExp(`^${name}-\\d{2}\\.json$`).test(f)) unlinkSync(join(dir, f));
    for (const part of splitByMonth(cs, name)) {
      const dest = join(dir, `${part.name}.json`);
      writeFileSync(dest, JSON.stringify(part.changeset) + "\n"); // compact: these are large
      written.push(dest);
    }
  } else {
    const dest = join(dir, `${name}.json`);
    writeFileSync(dest, JSON.stringify(cs, null, 1) + "\n");
    written.push(dest);
  }
  if (isPublic) written.push(writeIndex(dir));
  return written;
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const src = args[0] ?? join(here, "..", "..", "crmedr", "data", "deprecated_id_corrections.json");
  const name = args[1] ?? "deprecated-id-normalization";
  const edition = args[2] ?? "martyrologium_romanum_1749";
  const cs = toBundledChangeset(JSON.parse(readFileSync(src, "utf8")), { edition, registry: "crmedr@local" });
  const isPublic = !flags.has("--private");
  const dir = isPublic ? join(here, "..", "changesets") : process.env.CHANGESETS_DIR;
  if (!dir) throw new Error("--private writes into CHANGESETS_DIR, which is not set");
  for (const f of writeBundle(cs, name, { byMonth: flags.has("--by-month"), dir, isPublic })) console.log(`wrote ${f}`);
  console.log(`${cs.operations.length} operations (${basename(src)})`);
}

/**
 * Regenerate changesets/index.json — the manifest the Review page
 * fetches (through the curator-only /api/changesets) to populate its
 * bundled change-set picker. Lists every
 * `*.json` file in the changesets directory except the index itself.
 * @param {string} destDir
 * @returns {string} the index's path
 */
function writeIndex(destDir) {
  const files = readdirSync(destDir)
    .filter((f) => f.endsWith(".json") && f !== "index.json")
    .sort();
  const indexPath = join(destDir, "index.json");
  writeFileSync(indexPath, JSON.stringify({ changesets: files }, null, 1) + "\n");
  return indexPath;
}
```

Keep the existing `if (import.meta.url === …) main();` line at the end.

- [ ] **Step 4: Run the tests and confirm they pass, then check that the existing bundles are reproduced unchanged.**

Run: `npx vitest run lib/__tests__/changeset.test.ts && npm run import-changeset -- ../crmedr/data/gazetteer_review.json gazetteer-review && git status --short changesets/`
Expected: all tests pass. The import prints `wrote …/changesets/gazetteer-review.json` and `wrote …/changesets/index.json`. `git status` shows no change under `changesets/`, unless crmedr's queue itself has changed upstream since the last bundle; in that case run `git checkout changesets/`.

- [ ] **Step 5: Document it.** In `README.md`, inside the "Data scripts" fenced block, after the persons review paragraph, add:

```bash
# Bundle crmedr's mentions review (add_mention / set_span / remove_mention, the
# eulogy markup's doubtful and unmatched marks) one month at a time into a
# private directory: its operations quote a few words of the 2004 text either
# side of each mark, so it never goes in this public repo, and the script
# refuses to write it here without --private. MENTIONS_REVIEW is the file
# crmedr's extract_mentions.py wrote (outside crmedr's repo, for the same
# reason). On the server, CHANGESETS_DIR is
# /var/www/vhosts/romanmartyrology.com/review-changesets: bundle into a local
# private directory, then copy the files there (see below).
CHANGESETS_DIR="$HOME/private-changesets" \
  npm run import-changeset -- "$MENTIONS_REVIEW" mentions-review martyrologium_romanum_2004 --by-month --private
```

Then add, after that block, a short "Uploading private change-sets" paragraph to the README. It should give the
server steps, which match how the existing private change-sets were uploaded. The files there are owned by the
Plesk subscription user `romanmartyrology.com_q8xuoim5v3a`, group `psacln`, mode `640`:

```bash
scp "$HOME"/private-changesets/mentions-review-*.json ubuntu@catholicdigitalcommons.org:/tmp/
ssh ubuntu@catholicdigitalcommons.org 'sudo mv /tmp/mentions-review-*.json /var/www/vhosts/romanmartyrology.com/review-changesets/ \
  && sudo chown romanmartyrology.com_q8xuoim5v3a:psacln /var/www/vhosts/romanmartyrology.com/review-changesets/mentions-review-*.json \
  && sudo chmod 640 /var/www/vhosts/romanmartyrology.com/review-changesets/mentions-review-*.json'
```

The upload itself happens only after the PR merges, with the maintainer's go-ahead (Task 7), never as part of
this step.

- [ ] **Step 6: Commit.**

```bash
git add scripts/import-changeset.mjs lib/__tests__/changeset.test.ts README.md
git commit -m "feat(review): bundle a change-set that quotes the text into CHANGESETS_DIR only

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv"
```

---

### Task 7: Verify the branch and open the pull request

**Files:** none changed.

- [ ] **Step 1: Run the full suite, the type check, lint, and the production build.**

Run: `npx vitest run && npx tsc --noEmit -p . && npm run lint && npm run build`
Expected: every test file passes, `tsc` and lint print no errors, and the build lists `/[locale]/review` without errors.

- [ ] **Step 2: Check the card in a browser with a real-shaped change-set.**
  1. Write a change-set file holding the three operation fixtures from Task 4 (invented Latin), wrapped in a `crmedr-changeset/v1` header. Put it in a scratch directory, never in the repo.
  2. Start `npm run dev`, sign in as a curator, open `/en/review`, and upload the file with the "Upload" control.
  3. Check that each card shows its passage, tints and marks, and that word picking works with both the mouse and the keyboard (Tab to a word, Enter to pick it).
  4. Check that Export decisions downloads a file whose `edited` holds the chosen `{start, end, form}`.

  Chrome must be installed for Playwright (`npx playwright install chrome`), or check by hand.

- [ ] **Step 3: Push and open the pull request.**

```bash
git push -u origin feat/eulogy-markup-review
gh pr create --title "feat(review): decide the eulogies' person and place marks" --body "$(cat <<'EOF'
## Summary
- `/review` decides crmedr's mention operations: `add_mention`, `set_span` and `remove_mention`, the review queue of the eulogy markup.
- Each card shows the quoted passage in its text's language. The words marked now are struck through and the words to mark underlined, in the person (warm) or place (cool) tint.
- Accept takes the operation as proposed. "Choose the words" picks a span word by word (the first word, then the last) and records it as an edit `{start, end, form}` in eulogy offsets.
- An operation whose offsets fall outside its quoted context, or whose words there are not its `form`, can't be accepted as it stands. The card says why.
- `import-changeset --private` writes into `CHANGESETS_DIR`. A change-set whose operations quote the text (`context`) is refused for the public `changesets/` before anything is written.

Implements part 4 of `docs/superpowers/specs/2026-10-09-eulogy-markup-design.md`. It relies on the spec amendments listed in the plan (`context_start`, `kind` on every op, `add_mention` without a span), which crmedr's `extract_mentions.py` must emit.

## Test plan
- [x] `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`
- [x] Cards checked in a browser against an invented-Latin change-set: marks, tints, word picking by mouse and keyboard, export.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01XPRNec2aPhhL23QnWX6Ehv
EOF
)"
```

Expected: the PR URL is printed.

---

## Self-review

- **Spec coverage, "/review":**
  - the three operation types: Task 1;
  - `MentionCard` showing `context` with the span in its kind's tint, current struck through, proposed underlined: Tasks 2 and 4;
  - accept, reject and edit as for other cards: Task 4;
  - edit by selecting words in the context: Task 4, word buttons, chosen over a free text selection so it works with the keyboard and is testable in jsdom;
  - bundling `mentions-review` into the private directory: Task 6.
- **Spec coverage, "Change-set operations":**
  - the fields: Task 1;
  - `edited {start, end, form}` for `add_mention` and `set_span`, none for `remove_mention`: Tasks 1 and 4;
  - never committing `context` to the public repo: Task 6's refusal.
- **Applying decisions** to `mentions_curated.json` is crmedr's (part 1), not this plan's.
- **Placeholder scan:** the only placeholder is the example `CHANGESETS_DIR` path in the README (Task 6, Step 5), which says how to settle it.
- **Type consistency:** these names are the same in every task: `MentionOp`, `isMentionOp`, `mentionRanges`, `contextSegments`, `contextWords`, `wordsIn`, `editedSpan`, `mentionLang`, `MENTION_TINT`, `quotesText`, `writeBundle`. `edited` is always `{start, end, form}`, in eulogy offsets.
- **Review Focus:** each of the five lines has its test in the owning task:
  - no span: Task 4;
  - outside: Tasks 2 and 4;
  - changed: Tasks 2 and 4;
  - reversed pick and resume: Tasks 2 and 4;
  - bundling: Task 6.
