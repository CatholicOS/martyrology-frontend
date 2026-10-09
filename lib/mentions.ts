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

/**
 * The mention's name on the page: its edition, its eulogy, where it is, and where it starts. The edition keeps
 * the two columns of a spread apart when both print the same eulogy.
 */
export function mentionKey(edition: string, eulogy: string, m: Mention): string {
  return `${edition}|${eulogy}|${whereKey(m.where)}|${m.start}`;
}

/**
 * The mentions of `where` (the text, or footnote n) that fit a text of `length`, sorted and keyed for the eulogy
 * as printed in `edition`. A mention past the text (the text corrected since) is left out. Two that overlap should
 * not exist (crmedr forbids it): the first in the list is kept, the other dropped with a warning.
 */
export function mentionsIn(
  mentions: Mention[] | undefined, where: "text" | number, edition: string, eulogy: string, length: number,
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
    kept.push({ ...m, eulogy, key: mentionKey(edition, eulogy, m) });
  }
  return kept.sort((a, b) => a.start - b.start);
}

/**
 * [from, to) cut at the mentions' edges: the stretches in no mention, and each mention's part inside it.
 * Never an empty piece, so none can be made focusable (two cut points at one offset leave an empty stretch).
 */
export function splitByMentions(from: number, to: number, mentions: PlacedMention[]): Piece[] {
  const pieces: Piece[] = [];
  let at = from;
  for (const m of mentions) {
    if (m.end <= from || m.start >= to) continue;
    const s = Math.max(m.start, from);
    const e = Math.min(m.end, to);
    if (s >= e) continue;
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
