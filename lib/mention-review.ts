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
