import type { ElogiumOut, Mention } from "@/lib/types";

/**
 * A mention placed in one eulogy's text or footnote: `key` names it on the page, across its pieces; `group` names
 * every mark of the same person in the eulogy (a name printed in pieces, "Petri, cognoménto Apselámi seu Bálsami",
 * or again in a footnote, or in the other column of a spread), tinted together.
 */
export interface PlacedMention extends Mention {
  key: string;
  group: string;
  /** Its own group and, for a mark that names several persons, each other person's: tinted with all of them. */
  groups: string[];
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
 * The marks tinted together with this one: a person's, by their name and n in one eulogy, which is who they are
 * (crmedr's persons), in its text and its footnotes and in every edition printed beside it (the Italian marks carry
 * the Latin name and n); a place's, by its Wikidata item in one eulogy (crmedr's gazetteer gives the Latin and
 * Italian marks the same item). A person is never grouped by the item, which most persons do not have; a mark
 * with neither stays alone.
 */
export function mentionGroup(edition: string, eulogy: string, m: Mention): string {
  if (m.kind === "place" && m.qid) return `${eulogy}|place|${m.qid}`;
  if (m.kind !== "person" || !m.name) return mentionKey(edition, eulogy, m);
  return personGroup(eulogy, m.name, m.n);
}

const personGroup = (eulogy: string, name: string, n: number | null | undefined) => `${eulogy}|person|${name}#${n ?? 1}`;

/**
 * Every person a mark names, each as a mark of its own: the mark itself, then the other persons of one word that
 * names several (crmedr `others`), with their name, n, item and group.
 */
export function personsOf(m: PlacedMention): PlacedMention[] {
  return [m, ...(m.others ?? []).map((o) => {
    const group = personGroup(m.eulogy, o.name, o.n);
    return { ...m, name: o.name, n: o.n ?? null, qid: o.qid, others: null, group, groups: [group] };
  })];
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
    const group = mentionGroup(edition, eulogy, m);
    const others = m.kind === "person" ? (m.others ?? []).map((o) => personGroup(eulogy, o.name, o.n)) : [];
    kept.push({ ...m, eulogy, key: mentionKey(edition, eulogy, m), group, groups: [group, ...others] });
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
  const qids = (m: Mention) => [m.qid, ...(m.others ?? []).map((o) => o.qid)].filter((q): q is string => !!q);
  return [...new Set(elogia.flatMap((e) => (e?.mentions ?? []).flatMap(qids)))].sort();
}
