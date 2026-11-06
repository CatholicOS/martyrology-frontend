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
  /** The mark of the other kind this one is printed inside ("Placéntia" in "Conrádi de Placéntia Confalonieri"). */
  within?: PlacedMention;
}

/** A stretch of text between two cut points, inside a mention or not; `first` marks a mention's first piece. */
export interface Piece {
  start: number;
  end: number;
  mention: PlacedMention | null;
  first: boolean;
  /** For a piece of an inner mark, the mark it is printed inside. */
  within?: PlacedMention | null;
}

const whereKey = (w: Mention["where"]) => (w === "text" ? "text" : `fn${w.footnote}`);

/**
 * The mention's name on the page: its edition, its eulogy, where it is, and where it starts. The edition keeps
 * the two columns of a spread apart when both print the same eulogy. An event's ends in "|event": a place or
 * person inside it may start where it starts (Polonia in "Polonia invasa").
 */
export function mentionKey(edition: string, eulogy: string, m: Mention): string {
  return `${edition}|${eulogy}|${whereKey(m.where)}|${m.start}${m.kind === "event" ? "|event" : ""}`;
}

/**
 * The marks tinted together with this one: a person's, by their name and n in one eulogy, which is who they are
 * (crmedr's persons), in its text and its footnotes and in every edition printed beside it (the Italian marks carry
 * the Latin name and n); a place's, by its Wikidata item in one eulogy (crmedr's gazetteer gives the Latin and
 * Italian marks the same item); an event's, by its item likewise. A person is never grouped by the item, which most persons do not have; a mark
 * with neither stays alone.
 */
export function mentionGroup(edition: string, eulogy: string, m: Mention): string {
  if ((m.kind === "place" || m.kind === "event") && m.qid) return `${eulogy}|${m.kind}|${m.qid}`;
  if (m.kind !== "person" || !m.name) return mentionKey(edition, eulogy, m);
  return personGroup(eulogy, m.name, m.n);
}

/** A person the eulogy only mentions whom the Martyrology commemorates nowhere: their marks have an accent of their own. */
export const commemoratedNowhere = (m: Mention) =>
  m.kind === "person" && m.role === "mentioned" && !m.commemorated_in?.length;

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
 * as printed in `edition`. A mention past the text (the text corrected since) is left out. A mark may lie inside one
 * mark of the other kind, one level deep (a place in a person's name, a person in a place phrase): it is kept `within`
 * it. Any other overlap should not exist (crmedr forbids it): the earlier mark is kept, the other dropped with a warning.
 */
export function mentionsIn(
  mentions: Mention[] | undefined, where: "text" | number, edition: string, eulogy: string, length: number,
): PlacedMention[] {
  const kept: PlacedMention[] = [];
  const here = (m: Mention) => (where === "text" ? m.where === "text" : m.where !== "text" && m.where.footnote === where);
  // The outer of two nested marks first: by start, the longer first.
  const candidates = (mentions ?? []).filter((m) => here(m) && m.start >= 0 && m.end <= length && m.end > m.start)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  for (const m of candidates) {
    const crossed = kept.filter((k) => m.start < k.end && k.start < m.end);
    const outer = crossed.length === 1 ? crossed[0] : undefined;
    const nests = outer !== undefined && !outer.within && outer.kind !== m.kind
      && outer.start <= m.start && m.end <= outer.end && (outer.start !== m.start || outer.end !== m.end);
    if (crossed.length > 0 && !nests) {
      console.warn(`markup: ${eulogy}: "${m.form}" (${m.start}–${m.end}) overlaps "${crossed[0].form}" and is not marked`);
      continue;
    }
    const group = mentionGroup(edition, eulogy, m);
    const others = m.kind === "person" ? (m.others ?? []).map((o) => personGroup(eulogy, o.name, o.n)) : [];
    kept.push({ ...m, eulogy, key: mentionKey(edition, eulogy, m), group, groups: [group, ...others],
      ...(nests ? { within: outer } : {}) });
  }
  return kept;
}

/**
 * [from, to) cut at the mentions' edges: the stretches in no mention, and each mention's part inside it.
 * Never an empty piece, so none can be made focusable (two cut points at one offset leave an empty stretch).
 */
export function splitByMentions(from: number, to: number, mentions: PlacedMention[]): Piece[] {
  const outers = mentions.filter((m) => !m.within);
  const inners = mentions.filter((m) => m.within);
  // Where a mark's own words begin: past any inner mark printed at its start.
  const firstAt = (m: PlacedMention) => {
    let at = m.start;
    for (let i; (i = inners.find((x) => x.within?.key === m.key && x.start === at)); ) at = i.end;
    return at;
  };
  const pieces: Piece[] = [];
  const push = (start: number, end: number, mention: PlacedMention | null, first: boolean) => {
    if (start < end) pieces.push({ start, end, mention, first, ...(mention?.within ? { within: mention.within } : {}) });
  };
  let at = from;
  for (const m of outers) {
    if (m.end <= from || m.start >= to) continue;
    const s = Math.max(m.start, from);
    const e = Math.min(m.end, to);
    if (s >= e) continue;
    push(at, s, null, false);
    // The outer mark in pieces around the marks inside it.
    let cut = s;
    for (const i of inners.filter((x) => x.within?.key === m.key && x.end > s && x.start < e)) {
      push(cut, Math.max(i.start, s), m, Math.max(i.start, s) > cut && cut === firstAt(m));
      push(Math.max(i.start, s), Math.min(i.end, e), i, Math.max(i.start, s) === i.start);
      cut = Math.min(i.end, e);
    }
    push(cut, e, m, cut === firstAt(m));
    at = e;
  }
  push(at, to, null, false);
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
